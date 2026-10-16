import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { isSameOriginRequest } from "../../../lib/auth";

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginRequest(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  const formData = await request.formData();
  const id = Number(formData.get("id"));

  if (!Number.isInteger(id) || id <= 0) {
    return new Response("Invalid product id", { status: 400 });
  }

  const db = env.stock_db;
  await db.batch([
    db.prepare("DELETE FROM stock_movements WHERE product_id = ?").bind(id),
    db.prepare("DELETE FROM stock_levels WHERE product_id = ?").bind(id),
    db.prepare("DELETE FROM products WHERE id = ?").bind(id)
  ]);

  return Response.redirect(new URL("/", request.url), 303);
};
