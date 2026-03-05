/**
 * Compute running balance per card from transactions in chronological order.
 *
 * CONVENCIÓN DE SIGNOS:
 * - RECARGA: monto positivo → suma al saldo
 * - PROCESADA, FEE_VZLA, FEE_MERCHANT: monto negativo → resta del saldo
 */

/**
 * Returns map of transaction id -> running balance after that transaction.
 * Uses the order of the array as given (caller must pass correctly ordered list).
 * Recarga (positive) adds, Procesada/Fees (negative) subtract.
 */
export function computeRunningBalance(
  transactions: Array<{ id?: string; date: string; operationType?: string; amount: string }>
): Map<string, number> {
  let balance = 0;
  const result = new Map<string, number>();
  for (const t of transactions) {
    balance += Number(t.amount);
    const key = t.id ?? `${t.date}-${t.operationType ?? ""}-${t.amount}`;
    result.set(key, balance);
  }
  return result;
}

/**
 * Returns map of transaction id -> running balance per card (for multiple cards).
 * Uses the order of the array as given (caller must pass correctly ordered list).
 */
export function computeRunningBalancePerCard(
  transactions: Array<{ id?: string; cardId?: string; date: string; amount: string }>
): Map<string, number> {
  const balanceByCard = new Map<string, number>();
  const result = new Map<string, number>();
  for (const t of transactions) {
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
