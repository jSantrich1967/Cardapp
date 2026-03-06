/**
 * Normaliza cualquier fecha a clave YYYY-MM-DD para lookup consistente.
 * Evita incongruencias entre Resultados e Histórico de tasas.
 */
export function normalizeDateKey(dateStr: string): string {
  const s = String(dateStr ?? "").trim();
  const part = s.split("T")[0] ?? s;
  // Manejar guiones o slashes
  const parts = part.split(/[-/]/);
  if (parts.length !== 3) return part;

  // Si viene como DD-MM-YYYY (común en algunos imports)
  if (parts[0].length === 2 && parts[2].length === 4) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Asumir YYYY-MM-DD
  const [y, m, d] = parts;
  if (!y || !m || !d) return part;
  return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function normalizeRatesMap(
  rates: Record<string, unknown>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(rates)) {
    const key = normalizeDateKey(k);
    const num = Number(String(v).replace(",", "."));
    if (key && /^\d{4}-\d{2}-\d{2}$/.test(key) && !isNaN(num) && num > 0) {
      out[key] = num;
    }
  }
  return out;
}
