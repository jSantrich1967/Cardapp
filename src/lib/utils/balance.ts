/**
 * Compute running balance per card from transactions in chronological order.
 * RECARGA increases, PROCESADA/FEEs decrease.
 */

import type { OperationType } from "./parse";

/** Returns map of transaction id (or date if no id) -> running balance after that transaction */
export function computeRunningBalance(
  transactions: Array<{ id?: string; date: string; operationType: OperationType; amount: string }>
): Map<string, number> {
  const sorted = [...transactions].sort(
    (a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime() ||
      (a.id || "").localeCompare(b.id || "")
  );
  let balance = 0;
  const result = new Map<string, number>();
  for (const t of sorted) {
    balance += Number(t.amount);
    const key = t.id ?? `${t.date}-${t.operationType}-${t.amount}`;
    result.set(key, balance);
  }
  return result;
}

export function getCurrentBalance(
  transactions: Array<{ amount: string }>
): number {
  return transactions.reduce((sum, t) => sum + Number(t.amount), 0);
}
