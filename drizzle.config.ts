import { config } from "dotenv";
import { join } from "path";
config();
config({ path: join(process.cwd(), ".env.local"), override: true });

import { defineConfig } from "drizzle-kit";

// Usa SUPABASE_DATABASE_URL para coincidir con la app
const dbUrl =
  process.env.SUPABASE_DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.DATABASE_URL!;

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  } as { url: string },
});
