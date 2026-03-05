import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
import { transactions } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { computeRunningBalance } from "@/lib/utils/balance";

/**
 * Get transactions with reported_balance and compute differences.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get("cardId");

    if (!cardId) {
      return NextResponse.json({ error: "cardId is required" }, { status: 400 });
    }

    const txList = await db
      .select()
      .from(transactions)
      .where(eq(transactions.cardId, cardId))
      .orderBy(asc(transactions.date));

    const balanceByTx = computeRunningBalance(txList);

    const withDiff = txList
      .filter((t) => t.reportedBalance != null)
      .map((t) => {
        const computed = balanceByTx.get(t.id) ?? 0;
        const reported = Number(t.reportedBalance);
        const diff = computed - reported;
        return {
          id: t.id,
          date: t.date,
          operationType: t.operationType,
          amount: t.amount,
          reportedBalance: t.reportedBalance,
          computedBalance: computed,
          difference: diff,
          possibleOcrError: Math.abs(diff) > 0.01,
        };
      });

    return NextResponse.json({
      cardId,
      items: withDiff,
      mismatches: withDiff.filter((x) => Math.abs(x.difference) > 0.01),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch reconciliation" }, { status: 500 });
  }
}
