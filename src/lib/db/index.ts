import { config } from "dotenv";
import { join } from "path";
config(); // .env
config({ path: join(process.cwd(), ".env.local"), override: true }); // .env.local tiene prioridad

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Prioridad: SUPABASE_DATABASE_URL (evita conflicto con DATABASE_URL del sistema) > NEON > DATABASE_URL > POSTGRES_URL
const connectionString =
  process.env.SUPABASE_DATABASE_URL ||
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
