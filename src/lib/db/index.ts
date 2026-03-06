// Next.js maneja las variables de entorno de .env y .env.local automáticamente.
// Solo es necesario config() si se ejecutan scripts fuera de Next.js.

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Vercel: usar pooler (6543) con workaround - más rápido que conexión directa en serverless
// Local: SUPABASE_DIRECT_URL (5432) o pooler
let connectionString = "";
if (process.env.VERCEL && process.env.SUPABASE_DATABASE_URL) {
  connectionString = process.env.SUPABASE_DATABASE_URL;
  if (!connectionString.includes("workaround=supabase-pooler.vercel")) {
    connectionString += (connectionString.includes("?") ? "&" : "?") + "workaround=supabase-pooler.vercel";
  }
} else {
  connectionString =
    process.env.SUPABASE_DIRECT_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    "";
}

// El * en contraseñas rompe el parseo de la URL; codificar como %2A
if (connectionString && connectionString.includes("*") && !connectionString.includes("%2A")) {
  connectionString = connectionString.replace(/\*/g, "%2A");
}

if (!connectionString) {
  throw new Error("No hay URL de base de datos. Configura SUPABASE_DATABASE_URL en .env.local");
}

// For query purposes - connect_timeout y ssl para Supabase
// En Vercel: pooler con workaround; max: 1 para serverless
const client = postgres(connectionString, {
  prepare: false,
  connect_timeout: process.env.VERCEL ? 30 : 60,
  idle_timeout: 20,
  max: process.env.VERCEL ? 3 : 10,
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
