import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { importBatches } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const batches = await db
      .select()
      .from(importBatches)
      .orderBy(desc(importBatches.createdAt));
    return NextResponse.json(batches);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch import batches" }, { status: 500 });
  }
}
