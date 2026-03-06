/**
 * Data normalization and parsing utilities for CardOps.
 * Handles Spanish number format, dates, and operation type normalization.
 */

export type OperationType = "RECARGA" | "PROCESADA" | "FEE_VZLA" | "FEE_MERCHANT";

/**
 * Parse Spanish-formatted amount to number.
 * Examples: "6.000,00" -> 6000, "1.234,56" -> 1234.56, "1234,56" -> 1234.56, "100" -> 100
 */
export function parseAmount(value: string | null | undefined): number | null {
  if (value == null || String(value).trim() === "") return null;
  const str = String(value).trim();
  // Remove currency symbols and spaces
  let cleaned = str.replace(/[$€\s]/g, "");
  // Handle negative (leading minus or parentheses)
  const isNegative = cleaned.startsWith("-") || /^\([^)]+\)$/.test(cleaned);
  if (isNegative) cleaned = cleaned.replace(/^[-()]|[)]$/g, "").trim();
  // Spanish with thousands: 1.234,56 or 6.000,00
  if (/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(cleaned) || null;
    return n != null && isNegative ? -n : n;
  }
  // Spanish comma as decimal, no thousands: 1234,56 or 12345,67 (OCR often omits thousands dot)
  if (/^\d+,\d{1,2}$/.test(cleaned)) {
    const n = parseFloat(cleaned.replace(",", ".")) || null;
    return n != null && isNegative ? -n : n;
  }
  // US format: 1,234.56
  if (/^\d{1,3}(,\d{3})*(\.\d{1,2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, "");
    const n = parseFloat(cleaned) || null;
    return n != null && isNegative ? -n : n;
  }
  // Plain number (no comma, or dot as decimal)
  const num = parseFloat(cleaned.replace(/[^\d.-]/g, ""));
  const result = isNaN(num) ? null : num;
  return result != null && isNegative ? -result : result;
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
/**
 * Format date to YYYY-MM-DD for DB using local date components to avoid timezone shifts.
 */
export function formatDateForDb(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Check if two dates are within ±1 day.
 */
export function datesWithinOneDay(d1: Date, d2: Date): boolean {
  const diff = Math.abs(d1.getTime() - d2.getTime());
  return diff <= 24 * 60 * 60 * 1000;
}
