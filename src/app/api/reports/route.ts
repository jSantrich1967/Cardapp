import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, cards } from "@/lib/db/schema";
import { eq, and, gte, lte, asc, inArray } from "drizzle-orm";
import { getCurrentBalance } from "@/lib/utils/balance";

export const dynamic = "force-dynamic";
export const preferredRegion = ["iad1"];

/**
 * API used by DashboardSummary for global summary and per-card balances.
 * The Reports page was removed; export is now in Transacciones and VES Usados.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get("cardId")?.trim() || null;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const conditions = [];
    if (cardId && cardId !== "all") conditions.push(eq(transactions.cardId, cardId));
    if (from) conditions.push(gte(transactions.date, from));
    if (to) conditions.push(lte(transactions.date, to));

    const txList =
      conditions.length > 0
        ? await db
          .select()
          .from(transactions)
          .where(and(...conditions))
          .orderBy(asc(transactions.date), asc(transactions.createdAt))
        : await db.select().from(transactions).orderBy(asc(transactions.date), asc(transactions.createdAt));

    const recarga = txList
      .filter((t) => t.operationType === "RECARGA")
      .reduce((s, t) => s + Number(t.amount), 0);
    const procesada = txList
      .filter((t) => t.operationType === "PROCESADA")
      .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const feeVzla = txList
      .filter((t) => t.operationType === "FEE_VZLA")
      .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const feeMerchant = txList
      .filter((t) => t.operationType === "FEE_MERCHANT")
      .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const balance = getCurrentBalance(txList);

    const cardIds = [...new Set(txList.map((t) => t.cardId))];
    const cardList = cardIds.length > 0 ? await db.select().from(cards).where(inArray(cards.id, cardIds)) : [];

    const balanceByCard = new Map<string, number>();
    for (const t of txList) {
      const current = balanceByCard.get(t.cardId) ?? 0;
      balanceByCard.set(t.cardId, current + Number(t.amount));
    }

    const byCard = cardList.map((c) => ({
      id: c.id,
      cardholderName: c.cardholderName,
      last4: c.last4,
      balance: balanceByCard.get(c.id) ?? 0,
      txCount: txList.filter((t) => t.cardId === c.id).length,
    }));

    return NextResponse.json({
      summary: { recarga, procesada, feeVzla, feeMerchant, balance },
      monthly: [],
      byCard,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Error al cargar reportes. Verifica la conexión a la base de datos." },
      { status: 500 }
    );
  }
}
