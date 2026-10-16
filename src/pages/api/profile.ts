import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { isSameOriginRequest } from "../../lib/auth";

const FIELDS = {
  full_name: 100,
  phone: 30,
  job_title: 100,
  department: 100,
  bio: 500
} as const;

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isSameOriginRequest(request)) {
    return new Response("Forbidden", { status: 403 });
  }
  if (locals.userId === undefined) {
    return new Response("Authentication required", { status: 401 });
  }

  const form = await request.formData();
  const values: string[] = [];
  for (const [field, maxLength] of Object.entries(FIELDS)) {
    const value = form.get(field);
    const text = typeof value === "string" ? value.trim() : "";
    if (text.length > maxLength) {
      return Response.redirect(new URL("/profile?error=invalid", request.url), 303);
    }
    values.push(text);
  }

  await env.stock_db.prepare(`
    INSERT INTO user_profiles (user_id, full_name, phone, job_title, department, bio, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = excluded.full_name,
      phone = excluded.phone,
      job_title = excluded.job_title,
      department = excluded.department,
      bio = excluded.bio,
      updated_at = CURRENT_TIMESTAMP
  `).bind(locals.userId, ...values).run();

  return Response.redirect(new URL("/profile?saved=1", request.url), 303);
};
