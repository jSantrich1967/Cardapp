/**
 * Fee calculation logic for PROCESADA transactions.
 * FEE VZLA = 1.5%, FEE MERCHANT = 1%
 */

export function computeFeeVzla(amount: number): number {
  return Math.round(amount * 0.015 * 100) / 100;
}

export function computeFeeMerchant(amount: number): number {
  return Math.round(amount * 0.01 * 100) / 100;
}

export function computeExpectedFees(procesadaAmount: number): {
  feeVzla: number;
  feeMerchant: number;
} {
  return {
    feeVzla: computeFeeVzla(procesadaAmount),
    feeMerchant: computeFeeMerchant(procesadaAmount),
  };
}

/**
 * Check if a fee amount matches expected (within 0.01 tolerance).
 */
export function feeMatchesExpected(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= 0.01;
}
