import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Proposal, CompanyProfile } from "../types";

// Türkçe karakter desteği için güvenli dönüştürücü
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
  (num || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL";

export const generateProposalPDF = (
  proposal: Proposal,
  companyProfile?: CompanyProfile | null
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 14;

  const companyName = tr(companyProfile?.companyName || "OZKON YAPI INSAAT LTD. STI.");
  const address = tr(companyProfile?.address || "Valide Sultan Mah. 100. Yil Cad. No:74/B Karaman-Merkez");
  const phone = companyProfile?.phone || "0338 213 76 67";
  const fax = companyProfile?.fax || "0338 213 33 43";
  const taxOffice = tr(companyProfile?.taxOffice || "Karaman");
  const taxNumber = companyProfile?.taxNumber || "7000074860";

  // --- 1. ÜST BAŞLIK & ANTET ALANI ---

  // Sol: Şirket Logo & Bilgileri
  doc.setFillColor(30, 90, 160); // Özkon Royal Blue
  doc.roundedRect(margin, 12, 10, 10, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("O", margin + 2.8, 19.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 45, 90);
  doc.text(companyName, margin + 14, 17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text(address, margin + 14, 21.5);
  doc.text(`TEL: ${phone}   FAX: ${fax}`, margin + 14, 25.5);
  doc.text(`info@ozkongrup.com   VD: ${taxOffice} / VKN: ${taxNumber}`, margin + 14, 29.5);

  // Sağ: TEKLİF MEKTUBU Başlığı ve Meta Bilgileri
  const rightX = W - margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 90, 160);
  doc.text("TEKLIF MEKTUBU", rightX, 17, { align: "right" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(70, 70, 70);

  const metaStartY = 22;
  const col1X = W - 65;
  const col2X = rightX;

  doc.text("Tarih:", col1X, metaStartY);
  doc.setFont("helvetica", "normal");
  doc.text(proposal.date || new Date().toLocaleDateString("tr-TR"), col2X, metaStartY, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.text("Gecerlilik:", col1X, metaStartY + 4);
  doc.setFont("helvetica", "normal");
  doc.text(proposal.validUntil || "-", col2X, metaStartY + 4, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.text("Teklif No:", col1X, metaStartY + 8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 90, 160);
  doc.text(proposal.proposalNo, col2X, metaStartY + 8, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(70, 70, 70);
  doc.text("Yetkili:", col1X, metaStartY + 12);
  doc.setFont("helvetica", "normal");
  doc.text(tr(proposal.salespersonName || "Abdullah Mete"), col2X, metaStartY + 12, { align: "right" });

  if (proposal.salespersonPhone) {
    doc.setFont("helvetica", "bold");
    doc.text("Tel:", col1X, metaStartY + 16);
    doc.setFont("helvetica", "normal");
    doc.text(proposal.salespersonPhone, col2X, metaStartY + 16, { align: "right" });
  }

  // Ayırıcı çizgi
  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.5);
  doc.line(margin, 42, W - margin, 42);

  // --- 2. MÜŞTERİ BİLGİLERİ ---
  doc.setFillColor(245, 248, 253);
  doc.roundedRect(margin, 45, W - 2 * margin, 18, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 90, 160);
  doc.text("MUSTERI BILGILERI", margin + 4, 50);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 25, 35);
  const custTitle = tr(proposal.customerCompany || proposal.customerName || "Sayin Musteri");
  doc.text(custTitle, margin + 4, 55.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  const contactInfo = [
    proposal.customerPhone ? `Tel: ${proposal.customerPhone}` : "",
    proposal.customerAddress ? `Adres: ${tr(proposal.customerAddress)}` : ""
  ].filter(Boolean).join("   |   ");

  if (contactInfo) {
    doc.text(contactInfo, margin + 4, 60);
  }

  // --- 3. KALEMLER TABLOSU ---
  const tableData = proposal.items.map((item, idx) => [
    idx + 1,
    tr(item.description),
    item.quantity.toLocaleString("tr-TR"),
    tr(item.unit || "ADET"),
    fmt(item.price),
    fmt(item.total || (item.quantity * item.price))
  ]);

  autoTable(doc, {
    startY: 66,
    margin: { left: margin, right: margin },
    head: [["#", "Urun / Hizmet Aciklamasi", "Miktar", "Birim", "Birim Fiyat", "Toplam"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [30, 90, 160], // Özkon Blue
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "left"
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      lineColor: [230, 235, 245],
      lineWidth: 0.2
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: "auto", halign: "left", fontStyle: "bold" },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 26, halign: "right" },
      5: { cellWidth: 28, halign: "right", fontStyle: "bold" }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 254]
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 4;

  // --- 4. ALT TOPLAM VE GENEL TOPLAM KUTUSU ---
  const summaryBoxWidth = 75;
  const summaryBoxX = W - margin - summaryBoxWidth;
  let currY = finalY;

  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);

  doc.setFont("helvetica", "normal");
  doc.text("Ara Toplam:", summaryBoxX, currY + 4);
  doc.text(fmt(proposal.subtotal), rightX, currY + 4, { align: "right" });

  if ((proposal.discountAmount || 0) > 0) {
    currY += 5;
    doc.text("Iskonto / Indirim:", summaryBoxX, currY + 4);
    doc.text("-" + fmt(proposal.discountAmount), rightX, currY + 4, { align: "right" });
  }

  if ((proposal.taxAmount || 0) > 0) {
    currY += 5;
    doc.text("Hesaplanan KDV:", summaryBoxX, currY + 4);
    doc.text(fmt(proposal.taxAmount), rightX, currY + 4, { align: "right" });
  }

  currY += 6;
  doc.setFillColor(235, 243, 255);
  doc.roundedRect(summaryBoxX - 2, currY, summaryBoxWidth + 2, 8, 1, 1, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 90, 160);
  doc.text("GENEL TOPLAM:", summaryBoxX + 2, currY + 5.5);
  doc.text(fmt(proposal.totalAmount), rightX - 2, currY + 5.5, { align: "right" });

  // --- 5. NOTLAR & SATIŞ ŞARTLARI ---
  const notesY = Math.max(finalY, currY + 12);
  const notesHeight = 28;

  doc.setFillColor(242, 246, 252);
  doc.roundedRect(margin, notesY, W - 2 * margin, notesHeight, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 90, 160);
  doc.text("NOTLAR & SATIS SARTLARI", margin + 4, notesY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(70, 70, 70);

  const defaultTerms = proposal.termsAndConditions || proposal.notes || "1. Fiyatlarimiza KDV dahil degildir.\n2. Teklifimiz belirtilen gecerlilik tarihine kadar gecerlidir.\n3. Nakliye ve bosaltma sartlari teklif kapsamindadir.";
  const splitNotes = doc.splitTextToSize(tr(defaultTerms), W - 2 * margin - 8);
  doc.text(splitNotes, margin + 4, notesY + 9.5);

  // --- 6. İMZA / ONAY ALANI ---
  const signY = notesY + notesHeight + 8;
  doc.setDrawColor(200, 205, 215);
  doc.setLineWidth(0.3);

  // Sol: Teklifi Hazırlayan
  const signBoxWidth = 70;
  doc.line(margin + 5, signY + 16, margin + signBoxWidth, signY + 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(70, 70, 70);
  doc.text("Teklifi Hazirlayan", margin + signBoxWidth / 2, signY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text(tr(proposal.salespersonName || "Abdullah Mete"), margin + signBoxWidth / 2, signY + 8, { align: "center" });
  doc.text("Kase / Imza", margin + signBoxWidth / 2, signY + 20, { align: "center" });

  // Sağ: Müşteri Onayı
  const rightSignX = W - margin - signBoxWidth;
  doc.line(rightSignX + 5, signY + 16, rightX - 5, signY + 16);
  doc.setFont("helvetica", "bold");
  doc.text("Teklifi Onaylayan Musteri", rightSignX + signBoxWidth / 2, signY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text(custTitle, rightSignX + signBoxWidth / 2, signY + 8, { align: "center" });
  doc.text("Kase / Imza", rightSignX + signBoxWidth / 2, signY + 20, { align: "center" });

  // --- 7. ALT BİLGİ (FOOTER) ---
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Bu teklif mektubu Ozkon Yapi Takip Sistemi tarafindan ${new Date().toLocaleDateString("tr-TR")} tarihinde olusturulmustur. Belge No: ${proposal.proposalNo}`,
    W / 2,
    290,
    { align: "center" }
  );

  doc.save(`Teklif_${proposal.proposalNo}_${tr(proposal.customerCompany || proposal.customerName)}.pdf`);
};
