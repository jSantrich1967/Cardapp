import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cards, transactions, exchangeRates } from "@/lib/db/schema";
import { asc, and, eq, gte, lte } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const preferredRegion = ["iad1"];

/** GET: cards + transactions (RECARGA) + exchangeRates */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get("cardId")?.trim() || null;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const conditions = [eq(transactions.operationType, "RECARGA")];
    if (cardId && cardId !== "all") conditions.push(eq(transactions.cardId, cardId));
    if (from) conditions.push(gte(transactions.date, from));
    if (to) conditions.push(lte(transactions.date, to));

    const [cardsList, txList, ratesList] = await Promise.all([
      db.select().from(cards).orderBy(asc(cards.createdAt)),
      db
        .select()
        .from(transactions)
        .where(and(...conditions))
        .orderBy(asc(transactions.date), asc(transactions.createdAt)),
      db.select().from(exchangeRates),
    ]);

    const ratesMap: Record<string, number> = {};
    ratesList.forEach((r) => {
      ratesMap[r.date] = Number(r.rate);
    });

    return NextResponse.json({
      cards: cardsList.map((c) => ({ id: c.id, cardholderName: c.cardholderName, last4: c.last4 })),
      transactions: txList,
      exchangeRates: ratesMap,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error al cargar datos" }, { status: 500 });
  }
}
