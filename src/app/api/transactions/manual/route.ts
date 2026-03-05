import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { computeFeeVzla, computeFeeMerchant } from "@/lib/utils/fees";

type OperationType = "RECARGA" | "PROCESADA" | "FEE_VZLA" | "FEE_MERCHANT";

/**
 * Create a manual transaction. For PROCESADA, auto-generates fee transactions.
 * Sign convention: RECARGA = positive (sums), PROCESADA/FEEs = negative (subtracts).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cardId, date, operationType, amount, notes } = body;

    if (!cardId || !date || !operationType || amount == null) {
      return NextResponse.json(
        { error: "cardId, date, operationType, amount are required" },
        { status: 400 }
      );
    }

    const signedAmount =
      operationType === "RECARGA" ? Number(amount) : -Math.abs(Number(amount));

    const [tx] = await db
      .insert(transactions)
      .values({
        cardId,
        date: String(date).slice(0, 10),
        operationType: operationType as OperationType,
        amount: String(signedAmount),
        notes: notes || null,
        source: "manual",
      })
      .returning();

    if (!tx) return NextResponse.json({ error: "Failed to create" }, { status: 500 });

    if (operationType === "PROCESADA") {
      const amt = Math.abs(Number(amount));
      const feeVzla = computeFeeVzla(amt);
      const feeMerchant = computeFeeMerchant(amt);
      await db.insert(transactions).values([
        {
          cardId,
          date: String(date).slice(0, 10),
          operationType: "FEE_VZLA",
          amount: String(-feeVzla),
          source: "manual",
          parentTransactionId: tx.id,
        },
        {
          cardId,
          date: String(date).slice(0, 10),
          operationType: "FEE_MERCHANT",
          amount: String(-feeMerchant),
          source: "manual",
          parentTransactionId: tx.id,
        },
      ]);
    }

    return NextResponse.json(tx);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
  }
}
