import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// DATABASE_URL (manual) or POSTGRES_URL (Vercel Marketplace / Neon integration)
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL!;

// For query purposes
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
