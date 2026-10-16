import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createSession, isSameOriginRequest, verifyPassword } from "../../../lib/auth";

interface UserRow {
  id: number;
  password_salt: string;
  password_hash: string;
}

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginRequest(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  const form = await request.formData();
  const emailValue = form.get("email");
  const passwordValue = form.get("password");
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (email.length > 254 || !email || password.length > 1024) {
    return Response.redirect(new URL("/login?error=invalid", request.url), 303);
  }

  const db = env.stock_db;
  const user = await db.prepare(
    "SELECT id, password_salt, password_hash FROM users WHERE email = ?"
  ).bind(email).first<UserRow>();

  if (!user || !(await verifyPassword(password, user.password_salt, user.password_hash))) {
    return Response.redirect(new URL("/login?error=invalid", request.url), 303);
  }

  const cookie = await createSession(db, user.id, new URL(request.url).protocol === "https:");
  return new Response(null, {
    status: 303,
    headers: { Location: "/", "Set-Cookie": cookie }
  });
};
