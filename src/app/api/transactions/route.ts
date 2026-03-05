import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
import { transactions } from "@/lib/db/schema";
import { eq, and, gte, lte, asc } from "drizzle-orm";

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
    if (type) conditions.push(eq(transactions.operationType, type as any));

    // Order: date ascending (oldest first, like bank statement), then createdAt for same-day order
    const result =
      conditions.length > 0
        ? await db
            .select()
            .from(transactions)
            .where(and(...conditions))
            .orderBy(asc(transactions.date), asc(transactions.createdAt))
        : await db.select().from(transactions).orderBy(asc(transactions.date), asc(transactions.createdAt));
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}
