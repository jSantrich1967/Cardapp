/**
 * OCR result parser: extracts table structure from tesseract.js output.
 * Uses bounding boxes for layout detection, with heuristic fallback.
 */

import { parseAmount, parseDate, normalizeOperationType } from "./parse";

export interface ParsedRow {
  rawText: string;
  fecha: Date | null;
  operacion: string | null;
  operationType: "RECARGA" | "PROCESADA" | "FEE_VZLA" | "FEE_MERCHANT" | null;
  monto: number | null;
  saldo: number | null;
  confidence: number;
  rowIndex: number;
}

export interface ExtractedCardInfo {
  cardName: string | null;
  last4: string | null;
}

/**
 * Extract card name and last4 from OCR words (header area).
 */
export function extractCardInfo(words: { text: string; bbox: { y0: number } }[]): ExtractedCardInfo {
  const headerWords = words.filter((w) => w.bbox.y0 < 150); // Top ~150px
  let cardName: string | null = null;
  let last4: string | null = null;

  for (const w of headerWords) {
    const t = w.text.trim();
    if (/^\d{4}$/.test(t)) last4 = t;
    if (t.length > 3 && !/^\d+$/.test(t) && !cardName) cardName = t;
  }
  return { cardName, last4 };
}

/**
 * Parse tesseract.js result into structured rows.
 * Tesseract returns words with bbox (bounding box). We cluster by row (y) and column (x).
 */
export function parseOcrToRows(
  words: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; confidence?: number }>,
  imageHeight?: number
): ParsedRow[] {
  if (words.length === 0) return [];

  const ROW_THRESHOLD = 8; // pixels - tighter to reduce duplicate rows from OCR noise
  const rows: Array<{ y: number; cells: Array<{ text: string; x: number; conf: number }> }> = [];

  const sorted = [...words].sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);

  for (const w of sorted) {
    const text = w.text.trim();
    if (!text || text.length < 2) continue; // Skip single chars/noise

    const y = w.bbox.y0;
    const x = w.bbox.x0;
    const conf = typeof w.confidence === "number" ? w.confidence / 100 : 0.8;

    let row = rows.find((r) => Math.abs(r.y - y) <= ROW_THRESHOLD);
    if (!row) {
      row = { y, cells: [] };
      rows.push(row);
    }
    row.cells.push({ text, x, conf });
  }

  // Sort cells in each row by x, dedupe adjacent identical cells (OCR often duplicates)
  rows.forEach((r) => {
    r.cells.sort((a, b) => a.x - b.x);
    const deduped: typeof r.cells = [];
    for (const c of r.cells) {
      if (deduped.length === 0 || deduped[deduped.length - 1]!.text !== c.text) {
        deduped.push(c);
      }
    }
    r.cells = deduped;
  });

  const result: ParsedRow[] = [];
  const seenKeys = new Set<string>();
  const skipHeaders = ["fecha", "operación", "operacion", "monto", "saldo", "date", "operation", "amount", "balance"];

  rows.forEach((row, idx) => {
    const rawText = row.cells.map((c) => c.text).join(" ");
    const cells = row.cells.map((c) => c.text);

    // Skip header row
    const firstLower = cells[0]?.toLowerCase() ?? "";
    if (skipHeaders.some((h) => firstLower.includes(h))) return;

    const fecha = parseDate(cells[0]) ?? parseDate(cells[1]) ?? parseDateFromText(rawText);
    const operacion = cells[1] ?? cells[2] ?? null;
    const operationType = normalizeOperationType(operacion ?? rawText);
    // Prefer cells for amount; only use rawText if row looks like a transaction (avoids hallucinations)
    const monto =
      parseAmount(cells[2]) ??
      parseAmount(cells[3]) ??
      (operationType ? parseAmountFromText(rawText) : null);
    const saldo = parseAmount(cells[3]) ?? parseAmount(cells[4]) ?? null;

    // Filter: require fecha + monto + operationType (avoid extracting data that doesn't exist)
    if (!fecha || monto == null || monto < 0.01 || !operationType) return;

    // Deduplicate: same fecha + monto + type = same transaction (OCR often repeats 3+ times)
    const fechaStr = fecha.toISOString().slice(0, 10);
    const montoStr = monto.toFixed(2);
    const dupKey = `${fechaStr}-${montoStr}-${operationType}`;
    if (seenKeys.has(dupKey)) return;
    seenKeys.add(dupKey);

    const avgConf = row.cells.length > 0
      ? row.cells.reduce((s, c) => s + (c.conf ?? 0.8), 0) / row.cells.length
      : 0.5;

    result.push({
      rawText,
      fecha,
      operacion,
      operationType,
      monto,
      saldo,
      confidence: Math.round(avgConf * 100) / 100,
      rowIndex: idx,
    });
  });

  return result;
}

function parseDateFromText(text: string): Date | null {
  const match = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return match ? parseDate(match[0]) : null;
}

function parseAmountFromText(text: string): number | null {
  const match = text.match(/[\d.,]+/g);
  if (!match) return null;
  for (const m of match) {
    const n = parseAmount(m);
    if (n != null && Math.abs(n) > 0.01) return n;
  }
  return null;
}
