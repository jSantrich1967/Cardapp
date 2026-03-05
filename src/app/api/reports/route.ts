import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, cards } from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get("cardId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const conditions = [];
    if (cardId) conditions.push(eq(transactions.cardId, cardId));
    if (from) conditions.push(gte(transactions.date, from));
    if (to) conditions.push(lte(transactions.date, to));

    const txList =
      conditions.length > 0
        ? await db
            .select()
            .from(transactions)
            .where(and(...conditions))
            .orderBy(transactions.date)
        : await db.select().from(transactions).orderBy(transactions.date);

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
    const balance = txList.reduce((s, t) => s + Number(t.amount), 0);

    const monthly = txList.reduce(
      (acc, t) => {
        const month = t.date.slice(0, 7);
        if (!acc[month]) acc[month] = { recarga: 0, procesada: 0, feeVzla: 0, feeMerchant: 0 };
        if (t.operationType === "RECARGA") acc[month]!.recarga += Number(t.amount);
        if (t.operationType === "PROCESADA") acc[month]!.procesada += Math.abs(Number(t.amount));
        if (t.operationType === "FEE_VZLA") acc[month]!.feeVzla += Math.abs(Number(t.amount));
        if (t.operationType === "FEE_MERCHANT") acc[month]!.feeMerchant += Math.abs(Number(t.amount));
        return acc;
      },
      {} as Record<string, { recarga: number; procesada: number; feeVzla: number; feeMerchant: number }>
    );

    const cardsList = await db.select().from(cards);
    const byCard = cardsList.map((c) => {
      const cardTx = txList.filter((t) => t.cardId === c.id);
      const bal = cardTx.reduce((s, t) => s + Number(t.amount), 0);
      return {
        id: c.id,
        cardholderName: c.cardholderName,
        last4: c.last4,
        balance: bal,
        txCount: cardTx.length,
      };
    });

    return NextResponse.json({
      summary: { recarga, procesada, feeVzla, feeMerchant, balance },
      monthly: Object.entries(monthly).map(([month, data]) => ({ month, ...data })),
      byCard,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 });
  }
}
