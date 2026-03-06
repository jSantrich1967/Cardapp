import { config } from "dotenv";
import { join } from "path";
config(); // .env
config({ path: join(process.cwd(), ".env.local"), override: true }); // .env.local tiene prioridad

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Prioridad: SUPABASE_DIRECT_URL (5432) > SUPABASE_DATABASE_URL (pooler 6543) > NEON > DATABASE_URL > POSTGRES_URL
// Si el pooler falla, usa SUPABASE_DIRECT_URL desde Supabase Dashboard → Settings → Database → Direct connection
let connectionString =
  process.env.SUPABASE_DIRECT_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  "";

// El * en contraseñas rompe el parseo de la URL; codificar como %2A
if (connectionString && connectionString.includes("*") && !connectionString.includes("%2A")) {
  connectionString = connectionString.replace(/\*/g, "%2A");
}

if (!connectionString) {
  throw new Error("No hay URL de base de datos. Configura SUPABASE_DATABASE_URL en .env.local");
}

// For query purposes - connect_timeout y ssl para Supabase
// En Vercel/serverless usar max: 1 para evitar agotar el pool de conexiones
// Si falla con pooler (6543), prueba URL directa: postgresql://postgres:PASS@db.PROJECT.supabase.co:5432/postgres
const client = postgres(connectionString, {
  prepare: false,
  connect_timeout: 60,
  idle_timeout: 20,
  max: process.env.VERCEL ? 1 : 10,
  ssl: "require",
});

export const db = drizzle(client, { schema });

/** Crea la tabla exchange_rates si no existe (para Resultados) */
export async function ensureExchangeRatesTable() {
  await client`
    CREATE TABLE IF NOT EXISTS "exchange_rates" (
      "date" date PRIMARY KEY NOT NULL,
      "rate" decimal(15, 4) NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `;
}
