import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get("cardId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const type = searchParams.get("type");

    const conditions = [];
    if (cardId) conditions.push(eq(transactions.cardId, cardId));
    if (from) conditions.push(gte(transactions.date, from));
    if (to) conditions.push(lte(transactions.date, to));
    if (type) conditions.push(eq(transactions.operationType, type as any));

    const result =
      conditions.length > 0
        ? await db
            .select()
            .from(transactions)
            .where(and(...conditions))
            .orderBy(desc(transactions.date))
        : await db.select().from(transactions).orderBy(desc(transactions.date));
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}
