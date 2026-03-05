/**
 * Data normalization and parsing utilities for CardOps.
 * Handles Spanish number format, dates, and operation type normalization.
 */

export type OperationType = "RECARGA" | "PROCESADA" | "FEE_VZLA" | "FEE_MERCHANT";

/**
 * Parse Spanish-formatted amount to number.
 * Examples: "6.000,00" -> 6000, "1.234,56" -> 1234.56, "100" -> 100
 */
export function parseAmount(value: string | null | undefined): number | null {
  if (value == null || String(value).trim() === "") return null;
  const str = String(value).trim();
  // Remove currency symbols and spaces
  let cleaned = str.replace(/[$€\s]/g, "");
  // Spanish: 1.234,56 or 6.000,00
  if (/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    return parseFloat(cleaned) || null;
  }
  // US format: 1,234.56
  if (/^\d{1,3}(,\d{3})*(\.\d{1,2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, "");
    return parseFloat(cleaned) || null;
  }
  // Plain number
  const num = parseFloat(cleaned.replace(/[^\d.-]/g, ""));
  return isNaN(num) ? null : num;
}

/**
 * Parse dd/mm/yyyy date string.
 */
export function parseDate(value: string | null | undefined): Date | null {
  if (value == null || String(value).trim() === "") return null;
  const str = String(value).trim();
  // dd/mm/yyyy or d/m/yyyy
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    const day = parseInt(d!, 10);
    const month = parseInt(m!, 10) - 1;
    const year = parseInt(y!, 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime()) && date.getDate() === day && date.getMonth() === month) {
      return date;
    }
  }
  // Try ISO format
  const iso = new Date(str);
  return isNaN(iso.getTime()) ? null : iso;
}

/**
 * Normalize operation label to OperationType.
 */
export function normalizeOperationType(value: string | null | undefined): OperationType | null {
  if (value == null || String(value).trim() === "") return null;
  const lower = String(value).trim().toLowerCase();
  if (lower.includes("recarga")) return "RECARGA";
  if (lower.includes("procesada")) return "PROCESADA";
  if (lower.includes("fee vzla") || lower.includes("fee vzl")) return "FEE_VZLA";
  if (lower.includes("fee merchant") || lower.includes("fee merch")) return "FEE_MERCHANT";
  return null;
}

/**
 * Format date to YYYY-MM-DD for DB.
 */
export function formatDateForDb(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

/**
 * Check if two dates are within ±1 day.
 */
export function datesWithinOneDay(d1: Date, d2: Date): boolean {
  const diff = Math.abs(d1.getTime() - d2.getTime());
  return diff <= 24 * 60 * 60 * 1000;
}
