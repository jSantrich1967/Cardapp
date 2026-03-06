/**
 * Importa un respaldo desde backup.json en la raíz del proyecto.
 * Ejecuta: npx tsx src/lib/db/import-backup.ts
 * Requiere: NEON_DATABASE_URL o DATABASE_URL en .env.local
 */
import { config } from "dotenv";
config(); // carga .env primero
config({ path: ".env.local", override: true }); // .env.local tiene prioridad (override vars del sistema)
import { readFileSync } from "fs";
import { join } from "path";
import { db, ensureExchangeRatesTable } from "./index";
import { cards, transactions, exchangeRates } from "./schema";

async function importBackup() {
  const backupPath = join(process.cwd(), "backup.json");
  let data: unknown;
  try {
    const raw = readFileSync(backupPath, "utf-8");
    data = JSON.parse(raw);
  } catch (e) {
    console.error("Error leyendo backup.json:", e);
    process.exit(1);
  }

  const body = data as {
    cards?: unknown[];
    transactions?: unknown[];
    exchangeRates?: Array<{ date: string; rate: number }>;
  };

  const cardsArr = Array.isArray(body?.cards) ? body.cards : [];
  const txArr = Array.isArray(body?.transactions) ? body.transactions : [];
  const rates = Array.isArray(body?.exchangeRates) ? body.exchangeRates : [];

  if (cardsArr.length === 0 && txArr.length === 0) {
    console.log("El respaldo no tiene cards ni transactions.");
    process.exit(1);
  }

  console.log("Importando:", cardsArr.length, "tarjetas,", txArr.length, "transacciones,", rates.length, "tasas");

  await ensureExchangeRatesTable();

  await db.delete(transactions);
  await db.delete(cards);
  await db.delete(exchangeRates);

  if (rates.length > 0) {
    await db.insert(exchangeRates).values(
      rates.map((r) => ({
        date: String(r.date).slice(0, 10),
        rate: String(r.rate),
      }))
    );
    console.log("Tasas importadas:", rates.length);
  }

  if (cardsArr.length > 0) {
    type CardRow = { id: string; cardholderName: string; last4: string; status?: string };
    const rows = (cardsArr as CardRow[]).map((c) => ({
      id: c.id,
      cardholderName: c.cardholderName,
      last4: c.last4,
      status: (c.status === "inactive" ? "inactive" : "active") as "active" | "inactive",
    }));
    await db.insert(cards).values(rows);
    console.log("Tarjetas importadas:", cardsArr.length);
  }

  if (txArr.length > 0) {
    type TxRow = {
      id: string;
      cardId: string;
      date: string;
      operationType: string;
      amount: string;
      notes?: string | null;
      source?: string;
      parentTransactionId?: string | null;
    };
    const txRows = (txArr as TxRow[]).map((t) => ({
      id: t.id,
      cardId: t.cardId,
      date: t.date,
      operationType: t.operationType as "RECARGA" | "PROCESADA" | "FEE_VZLA" | "FEE_MERCHANT",
      amount: t.amount,
      notes: t.notes ?? null,
      source: (t.source === "import" ? "import" : "manual") as "manual" | "import",
      parentTransactionId: t.parentTransactionId ?? null,
    }));
    await db.insert(transactions).values(txRows);
    console.log("Transacciones importadas:", txArr.length);
  }

  console.log("Respaldo importado correctamente.");
}

importBackup().catch((e) => {
  console.error(e);
  process.exit(1);
});
