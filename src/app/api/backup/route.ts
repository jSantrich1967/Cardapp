import { NextResponse } from "next/server";
import { db, ensureExchangeRatesTable } from "@/lib/db";
import { cards, transactions, exchangeRates } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Import puede tardar con muchos registros

export interface BackupData {
  version: 1;
  exportedAt: string;
  exchangeRates?: Array<{ date: string; rate: number }>;
  cards: Array<{
    id: string;
    cardholderName: string;
    last4: string;
    status: string;
  }>;
  transactions: Array<{
    id: string;
    cardId: string;
    date: string;
    operationType: string;
    amount: string;
    notes: string | null;
    source: string;
    parentTransactionId: string | null;
  }>;
}

/**
 * GET: Export full backup (cards + transactions) as JSON.
 */
export async function GET() {
  try {
    let ratesList: Array<{ date: string; rate: string }> = [];
    try {
      ratesList = await db.select().from(exchangeRates).orderBy(asc(exchangeRates.date));
    } catch {
      // Tabla puede no existir aún
    }
    const [cardsList, txList] = await Promise.all([
      db.select().from(cards).orderBy(asc(cards.createdAt)),
      db.select().from(transactions).orderBy(asc(transactions.date), asc(transactions.createdAt)),
    ]);

    const backup: BackupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      exchangeRates: Array.isArray(ratesList)
        ? ratesList.map((r) => ({ date: r.date, rate: Number(r.rate) }))
        : undefined,
      cards: cardsList.map((c) => ({
        id: c.id,
        cardholderName: c.cardholderName,
        last4: c.last4,
        status: c.status,
      })),
      transactions: txList.map((t) => ({
        id: t.id,
        cardId: t.cardId,
        date: t.date,
        operationType: t.operationType,
        amount: t.amount,
        notes: t.notes,
        source: t.source,
        parentTransactionId: t.parentTransactionId,
      })),
    };

    return NextResponse.json(backup);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Error al exportar respaldo. Verifica la conexión a la base de datos." },
      { status: 500 }
    );
  }
}

/**
 * POST: Import backup. Replaces all cards and transactions.
 * Body: BackupData (JSON)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Formato inválido. El archivo debe ser un JSON con 'cards' y 'transactions'." },
        { status: 400 }
      );
    }
    const cardsArr = Array.isArray(body.cards) ? body.cards : [];
    const txArr = Array.isArray(body.transactions) ? body.transactions : [];

    await ensureExchangeRatesTable();

    // Delete in order: transactions first (FK to cards), then cards, then exchange_rates
    await db.delete(transactions);
    await db.delete(cards);
    await db.delete(exchangeRates);

    const rates = Array.isArray(body?.exchangeRates) ? body.exchangeRates : [];

    if (rates.length > 0) {
      await db.insert(exchangeRates).values(
        rates.map((r: { date: string; rate: number }) => ({
          date: String(r.date).slice(0, 10),
          rate: String(r.rate),
        }))
      );
    }

    if (cardsArr.length > 0) {
      await db.insert(cards).values(
        cardsArr.map((c: { id: string; cardholderName: string; last4: string; status?: string }) => ({
          id: c.id,
          cardholderName: c.cardholderName,
          last4: c.last4,
          status: c.status === "inactive" ? "inactive" : "active",
        }))
      );
    }

    if (txArr.length > 0) {
      await db.insert(transactions).values(
        txArr.map(
          (t: {
            id: string;
            cardId: string;
            date: string;
            operationType: string;
            amount: string;
            notes?: string | null;
            source?: string;
            parentTransactionId?: string | null;
          }) => ({
            id: t.id,
            cardId: t.cardId,
            date: t.date,
            operationType: t.operationType,
            amount: t.amount,
            notes: t.notes ?? null,
            source: t.source ?? "manual",
            parentTransactionId: t.parentTransactionId ?? null,
          })
        )
      );
    }

    return NextResponse.json({
      success: true,
      cardsRestored: cardsArr.length,
      transactionsRestored: txArr.length,
      exchangeRatesRestored: rates.length,
    });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    const hint =
      msg.includes("foreign key") || msg.includes("violates foreign key")
        ? "El archivo puede tener transacciones que referencian tarjetas que no existen. Verifica que cards y transactions estén completos."
        : msg.includes("invalid input") || msg.includes("syntax")
          ? "El formato del archivo no es válido. Debe ser un JSON con version, cards y transactions."
          : msg.includes("connect") || msg.includes("connection")
            ? "Error de conexión a la base de datos."
            : msg;
    return NextResponse.json(
      { error: `Error al importar: ${hint}` },
      { status: 500 }
    );
  }
}
