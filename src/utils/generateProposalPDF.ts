import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Proposal, CompanyProfile } from "../types";
import { getOzkonLogoPng } from "./logoBase64";
import { registerTurkishFonts } from "./customFonts";

const fmt = (num?: number) =>
  (num || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";

export const generateProposalPDF = async (
  proposal: Proposal,
  companyProfile?: CompanyProfile | null
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Türkçe karakter desteği için Roboto fontunu kaydet ve aktif et
  registerTurkishFonts(doc);

  const companyName = companyProfile?.companyName || "ÖZKON YAPI İNŞAAT LTD. ŞTİ.";
  const address = companyProfile?.address || "Valide Sultan Mah. 100. Yıl Cad. No:74/B Karaman-Merkez";
  const phone = companyProfile?.phone || "0338 213 76 67";
  const fax = companyProfile?.fax || "0338 213 33 43";
  const taxOffice = companyProfile?.taxOffice || "Karaman";
  const taxNumber = companyProfile?.taxNumber || "7000074860";

  // --- 1. ÜST BAŞLIK & ANTET ALANI ---

  // Sol: Şirket Resmi Logosu (210x63 aspect ratio ~ 44mm x 13.3mm)
  try {
    const logoPng = await getOzkonLogoPng();
    if (logoPng) {
      doc.addImage(logoPng, "PNG", margin, 10, 44, 13.3);
    } else {
      doc.setFont("Roboto", "bold");
      doc.setFontSize(14);
      doc.setTextColor(0, 43, 141);
      doc.text("ÖZKON YAPI", margin, 18);
    }
  } catch (e) {
    doc.setFont("Roboto", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 43, 141);
    doc.text("ÖZKON YAPI", margin, 18);
  }

  doc.setFont("Roboto", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text(address, margin, 27.5);
  doc.text(`TEL: ${phone}   FAX: ${fax}`, margin, 31.5);
  doc.text(`info@ozkongrup.com   VD: ${taxOffice} / VKN: ${taxNumber}`, margin, 35.5);

  // Sağ: TEKLİF MEKTUBU Başlığı ve Meta Bilgileri
  const rightX = W - margin;
  doc.setFont("Roboto", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 90, 160);
  doc.text("TEKLİF MEKTUBU", rightX, 17, { align: "right" });

  doc.setFontSize(8);
  doc.setFont("Roboto", "bold");
  doc.setTextColor(70, 70, 70);

  const metaStartY = 22;
  const col1X = W - 65;
  const col2X = rightX;

  doc.text("Tarih:", col1X, metaStartY);
  doc.setFont("Roboto", "normal");
  doc.text(proposal.date || new Date().toLocaleDateString("tr-TR"), col2X, metaStartY, { align: "right" });

  doc.setFont("Roboto", "bold");
  doc.text("Geçerlilik:", col1X, metaStartY + 4);
  doc.setFont("Roboto", "normal");
  doc.text(proposal.validUntil || "-", col2X, metaStartY + 4, { align: "right" });

  doc.setFont("Roboto", "bold");
  doc.text("Teklif No:", col1X, metaStartY + 8);
  doc.setFont("Roboto", "bold");
  doc.setTextColor(30, 90, 160);
  doc.text(proposal.proposalNo, col2X, metaStartY + 8, { align: "right" });

  doc.setFont("Roboto", "bold");
  doc.setTextColor(70, 70, 70);
  doc.text("Yetkili:", col1X, metaStartY + 12);
  doc.setFont("Roboto", "normal");
  doc.text(proposal.salespersonName || "Abdullah Mete", col2X, metaStartY + 12, { align: "right" });

  if (proposal.salespersonPhone) {
    doc.setFont("Roboto", "bold");
    doc.text("Tel:", col1X, metaStartY + 16);
    doc.setFont("Roboto", "normal");
    doc.text(proposal.salespersonPhone, col2X, metaStartY + 16, { align: "right" });
  }

  // Ayırıcı çizgi
  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.5);
  doc.line(margin, 42, W - margin, 42);

  // --- 2. MÜŞTERİ BİLGİLERİ ---
  doc.setFillColor(245, 248, 253);
  doc.roundedRect(margin, 45, W - 2 * margin, 18, 1.5, 1.5, "F");

  doc.setFont("Roboto", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 90, 160);
  doc.text("MÜŞTERİ BİLGİLERİ", margin + 4, 50);

  doc.setFontSize(9);
  doc.setFont("Roboto", "bold");
  doc.setTextColor(20, 25, 35);
  const custTitle = proposal.customerCompany || proposal.customerName || "Sayın Müşteri";
  doc.text(custTitle, margin + 4, 55.5);

  doc.setFont("Roboto", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  const contactInfo = [
    proposal.customerPhone ? `Tel: ${proposal.customerPhone}` : "",
    proposal.customerAddress ? `Adres: ${proposal.customerAddress}` : ""
  ].filter(Boolean).join("   |   ");

  if (contactInfo) {
    doc.text(contactInfo, margin + 4, 60);
  }

  // --- 3. KALEMLER TABLOSU ---
  const tableData = proposal.items.map((item, idx) => [
    idx + 1,
    item.description,
    item.quantity.toLocaleString("tr-TR"),
    item.unit || "ADET",
    fmt(item.price),
    fmt(item.total || (item.quantity * item.price))
  ]);

  autoTable(doc, {
    startY: 66,
    margin: { left: margin, right: margin },
    head: [["#", "Ürün / Hizmet Açıklaması", "Miktar", "Birim", "Birim Fiyat", "Toplam"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [30, 90, 160], // Özkon Blue
      textColor: [255, 255, 255],
      font: "Roboto",
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "left"
    },
    styles: {
      font: "Roboto",
      fontStyle: "normal",
      fontSize: 8,
      cellPadding: 2.2,
      lineColor: [230, 235, 245],
      lineWidth: 0.2
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: "auto", halign: "left", font: "Roboto", fontStyle: "bold" },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 26, halign: "right" },
      5: { cellWidth: 28, halign: "right", font: "Roboto", fontStyle: "bold" }
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

  doc.setFont("Roboto", "normal");
  doc.text("Ara Toplam:", summaryBoxX, currY + 4);
  doc.text(fmt(proposal.subtotal), rightX, currY + 4, { align: "right" });

  if ((proposal.discountAmount || 0) > 0) {
    currY += 5;
    doc.text("İskonto / İndirim:", summaryBoxX, currY + 4);
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

  doc.setFont("Roboto", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 90, 160);
  doc.text("GENEL TOPLAM:", summaryBoxX + 2, currY + 5.5);
  doc.text(fmt(proposal.totalAmount), rightX - 2, currY + 5.5, { align: "right" });

  // --- 5. NOTLAR & SATIŞ ŞARTLARI ---
  const notesY = Math.max(finalY, currY + 12);
  const notesHeight = 28;

  doc.setFillColor(242, 246, 252);
  doc.roundedRect(margin, notesY, W - 2 * margin, notesHeight, 1.5, 1.5, "F");

  doc.setFont("Roboto", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 90, 160);
  doc.text("NOTLAR & SATIŞ ŞARTLARI", margin + 4, notesY + 5);

  doc.setFont("Roboto", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(70, 70, 70);

  const defaultTerms = proposal.termsAndConditions || proposal.notes || "1. Fiyatlarımıza KDV dahil değildir.\n2. Teklifimiz belirtilen geçerlilik tarihine kadar geçerlidir.\n3. Nakliye ve boşaltma şartları teklif kapsamındadır.";
  const splitNotes = doc.splitTextToSize(defaultTerms, W - 2 * margin - 8);
  doc.text(splitNotes, margin + 4, notesY + 9.5);

  // --- 6. İMZA / ONAY ALANI ---
  const signY = notesY + notesHeight + 8;
  doc.setDrawColor(200, 205, 215);
  doc.setLineWidth(0.3);

  // Sol: Teklifi Hazırlayan
  const signBoxWidth = 70;
  doc.line(margin + 5, signY + 16, margin + signBoxWidth, signY + 16);
  doc.setFont("Roboto", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(70, 70, 70);
  doc.text("Teklifi Hazırlayan", margin + signBoxWidth / 2, signY + 4, { align: "center" });
  doc.setFont("Roboto", "normal");
  doc.text(proposal.salespersonName || "Abdullah Mete", margin + signBoxWidth / 2, signY + 8, { align: "center" });
  doc.text("Kaşe / İmza", margin + signBoxWidth / 2, signY + 20, { align: "center" });

  // Sağ: Müşteri Onayı
  const rightSignX = W - margin - signBoxWidth;
  doc.line(rightSignX + 5, signY + 16, rightX - 5, signY + 16);
  doc.setFont("Roboto", "bold");
  doc.text("Teklifi Onaylayan Müşteri", rightSignX + signBoxWidth / 2, signY + 4, { align: "center" });
  doc.setFont("Roboto", "normal");
  doc.text(custTitle, rightSignX + signBoxWidth / 2, signY + 8, { align: "center" });
  doc.text("Kaşe / İmza", rightSignX + signBoxWidth / 2, signY + 20, { align: "center" });

  // --- 7. ALT BİLGİ (FOOTER) ---
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Bu teklif mektubu Özkon Yapı Takip Sistemi tarafından ${new Date().toLocaleDateString("tr-TR")} tarihinde oluşturulmuştur. Belge No: ${proposal.proposalNo}`,
    W / 2,
    290,
    { align: "center" }
  );

  const safeFileName = `Teklif_${proposal.proposalNo}_${proposal.customerCompany || proposal.customerName || "Musteri"}`.replace(/[\/\\?%*:|"<>]/g, "_");
  doc.save(`${safeFileName}.pdf`);
};
