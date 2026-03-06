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
        cardId?: string;
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

    const defaultCardId = batch.cardId;

    // Get all existing transactions for duplicate check (we'll filter per card)
    const allExisting = await db.select().from(transactions);

    const toInsert: typeof transactions.$inferInsert[] = [];
    const seenInBatch = new Map<string, Set<string>>(); // cardId -> Set<dupKey>

    for (const row of rows) {
      const rowCardId = row.cardId || defaultCardId;
      const fecha = row.fecha ? new Date(row.fecha) : null;
      const operationType = row.operationType;
      const monto = Number(row.monto);

      if (!fecha || !operationType || monto == null || isNaN(monto)) continue;

      const dateStr = formatDateForDb(fecha);
      const dupKey = `${dateStr}-${operationType}-${monto.toFixed(2)}`;

      const existingForCard = allExisting.filter((t) => t.cardId === rowCardId);
      if (!seenInBatch.has(rowCardId)) seenInBatch.set(rowCardId, new Set());

      // Duplicate check: same card, date, op type, amount (existing or in batch)
      const isDupExisting = existingForCard.some(
        (t) =>
          t.date === dateStr &&
          t.operationType === operationType &&
          Math.abs(Number(t.amount) - monto) < 0.01
      );
      const isDupInBatch = seenInBatch.get(rowCardId)!.has(dupKey);
      if (isDupExisting || isDupInBatch) continue;
      seenInBatch.get(rowCardId)!.add(dupKey);

      // For PROCESADA: check if fees already exist (same date ±1 day, matching amounts)
      if (operationType === "PROCESADA") {
        const expectedFeeVzla = computeFeeVzla(monto);
        const expectedFeeMerchant = computeFeeMerchant(monto);
        const hasFeeVzla = existingForCard.some(
          (t) =>
            t.operationType === "FEE_VZLA" &&
            datesWithinOneDay(new Date(t.date), fecha) &&
            feeMatchesExpected(Number(t.amount), expectedFeeVzla)
        );
        const hasFeeMerchant = existingForCard.some(
          (t) =>
            t.operationType === "FEE_MERCHANT" &&
            datesWithinOneDay(new Date(t.date), fecha) &&
            feeMatchesExpected(Number(t.amount), expectedFeeMerchant)
        );
      }

      // Sign convention: RECARGA suma (positivo), PROCESADA y fees restan (negativo)
      const signedAmount =
        operationType === "RECARGA" ? monto : -Math.abs(monto);

      toInsert.push({
        cardId: rowCardId,
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

    // Use a transaction for consistency
    const result = await db.transaction(async (tx) => {
      // Insert main transactions
      const inserted = await tx.insert(transactions).values(toInsert).returning();

      // Link OCR fee rows to their preceding PROCESADA (same card, same date)
      const lastProcesadaByKey = new Map<string, string>();
      for (const t of inserted) {
        const key = `${t.cardId}-${t.date}`;
        if (t.operationType === "PROCESADA") {
          lastProcesadaByKey.set(key, t.id);
        }
        if (
          (t.operationType === "FEE_VZLA" || t.operationType === "FEE_MERCHANT") &&
          !t.parentTransactionId &&
          lastProcesadaByKey.has(key)
        ) {
          await tx
            .update(transactions)
            .set({ parentTransactionId: lastProcesadaByKey.get(key)! })
            .where(eq(transactions.id, t.id));
        }
      }

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
          await tx.insert(transactions).values({
            cardId: t.cardId,
            date: t.date,
            operationType: "FEE_VZLA",
            amount: String(-feeVzla),
            source: "import",
            importBatchId: batchId,
            parentTransactionId: t.id,
          });
        }
        if (!rowHadFeeMerchant) {
          await tx.insert(transactions).values({
            cardId: t.cardId,
            date: t.date,
            operationType: "FEE_MERCHANT",
            amount: String(-feeMerchant),
            source: "import",
            importBatchId: batchId,
            parentTransactionId: t.id,
          });
        }
      }

      await tx
        .update(importBatches)
        .set({
          status: "completed",
          rowCount: inserted.length,
          extractedCardName: batch.extractedCardName,
          extractedLast4: batch.extractedLast4,
        })
        .where(eq(importBatches.id, batchId));

      return { insertedCount: inserted.length };
    });

    return NextResponse.json({
      success: true,
      inserted: result.insertedCount,
      batchId,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to confirm import" }, { status: 500 });
  }
}
