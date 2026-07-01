import { describe, it, expect } from "vitest";
import { computeSaleTotals, computeStockDeltas, formatReceiptNo } from "./salesMath";
import type { SaleItem } from "../types";

function item(overrides: Partial<SaleItem> = {}): SaleItem {
  return {
    productId: "p1",
    productName: "Test Ürün",
    quantity: 1,
    price: 100,
    taxRate: 20,
    total: 100,
    ...overrides
  };
}

describe("computeSaleTotals", () => {
  it("KDV'yi (vergiyi) tutarın üzerine ekler (KDV hariç kanonik formül)", () => {
    // 100 TL (KDV hariç) + %20 KDV = 20 TL KDV, indirim yok
    const result = computeSaleTotals([item({ total: 100, taxRate: 20 })], 0);
    expect(result.totalAmount).toBe(100);
    expect(result.taxAmount).toBe(20);
    expect(result.netAmount).toBe(120);
  });

  it("birden fazla kalemi doğru toplar", () => {
    const items = [
      item({ productId: "p1", total: 100, taxRate: 20 }),
      item({ productId: "p2", total: 200, taxRate: 10 })
    ];
    const result = computeSaleTotals(items, 0);
    expect(result.totalAmount).toBe(300);
    expect(result.taxAmount).toBeCloseTo(20 + 20, 5); // 100*0.20 + 200*0.10
    expect(result.netAmount).toBeCloseTo(340, 5);
  });

  it("indirimi net tutardan düşer", () => {
    const result = computeSaleTotals([item({ total: 100, taxRate: 20 })], 30);
    // 100 + 20 - 30 = 90
    expect(result.netAmount).toBe(90);
  });

  it("net tutarın negatif olmasına izin vermez (indirim toplamdan büyükse 0'da durur)", () => {
    const result = computeSaleTotals([item({ total: 100, taxRate: 0 })], 500);
    expect(result.netAmount).toBe(0);
  });

  it("boş kalem listesinde her şeyi 0 döner", () => {
    const result = computeSaleTotals([], 0);
    expect(result).toEqual({ totalAmount: 0, taxAmount: 0, netAmount: 0 });
  });

  it("eksik/undefined total veya taxRate alanlarını 0 olarak ele alır", () => {
    const result = computeSaleTotals([{ ...item(), total: undefined as any, taxRate: undefined as any }], 0);
    expect(result.totalAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.netAmount).toBe(0);
  });
});

describe("computeStockDeltas", () => {
  it("miktar artınca negatif delta üretir (stoktan daha fazla düşülmeli)", () => {
    const oldItems = [item({ productId: "p1", quantity: 2 })];
    const newItems = [item({ productId: "p1", quantity: 5 })];
    const deltas = computeStockDeltas(oldItems, newItems);
    // before(2) - after(5) = -3 -> stoktan 3 birim daha düşülmeli
    expect(deltas.p1).toBe(-3);
  });

  it("miktar azalınca pozitif delta üretir (stoğa geri eklenmeli)", () => {
    const oldItems = [item({ productId: "p1", quantity: 5 })];
    const newItems = [item({ productId: "p1", quantity: 2 })];
    const deltas = computeStockDeltas(oldItems, newItems);
    // before(5) - after(2) = 3 -> stoğa 3 birim geri eklenmeli
    expect(deltas.p1).toBe(3);
  });

  it("değişmeyen kalemler için delta üretmez", () => {
    const oldItems = [item({ productId: "p1", quantity: 3 })];
    const newItems = [item({ productId: "p1", quantity: 3 })];
    const deltas = computeStockDeltas(oldItems, newItems);
    expect(deltas).toEqual({});
  });

  it("tamamen silinen bir kalem için stoğu tam geri ekler", () => {
    const oldItems = [item({ productId: "p1", quantity: 4 })];
    const newItems: SaleItem[] = [];
    const deltas = computeStockDeltas(oldItems, newItems);
    expect(deltas.p1).toBe(4);
  });

  it("yeni eklenen bir kalem için stoktan düşer", () => {
    const oldItems: SaleItem[] = [];
    const newItems = [item({ productId: "p9", quantity: 6 })];
    const deltas = computeStockDeltas(oldItems, newItems);
    expect(deltas.p9).toBe(-6);
  });

  it("aynı ürün birden fazla kalemde geçse bile miktarları birleştirir", () => {
    const oldItems = [
      item({ productId: "p1", quantity: 2 }),
      item({ productId: "p1", quantity: 3 })
    ];
    const newItems = [item({ productId: "p1", quantity: 4 })];
    const deltas = computeStockDeltas(oldItems, newItems);
    // before(2+3=5) - after(4) = 1
    expect(deltas.p1).toBe(1);
  });

  it("REGRESYON: stok senkron hatası - muhasebeci miktar düzenlediğinde stok her zaman doğru delta ile güncellenmeli", () => {
    // Orijinal bug: Accounting.jsx'te miktar düzenlenince stok HİÇ güncellenmiyordu.
    // Bu test, editItems akışının dayandığı computeStockDeltas'ın miktar
    // artışında/azalışında doğru işareti ürettiğini garanti eder.
    const originalSaleItems = [
      item({ productId: "prod-A", quantity: 10, price: 50, total: 500 }),
      item({ productId: "prod-B", quantity: 4, price: 20, total: 80 })
    ];
    const editedByAccounting = [
      item({ productId: "prod-A", quantity: 7, price: 50, total: 350 }), // 3 azaldı -> stoğa 3 geri
      item({ productId: "prod-B", quantity: 6, price: 20, total: 120 }) // 2 arttı -> stoktan 2 daha düş
    ];
    const deltas = computeStockDeltas(originalSaleItems, editedByAccounting);
    expect(deltas["prod-A"]).toBe(3);
    expect(deltas["prod-B"]).toBe(-2);
  });
});

describe("formatReceiptNo", () => {
  it("fiş numarasını TS-YYYY-NNNNN formatında üretir", () => {
    expect(formatReceiptNo(2026, 1)).toBe("TS-2026-00001");
    expect(formatReceiptNo(2026, 42)).toBe("TS-2026-00042");
    expect(formatReceiptNo(2025, 12345)).toBe("TS-2025-12345");
  });

  it("5 haneden büyük sıra numaralarını olduğu gibi (kesmeden) yazar", () => {
    expect(formatReceiptNo(2026, 123456)).toBe("TS-2026-123456");
  });
});
