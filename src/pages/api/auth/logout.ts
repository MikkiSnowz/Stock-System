import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  deleteSession,
  expiredSessionCookie,
  isSameOriginRequest,
  SESSION_COOKIE
} from "../../../lib/auth";

export const POST: APIRoute = async ({ cookies, request }) => {
  if (!isSameOriginRequest(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  const secure = new URL(request.url).protocol === "https:";
  await deleteSession(env.stock_db, cookies.get(SESSION_COOKIE)?.value);
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/login",
      "Set-Cookie": expiredSessionCookie(secure)
    }
  });
};
