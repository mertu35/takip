import { jsPDF } from "jspdf";
import type { Payment, CompanyProfile } from "../types";
import { PAYMENT_METHOD_LABELS } from "./salesMath";

// Türkçe karakter dönüşümü (jsPDF varsayılan Latin-1 encoding için)
const tr = (text?: string | null) =>
  (text || "")
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .replace(/Ş/g, "S")
    .replace(/ş/g, "s")
    .replace(/Ğ/g, "G")
    .replace(/ğ/g, "g")
    .replace(/Ü/g, "U")
    .replace(/ü/g, "u")
    .replace(/Ö/g, "O")
    .replace(/ö/g, "o")
    .replace(/Ç/g, "C")
    .replace(/ç/g, "c");

const fmt = (num?: number) =>
  (num || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " TL";

export const generatePaymentPDF = (payment: Payment, companyProfile?: CompanyProfile | null) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" }); // A5 formatında şık makbuz
  const W = doc.internal.pageSize.getWidth();
  const margin = 14;

  const companyName = tr(companyProfile?.companyName || "OZKON YAPI & CELIK");
  const address = tr(companyProfile?.address || "Merkez Mah. Celik Sanayi Bulvari No: 45 Sarıyer / Istanbul");
  const phone = companyProfile?.phone || "0212 999 88 77";
  const taxOffice = tr(companyProfile?.taxOffice || "Maslak");
  const taxNumber = companyProfile?.taxNumber || "6540987654";

  // Başlık / Logo Alanı
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 82, 186); // primary blue
  doc.text(companyName, margin, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text(address, margin, 23);
  doc.text(`Tel: ${phone}  |  VD: ${taxOffice}  |  VN: ${taxNumber}`, margin, 27);

  // Belge Tipi
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text("TAHSILAT MAKBUZU", W - margin, 18, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`Makbuz No: ${tr(payment.receiptNo)}`, W - margin, 23, { align: "right" });
  doc.text(`Tarih: ${new Date(payment.date || payment.createdAt || Date.now()).toLocaleDateString("tr-TR")}`, W - margin, 27, { align: "right" });

  doc.setDrawColor(15, 82, 186);
  doc.setLineWidth(0.5);
  doc.line(margin, 31, W - margin, 31);

  // Müşteri & Ödeme Bilgileri Kutusu
  const startY = 38;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, startY, W - margin * 2, 42, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text("ODEME YAPAN (MUSTERI / FIRMA)", margin + 4, startY + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(tr(payment.customerCompany || ""), margin + 4, startY + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(tr(`Yetkili / Muhatap: ${payment.customerName || "-"}`), margin + 4, startY + 17);

  // Sağ taraf: Ödeme Yöntemi & Detaylar
  const col2X = margin + (W - margin * 2) * 0.55;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text("ODEME SEKLİ", col2X, startY + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 82, 186);
  doc.text(tr(PAYMENT_METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod), col2X, startY + 12);

  if (payment.checkNumber) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`Cek/Senet No: ${tr(payment.checkNumber)}`, col2X, startY + 17);
  }
  if (payment.dueDate) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`Vade: ${new Date(payment.dueDate).toLocaleDateString("tr-TR")}`, col2X, startY + 22);
  }

  // Notlar
  if (payment.notes) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text(tr(`Aciklama: ${payment.notes}`), margin + 4, startY + 36);
  }

  // Tahsil Edilen Tutar Vurgusu
  const amountBoxY = startY + 48;
  doc.setFillColor(238, 242, 255);
  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, amountBoxY, W - margin * 2, 22, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(67, 56, 202);
  doc.text("TAHSIL EDILEN NET TUTAR", margin + 6, amountBoxY + 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 82, 186);
  doc.text(fmt(payment.amount), W - margin - 6, amountBoxY + 15, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text("Yalnizca yukaridaki tutar cari hesabiniza alacak olarak islenmistir.", margin + 6, amountBoxY + 16);

  // İmza Alanları
  const signY = amountBoxY + 36;
  const colW = (W - margin * 2) / 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text("TESLIM EDEN", margin + 15, signY);
  doc.text("TESLIM ALAN (TAHSILDAR)", margin + colW + 15, signY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text(tr(payment.customerName || payment.customerCompany), margin + 15, signY + 5);
  doc.text(tr(payment.createdByName || "Yetkili"), margin + colW + 15, signY + 5);

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(margin + 10, signY + 20, margin + colW - 10, signY + 20);
  doc.line(margin + colW + 10, signY + 20, W - margin - 10, signY + 20);

  doc.setFontSize(6.5);
  doc.text("İmza / Kase", margin + 25, signY + 24);
  doc.text("İmza / Kase", margin + colW + 25, signY + 24);

  // Alt Bilgi
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Bu tahsilat makbuzu Ozkon Takip Sistemi tarafindan otomatik olusturulmustur. Belge No: ${payment.receiptNo}`,
    W / 2,
    doc.internal.pageSize.getHeight() - 8,
    { align: "center" }
  );

  doc.save(`Tahsilat_Makbuzu_${payment.receiptNo}.pdf`);
};
