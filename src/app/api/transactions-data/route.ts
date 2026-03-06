import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cards, transactions } from "@/lib/db/schema";
import { asc, and, eq, gte, lte, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** GET: cards + transactions en una sola petición */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get("cardId")?.trim() || null;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const type = searchParams.get("type");

    const conditions = [];
    if (cardId && cardId !== "all") conditions.push(eq(transactions.cardId, cardId));
    if (from) conditions.push(gte(transactions.date, from));
    if (to) conditions.push(lte(transactions.date, to));
    if (type && type !== "all") {
      if (type === "FEES") {
        conditions.push(inArray(transactions.operationType, ["FEE_VZLA", "FEE_MERCHANT"]));
      } else {
        conditions.push(eq(transactions.operationType, type as "RECARGA" | "PROCESADA" | "FEE_VZLA" | "FEE_MERCHANT"));
      }
    }

    const txQuery =
      conditions.length > 0
        ? db
            .select()
            .from(transactions)
            .where(and(...conditions))
            .orderBy(asc(transactions.date), asc(transactions.createdAt))
        : db.select().from(transactions).orderBy(asc(transactions.date), asc(transactions.createdAt));

    const [cardsList, txList] = await Promise.all([
      db.select().from(cards).orderBy(asc(cards.createdAt)),
      txQuery,
    ]);

    return NextResponse.json({
      cards: cardsList.map((c) => ({ id: c.id, cardholderName: c.cardholderName, last4: c.last4 })),
      transactions: txList,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error al cargar datos" }, { status: 500 });
  }
}
