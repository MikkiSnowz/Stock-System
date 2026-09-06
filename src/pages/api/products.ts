import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const GET: APIRoute = async () => {
  const db = env.stock_db;
  const { results } = await db.prepare("SELECT * FROM products").all();
  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" }
  });
};

export const POST: APIRoute = async ({ request }) => {
  const db = env.stock_db;
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const sku = formData.get("sku") as string | null;

  await db.prepare("INSERT INTO products (name, sku) VALUES (?, ?)")
    .bind(name, sku || null)
    .run();

  return new Response(null, {
    status: 302,
    headers: { Location: "/" }
  });
};