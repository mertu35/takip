// Takip Sistemi - Satış Hesaplama Yardımcıları (Saf Fonksiyonlar)
//
// ÖNEMLİ: Bu dosyadaki fonksiyonlar hiçbir yan etkiye (Firestore/LocalStorage
// erişimi) sahip değildir. Amaç, satış tutarı ve stok hesaplamalarının TEK
// bir yerde tanımlanması: eskiden bu hesap Sales.jsx, Accounting.jsx ve
// db.js içinde üç ayrı yerde -ve birbiriyle TUTARSIZ ŞEKİLDE- tekrarlanıyordu:
//   - Sales.jsx (satış oluşturma): fiyatların KDV HARİÇ olduğunu varsayıp
//     taxAmount'u üstüne ekliyordu (doğru/kanonik yöntem, README ile uyumlu).
//   - Sales.jsx (kendi sepetini düzenleme) ve db.js#resubmitSale: fiyatların
//     KDV DAHİL olduğunu varsayıp taxAmount'u toplamın içinden çıkarıyordu.
// Bu iki farklı formül aynı alanlar (totalAmount/taxAmount/netAmount) için
// kullanıldığından, aynı satış farklı ekranlarda farklı KDV/net tutar
// gösterebiliyordu. Artık tüm çağıranlar bu dosyadaki tek fonksiyonu kullanır.

import type { SaleItem } from "../types";

export interface SaleTotals {
  totalAmount: number;
  taxAmount: number;
  netAmount: number;
}

/**
 * Satış kalemlerinden toplamları hesaplar.
 * Kanonik kural (README ve orijinal satış oluşturma akışıyla uyumlu):
 * item.price / item.total KDV HARİÇ tutardır; KDV bunun üzerine eklenir.
 */
export function computeSaleTotals(items: SaleItem[], discountAmount: number): SaleTotals {
  const totalAmount = items.reduce((sum, item) => sum + (item.total || 0), 0);
  const taxAmount = items.reduce(
    (sum, item) => sum + (item.total || 0) * ((item.taxRate || 0) / 100),
    0
  );
  const netAmount = Math.max(0, totalAmount + taxAmount - (discountAmount || 0));
  return { totalAmount, taxAmount, netAmount };
}

/**
 * İki kalem listesi arasındaki miktar farkını, ürün bazında stoğa
 * uygulanması gereken değişiklik (delta) olarak döndürür.
 *
 * delta = eskiMiktar - yeniMiktar
 *   - yeni miktar eskisinden BÜYÜKSE (daha fazla satıldıysa) delta NEGATİF
 *     olur -> stoktan bir miktar daha düşülmeli.
 *   - yeni miktar eskisinden KÜÇÜKSE (satış azaldıysa) delta POZİTİF olur
 *     -> stoğa bir miktar geri eklenmeli.
 *
 * Kullanım: newStock = currentStock + delta
 *
 * Bu fonksiyon, muhasebecinin "Miktarları Düzenle" ile bir satıştaki
 * adetleri değiştirmesi durumunda stoğun gerçek depo durumuyla senkron
 * kalmasını sağlamak için eklendi (önceden bu senkronizasyon hiç
 * yapılmıyordu — bkz. proje incelemesi).
 */
export function computeStockDeltas(
  oldItems: SaleItem[],
  newItems: SaleItem[]
): Record<string, number> {
  const oldQty: Record<string, number> = {};
  for (const item of oldItems) {
    oldQty[item.productId] = (oldQty[item.productId] || 0) + item.quantity;
  }

  const newQty: Record<string, number> = {};
  for (const item of newItems) {
    newQty[item.productId] = (newQty[item.productId] || 0) + item.quantity;
  }

  const productIds = new Set([...Object.keys(oldQty), ...Object.keys(newQty)]);
  const deltas: Record<string, number> = {};

  for (const productId of productIds) {
    const before = oldQty[productId] || 0;
    const after = newQty[productId] || 0;
    const delta = before - after;
    if (delta !== 0) {
      deltas[productId] = delta;
    }
  }

  return deltas;
}

/** Fiş numarası oluşturur: TS-YYYY-NNNNN */
export function formatReceiptNo(year: number, sequence: number): string {
  return `TS-${year}-${String(sequence).padStart(5, "0")}`;
}
