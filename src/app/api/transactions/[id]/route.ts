import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { computeFeeVzla, computeFeeMerchant } from "@/lib/utils/fees";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { date, operationType, amount, notes } = body;

    const [existing] = await db.select().from(transactions).where(eq(transactions.id, id));
    if (!existing) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    const updates: Record<string, unknown> = {};
    if (date != null) updates.date = date;
    if (operationType != null) updates.operationType = operationType;
    if (amount != null) updates.amount = amount;
    if (notes !== undefined) updates.notes = notes;

    const [updated] = await db
      .update(transactions)
      .set(updates as any)
      .where(eq(transactions.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [existing] = await db.select().from(transactions).where(eq(transactions.id, id));
    if (!existing) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    // Delete linked fee transactions
    await db
      .delete(transactions)
      .where(eq(transactions.parentTransactionId, id));

    await db.delete(transactions).where(eq(transactions.id, id));
    return NextResponse.json({ deleted: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}
