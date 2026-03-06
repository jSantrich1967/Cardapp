import { NextResponse } from "next/server";
import { db, ensureExchangeRatesTable } from "@/lib/db";
import { cards, transactions, exchangeRates } from "@/lib/db/schema";
import { asc, and, eq, gte, lte } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const preferredRegion = ["iad1"];

/**
 * GET: Datos combinados para la página Resultados (cards + transactions + exchangeRates)
 * Una sola petición en lugar de 3.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get("cardId")?.trim() || null;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const txConditions = [];
    if (cardId && cardId !== "all") txConditions.push(eq(transactions.cardId, cardId));
    if (from) txConditions.push(gte(transactions.date, from));
    if (to) txConditions.push(lte(transactions.date, to));

    const txQuery =
      txConditions.length > 0
        ? db
          .select()
          .from(transactions)
          .where(and(...txConditions))
          .orderBy(asc(transactions.date), asc(transactions.createdAt))
        : db.select().from(transactions).orderBy(asc(transactions.date), asc(transactions.createdAt));

    let ratesList;
    try {
      ratesList = await db.select().from(exchangeRates).orderBy(asc(exchangeRates.date));
    } catch (err: any) {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("does not exist") || msg.includes("relation")) {
        await ensureExchangeRatesTable();
        ratesList = await db.select().from(exchangeRates).orderBy(asc(exchangeRates.date));
      } else {
        throw err;
      }
    }

    const [cardsList, txList] = await Promise.all([
      db.select().from(cards).orderBy(asc(cards.createdAt)),
      txQuery,
    ]);

    const exchangeRatesMap: Record<string, number> = {};
    ratesList.forEach((r) => {
      const dateKey = String(r.date).replace(/T.*/, "").slice(0, 10);
      exchangeRatesMap[dateKey] = Number(r.rate);
    });

    return NextResponse.json({
      cards: cardsList.map((c) => ({
        id: c.id,
        cardholderName: c.cardholderName,
        last4: c.last4,
      })),
      transactions: txList,
      exchangeRates: exchangeRatesMap,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(e);
    return NextResponse.json(
      {
        error: "Error al cargar datos de resultados",
        hint: msg.length > 200 ? msg.slice(0, 200) + "..." : msg,
      },
      { status: 500 }
    );
  }
}
