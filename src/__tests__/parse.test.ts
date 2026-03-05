import { describe, it, expect } from "vitest";
import { parseAmount, parseDate, normalizeOperationType, formatDateForDb } from "../lib/utils/parse";

describe("parseAmount", () => {
  it("parses Spanish format 6.000,00", () => {
    expect(parseAmount("6.000,00")).toBe(6000);
  });
  it("parses Spanish format 1.234,56", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56);
  });
  it("parses Spanish comma decimal without thousands (1234,56)", () => {
    expect(parseAmount("1234,56")).toBe(1234.56);
    expect(parseAmount("12345,67")).toBe(12345.67);
  });
  it("parses plain number", () => {
    expect(parseAmount("100")).toBe(100);
  });
  it("parses with currency symbol", () => {
    expect(parseAmount("$50.00")).toBe(50);
  });
  it("returns null for empty", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });
});

describe("parseDate", () => {
  it("parses dd/mm/yyyy", () => {
    const d = parseDate("15/03/2024");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getDate()).toBe(15);
    expect(d!.getMonth()).toBe(2);
    expect(d!.getFullYear()).toBe(2024);
  });
  it("parses d/m/yyyy", () => {
    const d = parseDate("5/1/2024");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getDate()).toBe(5);
    expect(d!.getMonth()).toBe(0);
  });
  it("returns null for invalid", () => {
    expect(parseDate("invalid")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

describe("normalizeOperationType", () => {
  it("recognizes Recarga", () => {
    expect(normalizeOperationType("Recarga")).toBe("RECARGA");
    expect(normalizeOperationType("recarga")).toBe("RECARGA");
  });
  it("recognizes Procesada", () => {
    expect(normalizeOperationType("Procesada")).toBe("PROCESADA");
  });
  it("recognizes Fee Vzla", () => {
    expect(normalizeOperationType("Fee Vzla")).toBe("FEE_VZLA");
    expect(normalizeOperationType("Fee Vzla;")).toBe("FEE_VZLA");
  });
  it("recognizes Fee Merchant", () => {
    expect(normalizeOperationType("Fee Merchant")).toBe("FEE_MERCHANT");
  });
  it("returns null for unknown", () => {
    expect(normalizeOperationType("Other")).toBeNull();
  });
});

describe("formatDateForDb", () => {
  it("formats to YYYY-MM-DD", () => {
    expect(formatDateForDb(new Date(2024, 2, 15))).toBe("2024-03-15");
  });
});
