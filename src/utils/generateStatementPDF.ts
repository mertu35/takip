import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Customer, Sale, Payment, CompanyProfile } from "../types";
import { PAYMENT_METHOD_LABELS } from "./salesMath";
import { getOzkonLogoPng } from "./logoBase64";

// Türkçe karakter dönüşümü
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

export interface StatementItem {
  id: string;
  date: string;
  receiptNo: string;
  type: "sale" | "payment";
  typeLabel: string;
  description: string;
  debit: number; // Borç (Satış tutarı)
  credit: number; // Alacak (Tahsilat tutarı)
  runningBalance: number; // Yürüyen bakiye
}

export const generateStatementPDF = async (
  customer: Customer,
  sales: Sale[],
  payments: Payment[],
  companyProfile?: CompanyProfile | null,
  startDate?: string,
  endDate?: string
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 16;

  const companyName = tr(companyProfile?.companyName || "OZKON YAPI & CELIK");
  const address = tr(companyProfile?.address || "Valide Sultan Mah. 100. Yil Cad. No:74/B Karaman-Merkez");
  const phone = companyProfile?.phone || "0338 213 76 67";
  const taxOffice = tr(companyProfile?.taxOffice || "Karaman");
  const taxNumber = companyProfile?.taxNumber || "7000074860";

  // Başlık Alanı
  try {
    const logoPng = await getOzkonLogoPng();
    if (logoPng) {
      doc.addImage(logoPng, "PNG", margin, 10, 40, 12.1);
    }
  } catch (_e) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(15, 82, 186);
    doc.text(companyName, margin, 20);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(address, margin, 26);
  doc.text(`Tel: ${phone}  |  VD: ${taxOffice}  |  VN: ${taxNumber}`, margin, 30.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text("CARI HESAP EKSTRESI", W - margin, 20, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  const periodText = startDate || endDate
    ? `${startDate ? new Date(startDate).toLocaleDateString("tr-TR") : "Baslangic"} - ${endDate ? new Date(endDate).toLocaleDateString("tr-TR") : "Bugun"}`
    : "Tum Hareketler";
  doc.text(`Donem : ${periodText}`, W - margin, 25.5, { align: "right" });
  doc.text(`Rapor Tarihi : ${new Date().toLocaleDateString("tr-TR")}`, W - margin, 30, { align: "right" });

  doc.setDrawColor(15, 82, 186);
  doc.setLineWidth(0.6);
  doc.line(margin, 34, W - margin, 34);

  // Müşteri Bilgileri Kutusu
  const infoY = 40;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, infoY, W - margin * 2, 22, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("CARI UNVAN / MUSTERI BILGILERI", margin + 4, infoY + 5.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(20, 20, 20);
  doc.text(tr(customer.company || customer.name), margin + 4, infoY + 11.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(70, 70, 70);
  const custContact = `Yetkili: ${tr(customer.name)}  |  Tel: ${customer.phone || "-"}  |  VN: ${customer.taxNumber || "-"}`;
  doc.text(custContact, margin + 4, infoY + 17);

  // Hareketleri Birleştir ve Tarihe Göre Sırala (Eskiden Yeniye)
  const approvedSales = sales.filter((s) => s.status === "approved");
  const allEvents: {
    date: string;
    receiptNo: string;
    type: "sale" | "payment";
    description: string;
    amount: number;
  }[] = [];

  for (const s of approvedSales) {
    allEvents.push({
      date: s.date,
      receiptNo: s.receiptNo,
      type: "sale",
      description: s.paymentMethod ? PAYMENT_METHOD_LABELS[s.paymentMethod] || "Satış" : "Satış Faturası",
      amount: s.netAmount || 0
    });
  }

  for (const p of payments) {
    allEvents.push({
      date: p.date,
      receiptNo: p.receiptNo,
      type: "payment",
      description: `Tahsilat (${PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}) ${p.notes ? `- ${p.notes}` : ""}`,
      amount: p.amount || 0
    });
  }

  allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Tarih Filtresini Uygula
  const filteredEvents = allEvents.filter((ev) => {
    const d = new Date(ev.date);
    if (startDate && d < new Date(`${startDate}T00:00:00`)) return false;
    if (endDate && d > new Date(`${endDate}T23:59:59`)) return false;
    return true;
  });

  let runningBalance = 0;
  let totalDebit = 0;
  let totalCredit = 0;

  const tableRows = filteredEvents.map((ev) => {
    const isSale = ev.type === "sale";
    const debit = isSale ? ev.amount : 0;
    const credit = !isSale ? ev.amount : 0;

    totalDebit += debit;
    totalCredit += credit;
    runningBalance += debit - credit;

    return [
      new Date(ev.date).toLocaleDateString("tr-TR"),
      ev.receiptNo,
      isSale ? "Satis" : "Tahsilat",
      tr(ev.description),
      debit > 0 ? fmt(debit) : "-",
      credit > 0 ? fmt(credit) : "-",
      fmt(runningBalance)
    ];
  });

  autoTable(doc, {
    startY: infoY + 27,
    margin: { left: margin, right: margin },
    head: [["Tarih", "Belge No", "İslem", "Aciklama", "Borc (TL)", "Alacak (TL)", "Bakiye (TL)"]],
    body: tableRows.length > 0 ? tableRows : [["-", "-", "-", "Secilen donemde cari hareket bulunamadi.", "-", "-", "-"]],
    theme: "striped",
    headStyles: {
      fillColor: [15, 82, 186],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
      halign: "left"
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [40, 40, 40]
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 26, fontStyle: "bold" },
      2: { cellWidth: 16 },
      3: { cellWidth: "auto" },
      4: { cellWidth: 24, halign: "right", textColor: [180, 40, 40] },
      5: { cellWidth: 24, halign: "right", textColor: [16, 140, 80] },
      6: { cellWidth: 26, halign: "right", fontStyle: "bold" }
    }
  });

  // Özet Tablosu
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  const summaryBoxW = 90;
  const summaryX = W - margin - summaryBoxW;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(summaryX, finalY, summaryBoxW, 30, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);

  doc.text("Toplam Borc (Satislar):", summaryX + 4, finalY + 7);
  doc.text(fmt(totalDebit), summaryX + summaryBoxW - 4, finalY + 7, { align: "right" });

  doc.text("Toplam Alacak (Tahsilatlar):", summaryX + 4, finalY + 14);
  doc.text(fmt(totalCredit), summaryX + summaryBoxW - 4, finalY + 14, { align: "right" });

  doc.setDrawColor(200, 200, 200);
  doc.line(summaryX + 4, finalY + 18, summaryX + summaryBoxW - 4, finalY + 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 82, 186);
  doc.text("Kapanis Bakiyesi:", summaryX + 4, finalY + 25);
  doc.text(fmt(runningBalance), summaryX + summaryBoxW - 4, finalY + 25, { align: "right" });

  // Alt Bilgi
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text(
    "Bu ekstre Ozkon Takip Sistemi tarafindan otomatik uretilmistir. Lutfen mutabakat saglayiniz.",
    W / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: "center" }
  );

  doc.save(`Cari_Ekstre_${customer.company || customer.name}.pdf`);
};
