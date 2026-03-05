import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [card] = await db.select().from(cards).where(eq(cards.id, id));
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });
    return NextResponse.json(card);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch card" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { cardholderName, last4, status } = body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (cardholderName != null) updates.cardholderName = String(cardholderName).trim();
    if (last4 != null) updates.last4 = String(last4).replace(/\D/g, "").slice(-4);
    if (status != null) updates.status = status === "inactive" ? "inactive" : "active";

    const [card] = await db
      .update(cards)
      .set(updates as any)
      .where(eq(cards.id, id))
      .returning();
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });
    return NextResponse.json(card);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update card" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [card] = await db.delete(cards).where(eq(cards.id, id)).returning();
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete card" }, { status: 500 });
  }
}
