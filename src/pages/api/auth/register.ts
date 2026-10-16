import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createSession, hashPassword, isSameOriginRequest } from "../../../lib/auth";

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginRequest(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  const form = await request.formData();
  const emailValue = form.get("email");
  const passwordValue = form.get("password");
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 12 ||
    password.length > 1024
  ) {
    return Response.redirect(new URL("/register?error=invalid", request.url), 303);
  }

  const db = env.stock_db;
  const { salt, hash } = await hashPassword(password);
  const result = await db.prepare(
    "INSERT OR IGNORE INTO users (email, password_salt, password_hash) VALUES (?, ?, ?)"
  ).bind(email, salt, hash).run();

  if (!result.meta.changes) {
    return Response.redirect(new URL("/register?error=exists", request.url), 303);
  }

  const userId = Number(result.meta.last_row_id);
  const cookie = await createSession(db, userId, new URL(request.url).protocol === "https:");
  return new Response(null, {
    status: 303,
    headers: { Location: "/", "Set-Cookie": cookie }
  });
};
