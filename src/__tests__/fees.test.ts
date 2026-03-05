import { describe, it, expect } from "vitest";
import {
  computeFeeVzla,
  computeFeeMerchant,
  computeExpectedFees,
  feeMatchesExpected,
} from "../lib/utils/fees";

describe("computeFeeVzla", () => {
  it("computes 1.5% of amount", () => {
    expect(computeFeeVzla(100)).toBe(1.5);
    expect(computeFeeVzla(1000)).toBe(15);
  });
  it("rounds to 2 decimals", () => {
    expect(computeFeeVzla(33.33)).toBe(0.5);
  });
});

describe("computeFeeMerchant", () => {
  it("computes 1% of amount", () => {
    expect(computeFeeMerchant(100)).toBe(1);
    expect(computeFeeMerchant(1000)).toBe(10);
  });
});

describe("computeExpectedFees", () => {
  it("returns both fees", () => {
    const { feeVzla, feeMerchant } = computeExpectedFees(100);
    expect(feeVzla).toBe(1.5);
    expect(feeMerchant).toBe(1);
  });
});

describe("feeMatchesExpected", () => {
  it("returns true within 0.01 tolerance", () => {
    expect(feeMatchesExpected(1.5, 1.5)).toBe(true);
    expect(feeMatchesExpected(1.501, 1.5)).toBe(true);
    expect(feeMatchesExpected(1.495, 1.5)).toBe(true);
  });
  it("returns false outside tolerance", () => {
    expect(feeMatchesExpected(1.52, 1.5)).toBe(false);
  });
});
