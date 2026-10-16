import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { getSessionUserId, SESSION_COOKIE } from "./lib/auth";

const PUBLIC_PATHS = new Set(["/login", "/register"]);

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/api/auth/")) {
    return next();
  }

  if (pathname !== "/" && pathname !== "/api/products") {
    return next();
  }

  const userId = await getSessionUserId(env.stock_db, context.cookies.get(SESSION_COOKIE)?.value);
  if (userId !== null) {
    return next();
  }

  if (pathname.startsWith("/api/")) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  return context.redirect("/login", 302);
});
