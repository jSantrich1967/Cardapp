/**
 * Ejecuta las migraciones SQL directamente contra la base de datos.
 * Uso: npx tsx scripts/run-migrations.ts
 */
import { config } from "dotenv";
import { join } from "path";
config();
config({ path: join(process.cwd(), ".env.local"), override: true });

import postgres from "postgres";
import { readFileSync } from "fs";

const url =
  process.env.SUPABASE_DIRECT_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.DATABASE_URL;

if (!url) {
  console.error("Falta SUPABASE_DATABASE_URL o DATABASE_URL en .env.local");
  process.exit(1);
}

async function main() {
  const sql = postgres(url as string, { prepare: false });

  const files = [
    join(process.cwd(), "drizzle", "0000_init.sql"),
    join(process.cwd(), "drizzle", "0001_exchange_rates.sql"),
  ];

  for (const file of files) {
    console.log("Ejecutando:", file);
    const content = readFileSync(file, "utf-8");
    await sql.unsafe(content);
    console.log("  OK");
  }

  await sql.end();
  console.log("Migraciones completadas.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
