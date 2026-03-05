import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exchangeRates } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET: Lista todos los tipos de cambio de mercado por fecha.
 */
export async function GET() {
  try {
    const result = await db.select().from(exchangeRates).orderBy(asc(exchangeRates.date));
    const map: Record<string, number> = {};
    result.forEach((r) => {
      map[r.date] = Number(r.rate);
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
    console.error(e);
    return NextResponse.json(
      { error: "Error al guardar tipo de cambio" },
      { status: 500 }
    );
  }
}
