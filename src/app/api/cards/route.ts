import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { cards } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const preferredRegion = ["iad1"];

export async function GET() {
  try {
    const result = await db.select().from(cards).orderBy(desc(cards.createdAt));
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch cards" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cardholderName, last4, status } = body;
    if (!cardholderName || !last4) {
      return NextResponse.json(
        { error: "cardholderName and last4 are required" },
        { status: 400 }
      );
    }
    const [card] = await db
      .insert(cards)
      .values({
        cardholderName: String(cardholderName).trim(),
        last4: String(last4).replace(/\D/g, "").slice(-4),
        status: status === "inactive" ? "inactive" : "active",
      })
      .returning();
    return NextResponse.json(card);
  } catch (e) {
    console.error(e);
    const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
    let hint = "Revisa la consola del servidor para más detalles.";
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
      hint = "No hay base de datos. Añade una desde Vercel: Storage → Create Database → Postgres (Neon).";
    } else if (msg.includes("connect") || msg.includes("connection") || msg.includes("econnrefused") || msg.includes("enotfound")) {
      hint = "No se puede conectar a la base de datos. Verifica DATABASE_URL y que Supabase esté accesible.";
    } else if (msg.includes("password") || msg.includes("authentication") || msg.includes("28p01")) {
      hint = "Error de autenticación. Verifica usuario y contraseña en DATABASE_URL.";
    } else if (msg.includes("relation") || msg.includes("does not exist")) {
      hint = "Las tablas no existen. Ejecuta el SQL de drizzle/0000_init.sql en Supabase.";
    }
    return NextResponse.json(
      { error: `Failed to create card. ${hint}` },
      { status: 500 }
    );
  }
}
