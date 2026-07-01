import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Sale, CompanyProfile } from "../types";

// Türkçe karakter dönüşümü (jsPDF Latin-1 encoding kullanır)
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

export const generateInvoicePDF = (sale: Sale, companyProfile?: CompanyProfile | null) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 18;

  const companyName = tr(companyProfile?.companyName || "OZKON CELIK");
  const address = tr(companyProfile?.address || "Merkez Mah. Celik Sanayi Bulvari No: 45 Sarıyer / Istanbul");
  const phone = companyProfile?.phone || "0212 999 88 77";
  const fax = companyProfile?.fax;
  const taxOffice = tr(companyProfile?.taxOffice || "Maslak");
  const taxNumber = companyProfile?.taxNumber || "6540987654";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 82, 186);
  doc.text(companyName, margin, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(address, margin, 28);

  const telFaxText = `Tel: ${phone}${fax ? `  |  Faks: ${fax}` : ""}`;
  const vdVnText = `VD: ${taxOffice}  |  VN: ${taxNumber}`;
  doc.text(`${telFaxText}  |  ${vdVnText}`, margin, 32.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  const title = sale.status === "approved" ? "PROFORMA FATURA" : "SATIS FISI";
  doc.text(title, W - margin, 22, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Fis No : ${tr(sale.receiptNo)}`, W - margin, 28, { align: "right" });
  doc.text(`Tarih  : ${new Date(sale.date || sale.createdAt || Date.now()).toLocaleDateString("tr-TR")}`, W - margin, 33, { align: "right" });

  doc.setDrawColor(15, 82, 186);
  doc.setLineWidth(0.6);
  doc.line(margin, 37, W - margin, 37);

  const infoY = 44;
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
  const statusColor: [number, number, number] =
    sale.status === "approved"
      ? [22, 163, 74]
      : sale.status === "rejected"
      ? [220, 38, 38]
      : [217, 119, 6];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...statusColor);
  doc.text(`Durum: ${statusText}`, W / 2 + 10, infoY + 11);

  const tableStartY = infoY + 20;

  const rows = (sale.items || []).map((item, idx) => [
    idx + 1,
    tr(item.productName),
    tr(item.productCode || ""),
    item.quantity,
    `${(item.price || 0).toFixed(2)} TL`,
    `%${item.taxRate ?? 20}`,
    `${(item.total || 0).toFixed(2)} TL`
  ]);

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: [["#", "Urun Adi", "Kod", "Adet", "Birim Fiyat", "KDV", "Toplam"]],
    body: rows as any,
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2.5 },
    headStyles: {
      fillColor: [15, 82, 186],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8.5
    },
    alternateRowStyles: { fillColor: [245, 247, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      2: { cellWidth: 22 },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 26, halign: "right" },
      5: { cellWidth: 16, halign: "center" },
      6: { cellWidth: 26, halign: "right" }
    }
  });

  const afterTableY = (doc as any).lastAutoTable.finalY + 6;
  const totalX = W - margin - 60;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);

  const addTotalRow = (label: string, value: string, y: number, bold = false, color: [number, number, number] = [30, 30, 30]) => {
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

  doc.setFillColor(15, 82, 186);
  doc.roundedRect(totalX - 4, ty - 1, W - margin - totalX + 4, 10, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text("GENEL TOPLAM:", totalX, ty + 6.5);
  doc.text(fmt(sale.netAmount), W - margin, ty + 6.5, { align: "right" });

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

  const signY = Math.max(ty + (sale.notes ? 32 : 20), 230);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);

  const addSignBox = (label: string, x: number) => {
    doc.line(x, signY + 14, x + 50, signY + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text(label, x + 25, signY + 18, { align: "center" });
  };

  addSignBox("Teslim Eden", margin);
  addSignBox("Teslim Alan", W - margin - 50);

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

  doc.save(`${sale.receiptNo || "fatura"}.pdf`);
};
