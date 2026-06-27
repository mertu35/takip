import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Türkçe karakter dönüşümü (jsPDF Latin-1 encoding kullanır)
const tr = (text) =>
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

const fmt = (num) =>
  (num || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " TL";

export const generateInvoicePDF = (sale) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 18;

  // ─── HEADER ────────────────────────────────────────────────────────────────
  // Şirket adı
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 82, 186);
  doc.text("OZKON CELIK", margin, 22);

  // Şirket bilgileri
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("Merkez Mah. Celik Sanayi Bulvari No: 45 Sarıyer / Istanbul", margin, 28);
  doc.text("Tel: 0212 999 88 77  |  VD: Maslak  |  VN: 654 098 7654", margin, 32.5);

  // Sağ üst köşe: FATURA / FIS
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  const title = sale.status === "approved" ? "PROFORMA FATURA" : "SATIS FISI";
  doc.text(title, W - margin, 22, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Fis No : ${tr(sale.receiptNo)}`, W - margin, 28, { align: "right" });
  doc.text(`Tarih  : ${new Date(sale.date || sale.createdAt).toLocaleDateString("tr-TR")}`, W - margin, 33, { align: "right" });

  // ─── AYRAÇ ─────────────────────────────────────────────────────────────────
  doc.setDrawColor(15, 82, 186);
  doc.setLineWidth(0.6);
  doc.line(margin, 37, W - margin, 37);

  // ─── MÜŞTERİ / SATIŞÇI BİLGİLERİ ──────────────────────────────────────────
  const infoY = 44;
  // Sol: Müşteri
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("MUSTERI", margin, infoY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(tr(sale.customerCompany || ""), margin, infoY + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  doc.text(tr(`Yetkili: ${sale.customerName || ""}`), margin, infoY + 10);

  // Sağ: Satışçı + Durum
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("SATIS TEMSILCISI", W / 2 + 10, infoY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text(tr(sale.salespersonName || ""), W / 2 + 10, infoY + 5);

  const statusText =
    sale.status === "approved"
      ? "ONAYLANDI"
      : sale.status === "rejected"
      ? "REDDEDILDI"
      : "ONAY BEKLIYOR";
  const statusColor =
    sale.status === "approved"
      ? [22, 163, 74]
      : sale.status === "rejected"
      ? [220, 38, 38]
      : [217, 119, 6];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...statusColor);
  doc.text(`Durum: ${statusText}`, W / 2 + 10, infoY + 11);

  // ─── ÜRÜN TABLOSU ──────────────────────────────────────────────────────────
  const tableStartY = infoY + 20;

  const rows = (sale.items || []).map((item, idx) => [
    idx + 1,
    tr(item.productName),
    tr(item.productCode || ""),
    item.quantity,
    `${(item.price || 0).toFixed(2)} TL`,
    `%${item.taxRate ?? 20}`,
    `${(item.total || 0).toFixed(2)} TL`,
  ]);

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: [["#", "Urun Adi", "Kod", "Adet", "Birim Fiyat", "KDV", "Toplam"]],
    body: rows,
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2.5 },
    headStyles: {
      fillColor: [15, 82, 186],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8.5,
    },
    alternateRowStyles: { fillColor: [245, 247, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      2: { cellWidth: 22 },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 26, halign: "right" },
      5: { cellWidth: 16, halign: "center" },
      6: { cellWidth: 26, halign: "right" },
    },
  });

  // ─── TOPLAM BÖLÜMÜ ─────────────────────────────────────────────────────────
  const afterTableY = doc.lastAutoTable.finalY + 6;
  const totalX = W - margin - 60;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);

  const addTotalRow = (label, value, y, bold = false, color = [30, 30, 30]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 10 : 9);
    doc.setTextColor(...color);
    doc.text(label, totalX, y);
    doc.text(value, W - margin, y, { align: "right" });
    return y + 6;
  };

  let ty = afterTableY;
  ty = addTotalRow("Ara Toplam (KDV Haric):", fmt(sale.totalAmount), ty);
  ty = addTotalRow("Toplam KDV:", fmt(sale.taxAmount), ty);
  if ((sale.discountAmount || 0) > 0) {
    ty = addTotalRow(`Iskonto:`, `-${fmt(sale.discountAmount)}`, ty, false, [220, 38, 38]);
  }

  // Toplam kutusu
  doc.setFillColor(15, 82, 186);
  doc.roundedRect(totalX - 4, ty - 1, W - margin - totalX + 4, 10, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text("GENEL TOPLAM:", totalX, ty + 6.5);
  doc.text(fmt(sale.netAmount), W - margin, ty + 6.5, { align: "right" });

  // ─── NOTLAR ────────────────────────────────────────────────────────────────
  if (sale.notes) {
    const notesY = ty + 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    doc.text("Notlar:", margin, notesY);
    doc.setFont("helvetica", "normal");
    const splitNotes = doc.splitTextToSize(tr(sale.notes), W - margin * 2 - 15);
    doc.text(splitNotes, margin + 15, notesY);
  }

  // ─── İMZA ALANI ────────────────────────────────────────────────────────────
  const signY = Math.max(ty + (sale.notes ? 32 : 20), 230);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);

  const addSignBox = (label, x) => {
    doc.line(x, signY + 14, x + 50, signY + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text(label, x + 25, signY + 18, { align: "center" });
  };

  addSignBox("Teslim Eden", margin);
  addSignBox("Teslim Alan", W - margin - 50);

  // ─── FOOTER ────────────────────────────────────────────────────────────────
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    "Bu belge Ozkon Celik Takip Sistemi tarafindan olusturulmustur.",
    W / 2,
    footerY,
    { align: "center" }
  );
  doc.text(`Olusturulma: ${new Date().toLocaleString("tr-TR")}`, W / 2, footerY + 4, { align: "center" });

  // ─── İNDİR ─────────────────────────────────────────────────────────────────
  doc.save(`${sale.receiptNo || "fatura"}.pdf`);
};
