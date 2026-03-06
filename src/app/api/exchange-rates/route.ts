import { NextResponse } from "next/server";
import { db, ensureExchangeRatesTable } from "@/lib/db";
import { exchangeRates } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET: Lista todos los tipos de cambio de mercado por fecha.
 * Crea la tabla automáticamente si no existe.
 */
export async function GET() {
  try {
    let result;
    try {
      result = await db.select().from(exchangeRates).orderBy(asc(exchangeRates.date));
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      if (msg.includes("does not exist") || msg.includes("relation")) {
        await ensureExchangeRatesTable();
        result = await db.select().from(exchangeRates).orderBy(asc(exchangeRates.date));
      } else {
        throw err;
      }
    }
    const map: Record<string, number> = {};
    result.forEach((r) => {
      const dateKey = String(r.date).slice(0, 10);
      map[dateKey] = Number(r.rate);
    });
    return NextResponse.json(map);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Error al cargar tipos de cambio" },
      { status: 500 }
    );
  }
}

/**
 * POST: Crear o actualizar tipo de cambio para una fecha.
 * Body: { date: "YYYY-MM-DD", rate: number }
 */
export async function POST(request: Request) {
  try {
    if (!process.env.SUPABASE_DATABASE_URL && !process.env.DATABASE_URL && !process.env.NEON_DATABASE_URL) {
      return NextResponse.json(
        { error: "Falta configurar SUPABASE_DATABASE_URL (o DATABASE_URL) en las variables de entorno." },
        { status: 500 }
      );
    }
    await ensureExchangeRatesTable();
    const body = await request.json();
    const { date, rate } = body;

    if (!date || rate == null) {
      return NextResponse.json(
        { error: "date y rate son requeridos" },
        { status: 400 }
      );
    }

    const dateStr = String(date).slice(0, 10);
    const rateNum = Number(rate);
    if (isNaN(rateNum) || rateNum <= 0) {
      return NextResponse.json(
        { error: "rate debe ser un número positivo" },
        { status: 400 }
      );
    }

    await db
      .insert(exchangeRates)
      .values({ date: dateStr, rate: String(rateNum) })
      .onConflictDoUpdate({
        target: exchangeRates.date,
        set: { rate: String(rateNum) },
      });

    return NextResponse.json({ date: dateStr, rate: rateNum });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[exchange-rates POST]", e);
    return NextResponse.json(
      { error: `Error al guardar tipo de cambio: ${msg}` },
      { status: 500 }
    );
  }
}
