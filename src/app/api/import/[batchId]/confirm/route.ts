import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  importBatches,
  transactions,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { computeFeeVzla, computeFeeMerchant, feeMatchesExpected } from "@/lib/utils/fees";
import { formatDateForDb, datesWithinOneDay } from "@/lib/utils/parse";

type OperationType = "RECARGA" | "PROCESADA" | "FEE_VZLA" | "FEE_MERCHANT";

/**
 * Confirm import: save extracted rows as transactions, auto-generate fees for PROCESADA.
 * Body: { rows: Array<{ fecha, operacion, operationType, monto, saldo?, rawText, confidence }> }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;
    const body = await request.json();
    const { rows } = body as {
      rows: Array<{
        fecha: string;
        operacion: string;
        operationType: OperationType;
        monto: number;
        saldo?: number;
        rawText: string;
        confidence: number;
      }>;
    };

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: "rows array is required" }, { status: 400 });
    }

    const [batch] = await db
      .select()
      .from(importBatches)
      .where(eq(importBatches.id, batchId));

    if (!batch) {
      return NextResponse.json({ error: "Import batch not found" }, { status: 404 });
    }

    const cardId = batch.cardId;

    // Get existing transactions for duplicate check
    const existing = await db
      .select()
      .from(transactions)
      .where(eq(transactions.cardId, cardId));

    const toInsert: typeof transactions.$inferInsert[] = [];
    const seenInBatch = new Set<string>();

    for (const row of rows) {
      const fecha = row.fecha ? new Date(row.fecha) : null;
      const operationType = row.operationType;
      const monto = Number(row.monto);

      if (!fecha || !operationType || monto == null || isNaN(monto)) continue;

      const dateStr = formatDateForDb(fecha);
      const dupKey = `${dateStr}-${operationType}-${monto.toFixed(2)}`;

      // Duplicate check: same card, date, op type, amount (existing or in batch)
      const isDupExisting = existing.some(
        (t) =>
          t.date === dateStr &&
          t.operationType === operationType &&
          Math.abs(Number(t.amount) - monto) < 0.01
      );
      const isDupInBatch = seenInBatch.has(dupKey);
      if (isDupExisting || isDupInBatch) continue;
      seenInBatch.add(dupKey);

      // For PROCESADA: check if fees already exist (same date ±1 day, matching amounts)
      let skipFeeGeneration = false;
      if (operationType === "PROCESADA") {
        const expectedFeeVzla = computeFeeVzla(monto);
        const expectedFeeMerchant = computeFeeMerchant(monto);
        const hasFeeVzla = existing.some(
          (t) =>
            t.operationType === "FEE_VZLA" &&
            datesWithinOneDay(new Date(t.date), fecha) &&
            feeMatchesExpected(Number(t.amount), expectedFeeVzla)
        );
        const hasFeeMerchant = existing.some(
          (t) =>
            t.operationType === "FEE_MERCHANT" &&
            datesWithinOneDay(new Date(t.date), fecha) &&
            feeMatchesExpected(Number(t.amount), expectedFeeMerchant)
        );
        if (hasFeeVzla && hasFeeMerchant) skipFeeGeneration = true;
      }

      // Sign convention: RECARGA = positive, PROCESADA/FEEs = negative
      const signedAmount =
        operationType === "RECARGA" ? monto : -Math.abs(monto);

      toInsert.push({
        cardId,
        date: dateStr,
        operationType,
        amount: String(signedAmount),
        notes: null,
        source: "import",
        importBatchId: batchId,
        parentTransactionId: null,
        reportedBalance: row.saldo != null ? String(row.saldo) : null,
        rawOcrText: row.rawText || null,
      });
    }

    // Insert transactions
    const inserted = await db.insert(transactions).values(toInsert).returning();

    // Auto-generate fees for PROCESADA
    for (let i = 0; i < inserted.length; i++) {
      const t = inserted[i]!;
      if (t.operationType !== "PROCESADA") continue;

      const amount = Math.abs(Number(t.amount));
      const feeVzla = computeFeeVzla(amount);
      const feeMerchant = computeFeeMerchant(amount);

      // Check if we already have these fees in the rows we're inserting
      const rowHadFeeVzla = rows.some(
        (r) =>
          r.operationType === "FEE_VZLA" &&
          r.fecha &&
          datesWithinOneDay(new Date(r.fecha), new Date(t.date)) &&
          feeMatchesExpected(Number(r.monto), feeVzla)
      );
      const rowHadFeeMerchant = rows.some(
        (r) =>
          r.operationType === "FEE_MERCHANT" &&
          r.fecha &&
          datesWithinOneDay(new Date(r.fecha), new Date(t.date)) &&
          feeMatchesExpected(Number(r.monto), feeMerchant)
      );

      if (!rowHadFeeVzla) {
        await db.insert(transactions).values({
          cardId,
          date: t.date,
          operationType: "FEE_VZLA",
          amount: String(-feeVzla),
          source: "import",
          importBatchId: batchId,
          parentTransactionId: t.id,
        });
      }
      if (!rowHadFeeMerchant) {
        await db.insert(transactions).values({
          cardId,
          date: t.date,
          operationType: "FEE_MERCHANT",
          amount: String(-feeMerchant),
          source: "import",
          importBatchId: batchId,
          parentTransactionId: t.id,
        });
      }
    }

    await db
      .update(importBatches)
      .set({
        status: "completed",
        rowCount: inserted.length,
        extractedCardName: batch.extractedCardName,
        extractedLast4: batch.extractedLast4,
      })
      .where(eq(importBatches.id, batchId));

    return NextResponse.json({
      success: true,
      inserted: inserted.length,
      batchId,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to confirm import" }, { status: 500 });
  }
}
