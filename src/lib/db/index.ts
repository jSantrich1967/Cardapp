import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// NEON_DATABASE_URL: usa esta variable en Vercel si no puedes editar DATABASE_URL
// Orden: NEON_DATABASE_URL > DATABASE_URL > POSTGRES_URL
const connectionString =
  process.env.NEON_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL!;

// For query purposes
const client = postgres(connectionString, { prepare: false });

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
