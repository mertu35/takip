import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CompanyProfile } from "../types";

// Türkçe karakter dönüşümü (PDF font uyumluluğu için)
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

export interface ExecutiveReportData {
  periodLabel: string;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  profitMargin: number;
  totalCollections: number;
  totalReceivables: number;
  totalInventoryValue: number;
  salespeople: {
    name: string;
    salesCount: number;
    revenue: number;
    grossProfit: number;
    profitMargin: number;
    avgTicket: number;
  }[];
  topProducts: {
    code: string;
    name: string;
    quantity: number;
    revenue: number;
    grossProfit: number;
  }[];
  deadStock: {
    code: string;
    name: string;
    stock: number;
    costPrice: number;
    totalLockedCapital: number;
  }[];
  upcomingChecks: {
    receiptNo: string;
    customerCompany: string;
    checkNumber: string;
    amount: number;
    dueDate: string;
    statusLabel: string;
  }[];
}

export const generateExecutivePDF = (
  report: ExecutiveReportData,
  companyProfile?: CompanyProfile | null
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 14;

  const companyName = tr(companyProfile?.companyName || "OZKON YAPI & CELIK");
  const address = tr(companyProfile?.address || "Merkez Mah. Celik Sanayi Bulvari No: 45 Sariyer / Istanbul");
  const phone = companyProfile?.phone || "0212 999 88 77";

  // --- 1. HEADER (KURUMSAL BAŞLIK) ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 82, 186); // primary blue
  doc.text(companyName, margin, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`${address} | Tel: ${phone}`, margin, 23);

  // Rapor Başlığı & Dönem Rozeti
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text(tr("YONETICI & PATRON STRATEJIK RAPORU"), W - margin, 18, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 82, 186);
  doc.text(tr(`Donem: ${report.periodLabel} | Tarih: ${new Date().toLocaleDateString("tr-TR")}`), W - margin, 23, {
    align: "right"
  });

  // Çizgi
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(margin, 27, W - margin, 27);

  // --- 2. EXECUTIVE KPI CARDS (5'Lİ FİNANSAL ÖZET ŞERİDİ) ---
  let y = 32;
  const cardWidth = (W - margin * 2 - 8) / 3;
  const cardHeight = 16;

  // Satır 1: 3 Kart
  const kpisRow1 = [
    { label: "DONEM NET CIROSU", value: fmt(report.totalRevenue), color: [15, 82, 186] },
    { label: "BRUT KAR (MARJ %" + report.profitMargin.toFixed(1) + ")", value: fmt(report.grossProfit), color: [16, 185, 129] },
    { label: "DONEM TAHSILATI", value: fmt(report.totalCollections), color: [14, 165, 233] }
  ];

  kpisRow1.forEach((kpi, idx) => {
    const x = margin + idx * (cardWidth + 4);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(tr(kpi.label), x + 4, y + 5);

    doc.setFontSize(10.5);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, x + 4, y + 12);
  });

  // Satır 2: 2 Kart
  y += cardHeight + 4;
  const cardWidthRow2 = (W - margin * 2 - 4) / 2;
  const kpisRow2 = [
    { label: "PIYASADAKI ALACAK (CARİ BORÇ)", value: fmt(report.totalReceivables), color: [239, 68, 68] },
    { label: "DEPO STOK SERMAYE DEGERI (MALIYET)", value: fmt(report.totalInventoryValue), color: [100, 116, 139] }
  ];

  kpisRow2.forEach((kpi, idx) => {
    const x = margin + idx * (cardWidthRow2 + 4);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, cardWidthRow2, cardHeight, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardWidthRow2, cardHeight, 2, 2, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(tr(kpi.label), x + 4, y + 5);

    doc.setFontSize(10.5);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, x + 4, y + 12);
  });

  y += cardHeight + 7;

  // --- 3. SATIŞÇI PERFORMANS & CİRO TABLOSU ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text(tr("1. SATISCI PERFORMANS & CIRO TABLOSU"), margin, y);

  const spRows = report.salespeople.map((sp, i) => [
    `${i + 1}. ${tr(sp.name)}`,
    sp.salesCount.toString(),
    fmt(sp.revenue),
    fmt(sp.avgTicket),
    fmt(sp.grossProfit),
    `%${sp.profitMargin.toFixed(1)}`
  ]);

  autoTable(doc, {
    startY: y + 2,
    head: [[tr("Satis Temsilcisi"), tr("Onayli Fis"), tr("Net Ciro"), tr("Ortalama Fis"), tr("Brut Kar Katkisi"), tr("Kar Marji")]],
    body: spRows.length > 0 ? spRows : [[tr("Bu donemde satis kaydi bulunmuyor"), "-", "-", "-", "-", "-"]],
    theme: "grid",
    headStyles: {
      fillColor: [15, 82, 186],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "left"
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { halign: "center", cellWidth: 20 },
      2: { halign: "right", cellWidth: 32, fontStyle: "bold" },
      3: { halign: "right", cellWidth: 28 },
      4: { halign: "right", cellWidth: 32, textColor: [16, 185, 129], fontStyle: "bold" },
      5: { halign: "center", cellWidth: 20, fontStyle: "bold" }
    },
    margin: { left: margin, right: margin }
  });

  y = (doc as any).lastAutoTable.finalY + 7;

  // --- 4. EN ÇOK SATAN & KÂR BIRAKAN ÜRÜNLER ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text(tr("2. EN COK SATAN VE KAR GETIREN URUNLER (TOP 5)"), margin, y);

  const topRows = report.topProducts.slice(0, 5).map((p, i) => [
    `${i + 1}. [${p.code}] ${tr(p.name)}`,
    p.quantity.toString(),
    fmt(p.revenue),
    fmt(p.grossProfit)
  ]);

  autoTable(doc, {
    startY: y + 2,
    head: [[tr("Urun Kodu & Adi"), tr("Satilan Miktar"), tr("Uretilen Ciro"), tr("Brut Kar")]],
    body: topRows.length > 0 ? topRows : [[tr("Kayitli satis bulunmuyor"), "-", "-", "-"]],
    theme: "grid",
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7.5
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2
    },
    columnStyles: {
      0: { cellWidth: 95 },
      1: { halign: "center", cellWidth: 25 },
      2: { halign: "right", cellWidth: 32, fontStyle: "bold" },
      3: { halign: "right", cellWidth: 30, textColor: [16, 185, 129], fontStyle: "bold" }
    },
    margin: { left: margin, right: margin }
  });

  y = (doc as any).lastAutoTable.finalY + 7;

  // Sayfa taşma kontrolü
  if (y > 235) {
    doc.addPage();
    y = 20;
  }

  // --- 5. ÖLÜ / HAREKETSİZ STOK ÖZETİ ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text(tr("3. OLU / HAREKETSIZ STOK UYARISI (DEPODA YATAN SERMAYE)"), margin, y);

  const totalDeadCapital = report.deadStock.reduce((s, p) => s + p.totalLockedCapital, 0);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(239, 68, 68);
  doc.text(
    tr(`Toplam ${report.deadStock.length} urun donem boyunca satilmadi. Kilitli Sermaye: ${fmt(totalDeadCapital)}`),
    W - margin,
    y,
    { align: "right" }
  );

  const deadRows = report.deadStock.slice(0, 5).map((p) => [
    `[${p.code}] ${tr(p.name)}`,
    `${p.stock} Adet`,
    fmt(p.costPrice),
    fmt(p.totalLockedCapital)
  ]);

  autoTable(doc, {
    startY: y + 2,
    head: [[tr("Hareketsiz Urun"), tr("Depodaki Stok"), tr("Birim Maliyet"), tr("Depoda Bagli Sermaye")]],
    body: deadRows.length > 0 ? deadRows : [[tr("Hareketsiz urun bulunmuyor (Tum urunler satis gordu)"), "-", "-", "-"]],
    theme: "grid",
    headStyles: {
      fillColor: [185, 28, 28],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7.5
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2
    },
    columnStyles: {
      0: { cellWidth: 95 },
      1: { halign: "center", cellWidth: 25 },
      2: { halign: "right", cellWidth: 30 },
      3: { halign: "right", cellWidth: 32, fontStyle: "bold", textColor: [185, 28, 28] }
    },
    margin: { left: margin, right: margin }
  });

  // --- FOOTER (ALT BİLGİ) ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      tr("Ozkon Yapi & Celik Takip Sistemi - Gizli & Yonetime Ozel Rapor"),
      margin,
      doc.internal.pageSize.getHeight() - 8
    );
    doc.text(
      `Sayfa ${i} / ${pageCount}`,
      W - margin,
      doc.internal.pageSize.getHeight() - 8,
      { align: "right" }
    );
  }

  doc.save(`Patron_Yonetici_Raporu_${new Date().toISOString().slice(0, 10)}.pdf`);
};
