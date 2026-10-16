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
  const quantityValue = Number(formData.get("quantity") || 0);

  if (!Number.isInteger(quantityValue) || quantityValue < 0 || quantityValue > 1_000_000) {
    return new Response("Quantity must be a whole number of 0 or more", { status: 400 });
  }

  const statements = [
    db.prepare(
      "INSERT INTO locations (name) SELECT 'Main' WHERE NOT EXISTS (SELECT 1 FROM locations WHERE name = 'Main')"
    ),
    db.prepare("INSERT INTO products (name, sku) VALUES (?, ?)").bind(name, sku || null)
  ];

  if (quantityValue > 0) {
    const mainLocation = "(SELECT id FROM locations WHERE name = 'Main' ORDER BY id LIMIT 1)";
    statements.push(
      db.prepare(
        `INSERT INTO stock_levels (product_id, location_id, quantity) VALUES (last_insert_rowid(), ${mainLocation}, ?)`
      ).bind(quantityValue),
      db.prepare(
        `INSERT INTO stock_movements (product_id, location_id, change, reason)
         VALUES ((SELECT product_id FROM stock_levels WHERE rowid = last_insert_rowid()), ${mainLocation}, ?, 'Initial stock')`
      ).bind(quantityValue)
    );
  }

  await db.batch(statements);

  return new Response(null, {
    status: 302,
    headers: { Location: "/" }
  });
};