/**
 * Corrige un backup.json que fue exportado/copiado en orden inverso.
 * Uso: Guarda el contenido corrupto en raw-backup.txt y ejecuta:
 *   npx tsx scripts/fix-backup.ts
 * O pasa la ruta del archivo: npx tsx scripts/fix-backup.ts ruta/al/archivo.txt
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const rawPath = process.argv[2] || join(process.cwd(), "raw-backup.txt");
const outPath = join(process.cwd(), "backup.json");

function extractProp(block: string, key: string): string | null {
  const regex = new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`, "g");
  const m = regex.exec(block);
  return m ? m[1] : null;
}

function extractPropNull(block: string, key: string): string | null {
  const regex = new RegExp(`"${key}"\\s*:\\s*(null|"[^"]*")`, "g");
  const m = regex.exec(block);
  if (!m) return null;
  const v = m[1];
  return v === "null" ? null : v.replace(/^"|"$/g, "");
}

function parseBlocks(raw: string): string[] {
  // Split by object boundaries: "},    {" or "},  {" etc.
  const parts = raw.split(/\}\s*,\s*\{\s*\}/);
  return parts.filter((p) => p.trim().length > 0);
}

function parseTransactions(raw: string) {
  const blocks = raw.split(/,\s*\{\s*\},/);
  const txs: Array<{
    id: string;
    cardId: string;
    date: string;
    amount: string;
    operationType: string;
    source: string;
    notes: string | null;
    parentTransactionId: string | null;
  }> = [];
  const uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/;

  for (const block of blocks) {
    const id = extractProp(block, "id");
    const cardId = extractProp(block, "cardId");
    const date = extractProp(block, "date");
    const amount = extractProp(block, "amount");
    const operationType = extractProp(block, "operationType");
    const source = extractProp(block, "source");
    const parentTransactionId = extractPropNull(block, "parentTransactionId");

    if (id && cardId && uuidRegex.test(id) && uuidRegex.test(cardId) && date && amount && operationType) {
      txs.push({
        id,
        cardId,
        date,
        amount,
        operationType,
        source: source || "manual",
        notes: null,
        parentTransactionId: parentTransactionId || null,
      });
    }
  }
  return txs;
}

function parseCards(raw: string) {
  const blocks = raw.split(/,\s*\{\s*\},/);
  const cards: Array<{ id: string; cardholderName: string; last4: string; status: string }> = [];
  const uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/;

  for (const block of blocks) {
    const id = extractProp(block, "id");
    const cardholderName = extractProp(block, "cardholderName");
    const last4 = extractProp(block, "last4");
    const status = extractProp(block, "status");

    if (id && cardholderName && last4 && uuidRegex.test(id)) {
      cards.push({
        id,
        cardholderName,
        last4,
        status: status || "active",
      });
    }
  }
  return cards;
}

function main() {
  let raw: string;
  try {
    raw = readFileSync(rawPath, "utf-8");
  } catch (e) {
    console.error("No se encontró", rawPath);
    console.error("Guarda el contenido corrupto en raw-backup.txt y vuelve a ejecutar.");
    process.exit(1);
  }

  // Try 1: Maybe the entire string is reversed
  const reversed = raw.split("").reverse().join("");
  try {
    const parsed = JSON.parse(reversed);
    if (parsed.cards && parsed.transactions) {
      writeFileSync(outPath, JSON.stringify(parsed, null, 2), "utf-8");
      console.log("backup.json corregido (string invertida).");
      return;
    }
  } catch {
    // Not valid JSON, try parsing manually
  }

  // Try 2: Parse blocks manually
  const cards = parseCards(raw);
  const txs = parseTransactions(raw);

  if (cards.length > 0 || txs.length > 0) {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      cards,
      transactions: txs,
    };
    writeFileSync(outPath, JSON.stringify(backup, null, 2), "utf-8");
    console.log(`backup.json corregido: ${cards.length} tarjetas, ${txs.length} transacciones.`);
    return;
  }

  console.error("No se pudo extraer datos. Verifica el formato de raw-backup.txt");
  process.exit(1);
}

main();
