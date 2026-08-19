import { describe, it, expect } from "vitest";
import { formatCurrency, formatNumber, formatDate, formatDateTime } from "./format";

describe("formatCurrency", () => {
  it("sayıyı Türkçe para birimi formatında döndürür", () => {
    const formatted = formatCurrency(1250.5);
    // tr-TR locale renders non-breaking space or standard space before ₺
    expect(formatted).toMatch(/1\.250,50/);
    expect(formatted).toContain("₺");
  });

  it("0 için 0,00 ₺ döndürür", () => {
    expect(formatCurrency(0)).toMatch(/0,00/);
  });

  it("null veya undefined değerleri güvenle 0,00 ₺ olarak ele alır", () => {
    expect(formatCurrency(null)).toMatch(/0,00/);
    expect(formatCurrency(undefined)).toMatch(/0,00/);
    expect(formatCurrency(NaN)).toMatch(/0,00/);
  });
});

describe("formatNumber", () => {
  it("sayıyı belirtilen ondalıkla biçimlendirir", () => {
    expect(formatNumber(1234.567, 2)).toBe("1.234,57");
    expect(formatNumber(1234, 0)).toBe("1.234");
  });

  it("null veya undefined değerleri 0 olarak ele alır", () => {
    expect(formatNumber(null)).toBe("0,00");
    expect(formatNumber(undefined)).toBe("0,00");
  });
});

describe("formatDate", () => {
  it("ISO tarih dizgesini GG.AA.YYYY formatında döndürür", () => {
    const result = formatDate("2026-08-19T10:00:00.000Z");
    expect(result).toMatch(/\d{1,2}\.\d{1,2}\.2026/);
  });

  it("geçersiz veya boş tarihte '-' döndürür", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate("")).toBe("-");
    expect(formatDate("invalid-date")).toBe("-");
  });
});

describe("formatDateTime", () => {
  it("tarih ve saati Türkçe formatında döndürür", () => {
    const result = formatDateTime("2026-08-19T10:30:00.000Z");
    expect(result).toContain("2026");
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it("geçersiz veya boş tarihte '-' döndürür", () => {
    expect(formatDateTime(null)).toBe("-");
    expect(formatDateTime(undefined)).toBe("-");
    expect(formatDateTime("geçersiz")).toBe("-");
  });
});
