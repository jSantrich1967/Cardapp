import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { importBatches, importRows } from "@/lib/db/schema";

/**
 * Create a new import batch (before OCR runs on client).
 * Client will send: cardId, imageFilename (optional).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cardId, imageFilename } = body;
    if (!cardId) {
      return NextResponse.json({ error: "cardId is required" }, { status: 400 });
    }

    const [batch] = await db
      .insert(importBatches)
      .values({
        cardId,
        imageFilename: imageFilename || null,
        status: "pending",
      })
      .returning();

    return NextResponse.json(batch);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create import batch" }, { status: 500 });
  }
}
