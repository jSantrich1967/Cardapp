/**
 * Compute running balance per card from transactions in chronological order.
 *
 * CONVENCIÓN DE SIGNOS:
 * - RECARGA: monto positivo → suma al saldo
 * - PROCESADA, FEE_VZLA, FEE_MERCHANT: monto negativo → resta del saldo
 */

import type { OperationType } from "./parse";

/** Returns map of transaction id -> running balance after that transaction (single card) */
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

/** Returns map of transaction id -> running balance per card (for multiple cards) */
export function computeRunningBalancePerCard(
  transactions: Array<{ id?: string; cardId?: string; date: string; amount: string }>
): Map<string, number> {
  const sorted = [...transactions].sort(
    (a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime() ||
      (a.id || "").localeCompare(b.id || "")
  );
  const balanceByCard = new Map<string, number>();
  const result = new Map<string, number>();
  for (const t of sorted) {
    const cardId = t.cardId ?? "default";
    const current = balanceByCard.get(cardId) ?? 0;
    const newBalance = current + Number(t.amount);
    balanceByCard.set(cardId, newBalance);
    const key = t.id ?? `${t.date}-${t.amount}`;
    result.set(key, newBalance);
  }
  return result;
}

export function getCurrentBalance(
  transactions: Array<{ amount: string }>
): number {
  return transactions.reduce((sum, t) => sum + Number(t.amount), 0);
}
