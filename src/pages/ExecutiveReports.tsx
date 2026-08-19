// Takip Sistemi - Gelişmiş Patron & Yönetici Raporları (Executive Dashboard)
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  getSales,
  getProducts,
  getCustomers,
  getPayments,
  getCompanyProfile,
  collectSaleCheck,
  bounceSaleCheck
} from "../services/db";
import { formatCurrency, formatDate } from "../utils/format";
import { generateExecutivePDF, type ExecutiveReportData } from "../utils/generateExecutivePDF";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import EmptyState from "../components/EmptyState";
import {
  TrendingUp,
  Award,
  Calendar,
  Package,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  CreditCard,
  Users,
  CheckCircle2,
  Crown,
  Clock,
  Check
} from "lucide-react";
import * as XLSX from "xlsx";
import type { Sale, Product, Customer, Payment, CompanyProfile, CheckStatus } from "../types";

type DatePreset = "this_month" | "last_month" | "this_year" | "last_30" | "all" | "custom";
type ActiveTab = "salespeople" | "products" | "cashflow";
type CheckTabType = "portfolio" | "bounced" | "collected" | "all";

export interface CheckItem {
  id: string;
  source: "sale" | "payment";
  saleId?: string;
  paymentId?: string;
  receiptNo: string;
  customerCompany: string;
  checkNumber: string;
  amount: number;
  dueDate: string;
  daysRemaining: number;
  statusLabel: string;
  statusColor: string;
  checkStatus: CheckStatus;
}

const ExecutiveReports = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Filtreler
  const [datePreset, setDatePreset] = useState<DatePreset>("this_month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("salespeople");
  const [checkStatusTab, setCheckStatusTab] = useState<CheckTabType>("portfolio");

  const fetchData = useCallback(async () => {
    try {
      const [salesData, prodData, custData, paymentData, profileData] = await Promise.all([
        getSales("admin"),
        getProducts(),
        getCustomers(),
        getPayments(),
        getCompanyProfile().catch(() => null)
      ]);
      setSales(salesData);
      setProducts(prodData);
      setCustomers(custData);
      setPayments(paymentData);
      setCompanyProfile(profileData);
    } catch {
      showToast("Yönetici rapor verileri yüklenemedi.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- TARİH ARALIĞI TARAMA ---
  const { startDate, endDate, periodLabel } = useMemo(() => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;
    let label = "Bu Ay";

    if (datePreset === "this_month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      label = start.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
    } else if (datePreset === "last_month") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      label = start.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
    } else if (datePreset === "this_year") {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      label = `${now.getFullYear()} Yılı`;
    } else if (datePreset === "last_30") {
      start = new Date();
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      end = new Date();
      label = "Son 30 Gün";
    } else if (datePreset === "custom") {
      if (customStartDate) start = new Date(`${customStartDate}T00:00:00`);
      if (customEndDate) end = new Date(`${customEndDate}T23:59:59`);
      label = `${customStartDate || "Başlangıç"} - ${customEndDate || "Bitiş"}`;
    } else {
      label = "Tüm Zamanlar";
    }

    return { startDate: start, endDate: end, periodLabel: label };
  }, [datePreset, customStartDate, customEndDate]);

  // Filtrelenmiş Onaylı Satışlar
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (s.status !== "approved") return false;
      const d = new Date(s.date);
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });
  }, [sales, startDate, endDate]);

  // Filtrelenmiş Tahsilatlar
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const d = new Date(p.date);
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });
  }, [payments, startDate, endDate]);

  // --- ÜRÜN MALİYET HARİTASI ---
  const productCostMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of products) {
      // Eğer costPrice tanımlı değilse tahmini %70 maliyet kabul et
      map[p.id] = typeof (p as any).costPrice === "number" && (p as any).costPrice > 0
        ? (p as any).costPrice
        : p.price * 0.7;
    }
    return map;
  }, [products]);

  // --- 1. PATRON FİNANSAL KPI METRİKLERİ ---
  const kpiMetrics = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;

    for (const s of filteredSales) {
      totalRevenue += s.netAmount || 0;
      for (const item of s.items || []) {
        const unitCost = typeof item.costPrice === "number" && item.costPrice > 0
          ? item.costPrice
          : productCostMap[item.productId] || item.price * 0.7;
        totalCost += unitCost * item.quantity;
      }
    }

    const grossProfit = Math.max(0, totalRevenue - totalCost);
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    const totalCollections = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalReceivables = customers.reduce((sum, c) => sum + Math.max(0, c.currentBalance || 0), 0);

    // Depo Stok Maliyet Sermayesi
    const totalInventoryValue = products.reduce((sum, p) => {
      const unitCost = typeof (p as any).costPrice === "number" && (p as any).costPrice > 0
        ? (p as any).costPrice
        : p.price * 0.7;
      return sum + unitCost * (p.stock || 0);
    }, 0);

    return {
      totalRevenue,
      totalCost,
      grossProfit,
      profitMargin,
      totalCollections,
      totalReceivables,
      totalInventoryValue
    };
  }, [filteredSales, filteredPayments, customers, products, productCostMap]);

  // --- 2. SATIŞÇI PERFORMANS VE CİRO HESABI ---
  const salespeoplePerformance = useMemo(() => {
    const map: Record<
      string,
      {
        id: string;
        name: string;
        salesCount: number;
        revenue: number;
        cost: number;
        grossProfit: number;
      }
    > = {};

    for (const s of filteredSales) {
      const spId = s.salespersonId || "unassigned";
      const spName = s.salespersonName || "Bilinmeyen Satışçı";
      if (!map[spId]) {
        map[spId] = { id: spId, name: spName, salesCount: 0, revenue: 0, cost: 0, grossProfit: 0 };
      }
      const entry = map[spId];
      entry.salesCount += 1;
      entry.revenue += s.netAmount || 0;

      for (const item of s.items || []) {
        const unitCost = typeof item.costPrice === "number" && item.costPrice > 0
          ? item.costPrice
          : productCostMap[item.productId] || item.price * 0.7;
        entry.cost += unitCost * item.quantity;
      }
    }

    const list = Object.values(map).map((sp) => {
      const profit = Math.max(0, sp.revenue - sp.cost);
      const margin = sp.revenue > 0 ? (profit / sp.revenue) * 100 : 0;
      const avgTicket = sp.salesCount > 0 ? sp.revenue / sp.salesCount : 0;
      return {
        ...sp,
        grossProfit: profit,
        profitMargin: margin,
        avgTicket
      };
    });

    // Ciroya göre çoktan aza sırala
    list.sort((a, b) => b.revenue - a.revenue);
    return list;
  }, [filteredSales, productCostMap]);

  // --- 3. ÜRÜN KÂRLILIK VE ÖLÜ STOK ANALİZİ ---
  const { topProducts, deadStockProducts } = useMemo(() => {
    const soldMap: Record<string, { quantity: number; revenue: number; cost: number }> = {};

    for (const s of filteredSales) {
      for (const item of s.items || []) {
        if (!soldMap[item.productId]) {
          soldMap[item.productId] = { quantity: 0, revenue: 0, cost: 0 };
        }
        const entry = soldMap[item.productId];
        entry.quantity += item.quantity;
        entry.revenue += item.total || item.price * item.quantity;
        const unitCost = typeof item.costPrice === "number" && item.costPrice > 0
          ? item.costPrice
          : productCostMap[item.productId] || item.price * 0.7;
        entry.cost += unitCost * item.quantity;
      }
    }

    // Top Ürünler
    const topList = Object.entries(soldMap).map(([prodId, data]) => {
      const prod = products.find((p) => p.id === prodId);
      const grossProfit = Math.max(0, data.revenue - data.cost);
      return {
        id: prodId,
        code: prod?.code || "—",
        name: prod?.name || "Bilinmeyen Ürün",
        quantity: data.quantity,
        revenue: data.revenue,
        cost: data.cost,
        grossProfit,
        profitMargin: data.revenue > 0 ? (grossProfit / data.revenue) * 100 : 0
      };
    });

    topList.sort((a, b) => b.revenue - a.revenue);

    // Ölü / Hareketsiz Stoklar (Dönem boyunca 0 adet satılan ve stoğu olan ürünler)
    const deadList = products
      .filter((p) => (p.stock || 0) > 0 && !soldMap[p.id])
      .map((p) => {
        const unitCost = typeof (p as any).costPrice === "number" && (p as any).costPrice > 0
          ? (p as any).costPrice
          : p.price * 0.7;
        return {
          id: p.id,
          code: p.code,
          name: p.name,
          stock: p.stock,
          costPrice: unitCost,
          totalLockedCapital: unitCost * p.stock
        };
      });

    deadList.sort((a, b) => b.totalLockedCapital - a.totalLockedCapital);

    return { topProducts: topList, deadStockProducts: deadList };
  }, [filteredSales, products, productCostMap]);

  // --- 4. NAKİT AKIŞI & ÇEK VADE TAKVİMİ ---
  const { paymentBreakdown, upcomingChecks } = useMemo(() => {
    const breakdown: Record<string, number> = {
      cash: 0,
      credit_card: 0,
      bank_transfer: 0,
      check: 0
    };

    for (const p of filteredPayments) {
      if (breakdown[p.paymentMethod] !== undefined) {
        breakdown[p.paymentMethod] += p.amount || 0;
      }
    }

    // Çek listesi: Hem payments hem de approved/pending sales'tan çekli olanlar
    const checkList: CheckItem[] = [];

    const now = Date.now();

    const computeStatus = (dueDateStr: string) => {
      const dueTime = new Date(dueDateStr).getTime();
      const diffDays = Math.ceil((dueTime - now) / (1000 * 60 * 60 * 24));
      let statusLabel = "";
      let statusColor = "";

      if (diffDays < 0) {
        statusLabel = `${Math.abs(diffDays)} gün gecikti`;
        statusColor = "danger";
      } else if (diffDays === 0) {
        statusLabel = "Bugün vadesi";
        statusColor = "warning";
      } else if (diffDays <= 7) {
        statusLabel = `${diffDays} gün kaldı (Bu Hafta)`;
        statusColor = "warning";
      } else if (diffDays <= 30) {
        statusLabel = `${diffDays} gün kaldı`;
        statusColor = "primary";
      } else {
        statusLabel = `${diffDays} gün sonra`;
        statusColor = "secondary";
      }

      return { diffDays, statusLabel, statusColor };
    };

    // 1. Sales içindeki vadeli çekli satışlar
    for (const s of sales) {
      if (
        s.paymentMethod === "check" &&
        s.paymentDueDate &&
        (s.status === "approved" || s.status === "pending_accounting")
      ) {
        const { diffDays, statusLabel, statusColor } = computeStatus(s.paymentDueDate);
        const status: CheckStatus = s.checkStatus || "portfolio";
        checkList.push({
          id: `sale-${s.id}`,
          source: "sale",
          saleId: s.id,
          receiptNo: s.receiptNo,
          customerCompany: s.customerCompany || s.customerName,
          checkNumber: s.checkNumber || "Belirtilmemiş",
          amount: s.netAmount,
          dueDate: s.paymentDueDate,
          daysRemaining: diffDays,
          statusLabel: status === "collected" ? "Tahsil Edildi" : status === "bounced" ? "Karşılıksız / Protestolu" : statusLabel,
          statusColor: status === "collected" ? "success" : status === "bounced" ? "danger" : statusColor,
          checkStatus: status
        });
      }
    }

    // 2. Payments içindeki bağımsız çekli tahsilatlar (satışa bağlı olmayanlar)
    for (const p of payments) {
      if (p.paymentMethod === "check" && p.dueDate && !p.saleId) {
        const { diffDays, statusLabel, statusColor } = computeStatus(p.dueDate);
        const status: CheckStatus = p.checkStatus || "collected";
        checkList.push({
          id: `payment-${p.id}`,
          source: "payment",
          paymentId: p.id,
          receiptNo: p.receiptNo,
          customerCompany: p.customerCompany,
          checkNumber: p.checkNumber || "Belirtilmemiş",
          amount: p.amount,
          dueDate: p.dueDate,
          daysRemaining: diffDays,
          statusLabel: status === "collected" ? "Tahsil Edildi" : status === "bounced" ? "Karşılıksız / Protestolu" : statusLabel,
          statusColor: status === "collected" ? "success" : status === "bounced" ? "danger" : statusColor,
          checkStatus: status
        });
      }
    }

    // Vade tarihine göre sırala (Önce gecikenler ve vadesi en yakın olanlar)
    checkList.sort((a, b) => a.daysRemaining - b.daysRemaining);

    return { paymentBreakdown: breakdown, upcomingChecks: checkList };
  }, [filteredPayments, payments, sales]);

  // Çek Alt Sekme Sayaçları
  const checkCounts = useMemo(() => {
    let portfolioCount = 0;
    let portfolioTotal = 0;
    let bouncedCount = 0;
    let bouncedTotal = 0;
    let collectedCount = 0;
    let collectedTotal = 0;

    for (const c of upcomingChecks) {
      if (c.checkStatus === "portfolio") {
        portfolioCount++;
        portfolioTotal += c.amount;
      } else if (c.checkStatus === "bounced") {
        bouncedCount++;
        bouncedTotal += c.amount;
      } else if (c.checkStatus === "collected") {
        collectedCount++;
        collectedTotal += c.amount;
      }
    }

    return {
      portfolioCount,
      portfolioTotal,
      bouncedCount,
      bouncedTotal,
      collectedCount,
      collectedTotal,
      totalCount: upcomingChecks.length
    };
  }, [upcomingChecks]);

  const displayedChecks = useMemo(() => {
    if (checkStatusTab === "all") return upcomingChecks;
    return upcomingChecks.filter((c) => c.checkStatus === checkStatusTab);
  }, [upcomingChecks, checkStatusTab]);

  // Çek Eylemleri (Tahsil Et / Karşılıksız)
  const handleCollectCheck = async (check: CheckItem) => {
    if (!check.saleId || !user) return;
    if (
      !window.confirm(
        `"${check.customerCompany}" firmasının ${formatCurrency(check.amount)} tutarındaki çeki tahsil edilsin ve cari borcundan düşülsün mü?\n\n(Bu işlem otomatik olarak bir Tahsilat Makbuzu oluşturacak ve çeki Kapatıldı durumuna alacaktır.)`
      )
    ) {
      return;
    }

    try {
      await collectSaleCheck(
        check.saleId,
        user.uid,
        user.displayName || "Kullanıcı",
        user.role,
        `${check.receiptNo} numaralı satışın ${check.checkNumber} nolu çeki tahsil edildi.`
      );
      showToast(`Çek başarıyla tahsil edildi ve cari borçtan düşüldü.`, "success");
      fetchData();
    } catch (err: any) {
      showToast("Tahsilat işlemi sırasında hata: " + err.message, "error");
    }
  };

  const handleBounceCheck = async (check: CheckItem) => {
    if (!check.saleId || !user) return;
    if (
      !window.confirm(
        `"${check.customerCompany}" firmasının ${formatCurrency(check.amount)} tutarındaki çeki KARŞILIKSIZ / PROTESTOLU olarak işaretlensin mi?\n\n(Çek aktif takvimden Karşılıksız Çekler sekmesine taşınacak ve kırmızı alarm olarak kalacaktır.)`
      )
    ) {
      return;
    }

    try {
      await bounceSaleCheck(
        check.saleId,
        user.uid,
        user.displayName || "Kullanıcı",
        user.role
      );
      showToast(`Çek karşılıksız olarak işaretlendi ve alarm listesine alındı.`, "warning");
      fetchData();
    } catch (err: any) {
      showToast("İşlem sırasında hata: " + err.message, "error");
    }
  };

  // --- DIŞA AKTARMA (PDF & EXCEL) ---
  const handleExportPDF = () => {
    const reportData: ExecutiveReportData = {
      periodLabel,
      totalRevenue: kpiMetrics.totalRevenue,
      totalCost: kpiMetrics.totalCost,
      grossProfit: kpiMetrics.grossProfit,
      profitMargin: kpiMetrics.profitMargin,
      totalCollections: kpiMetrics.totalCollections,
      totalReceivables: kpiMetrics.totalReceivables,
      totalInventoryValue: kpiMetrics.totalInventoryValue,
      salespeople: salespeoplePerformance,
      topProducts,
      deadStock: deadStockProducts,
      upcomingChecks: upcomingChecks
        .filter((c) => c.checkStatus === "portfolio" || c.checkStatus === "bounced")
        .map((c) => ({
          receiptNo: c.receiptNo,
          customerCompany: c.customerCompany,
          checkNumber: c.checkNumber,
          amount: c.amount,
          dueDate: formatDate(c.dueDate),
          statusLabel: c.checkStatus === "bounced" ? "KARŞILIKSIZ / PROTESTOLU" : c.statusLabel
        }))
    };

    generateExecutivePDF(reportData, companyProfile);
    showToast("Patron & Yönetici Özeti PDF olarak indirildi.", "success");
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Sayfa: Finansal Özet
    const summaryData = [
      { Metrik: "Rapor Dönemi", Değer: periodLabel },
      { Metrik: "Toplam Net Ciro", "Tutar (TL)": kpiMetrics.totalRevenue },
      { Metrik: "Toplam Maliyet", "Tutar (TL)": kpiMetrics.totalCost },
      { Metrik: "Brüt Kâr", "Tutar (TL)": kpiMetrics.grossProfit },
      { Metrik: "Kâr Marjı (%)", Değer: `%${kpiMetrics.profitMargin.toFixed(1)}` },
      { Metrik: "Dönem Tahsilatı", "Tutar (TL)": kpiMetrics.totalCollections },
      { Metrik: "Piyasadaki Bekleyen Alacak", "Tutar (TL)": kpiMetrics.totalReceivables },
      { Metrik: "Depodaki Stok Sermayesi", "Tutar (TL)": kpiMetrics.totalInventoryValue }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Finansal Özet");

    // 2. Sayfa: Satışçı Performans
    const spData = salespeoplePerformance.map((sp, idx) => ({
      Sıra: idx + 1,
      "Satış Temsilcisi": sp.name,
      "Satış Adedi": sp.salesCount,
      "Ciro (TL)": sp.revenue,
      "Ortalama Fiş Tutarı (TL)": sp.avgTicket,
      "Brüt Kâr (TL)": sp.grossProfit,
      "Kâr Marjı (%)": `%${sp.profitMargin.toFixed(1)}`
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(spData), "Satışçı Performans");

    // 3. Sayfa: Top Ürünler
    const prodData = topProducts.map((p, idx) => ({
      Sıra: idx + 1,
      "Ürün Kodu": p.code,
      "Ürün Adı": p.name,
      "Satılan Adet": p.quantity,
      "Ciro (TL)": p.revenue,
      "Brüt Kâr (TL)": p.grossProfit,
      "Kâr Marjı (%)": `%${p.profitMargin.toFixed(1)}`
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prodData), "Ürün Kârlılık");

    // 4. Sayfa: Ölü Stok
    const deadData = deadStockProducts.map((p) => ({
      "Ürün Kodu": p.code,
      "Ürün Adı": p.name,
      "Depodaki Stok": p.stock,
      "Birim Maliyet (TL)": p.costPrice,
      "Kilitli Sermaye (TL)": p.totalLockedCapital
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deadData), "Hareketsiz Stoklar");

    // 5. Sayfa: Çek Takip
    const checkData = upcomingChecks.map((c) => ({
      "Makbuz No": c.receiptNo,
      "Müşteri Firma": c.customerCompany,
      "Çek No": c.checkNumber,
      "Tutar (TL)": c.amount,
      "Vade Tarihi": formatDate(c.dueDate),
      "Kalan Gün / Durum": c.statusLabel
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(checkData), "Çek Takip");

    XLSX.writeFile(wb, `Patron_Raporu_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast("Patron & Yönetici Raporu Excel olarak indirildi.", "success");
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade">
        <section className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="skeleton" style={{ width: "240px", height: "28px" }} />
          <div className="skeleton" style={{ width: "160px", height: "38px" }} />
        </section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card" style={{ height: "110px" }}>
              <div className="skeleton" style={{ width: "60%", height: "16px", marginBottom: "0.5rem" }} />
              <div className="skeleton" style={{ width: "80%", height: "28px" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade">
      {/* ÜST BAŞLIK & PATRON BUTONLARI */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "rgba(15, 82, 186, 0.12)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Crown size={20} />
            </div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Patron & Yönetici Masası (Executive Dashboard)</h2>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Kârlılık analizi, satışçı performans sıralaması, ölü stok alarmı ve nakit akış takvimi
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" className="btn btn-secondary" onClick={handleExportExcel} style={{ gap: "0.4rem", fontSize: "0.88rem" }}>
            <FileSpreadsheet size={16} /> <span>Excel İndir</span>
          </button>
          <button type="button" className="btn btn-primary" onClick={handleExportPDF} style={{ gap: "0.4rem", fontSize: "0.88rem" }}>
            <Download size={16} /> <span>Patron Raporu PDF</span>
          </button>
        </div>
      </div>

      {/* TARİH FİLTRESİ ŞERİDİ */}
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", padding: "0.85rem 1.25rem" }}>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-muted)", marginRight: "0.25rem" }}>Dönem:</span>
          <button
            type="button"
            className={`btn btn-sm ${datePreset === "this_month" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setDatePreset("this_month")}
          >
            Bu Ay
          </button>
          <button
            type="button"
            className={`btn btn-sm ${datePreset === "last_month" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setDatePreset("last_month")}
          >
            Geçen Ay
          </button>
          <button
            type="button"
            className={`btn btn-sm ${datePreset === "last_30" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setDatePreset("last_30")}
          >
            Son 30 Gün
          </button>
          <button
            type="button"
            className={`btn btn-sm ${datePreset === "this_year" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setDatePreset("this_year")}
          >
            Bu Yıl
          </button>
          <button
            type="button"
            className={`btn btn-sm ${datePreset === "all" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setDatePreset("all")}
          >
            Tümü
          </button>
          <button
            type="button"
            className={`btn btn-sm ${datePreset === "custom" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setDatePreset("custom")}
          >
            Özel Aralık
          </button>
        </div>

        {datePreset === "custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }} className="animate-slide-up">
            <input
              type="date"
              className="form-control"
              style={{ width: "135px", padding: "0.25rem 0.45rem", fontSize: "0.8rem" }}
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
            />
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>-</span>
            <input
              type="date"
              className="form-control"
              style={{ width: "135px", padding: "0.25rem 0.45rem", fontSize: "0.8rem" }}
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* 5'Lİ PATRON FİNANSAL KPI ŞERİDİ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "1rem" }}>
        {/* 1. Ciro */}
        <div className="card" style={{ padding: "1.1rem", borderLeft: "4px solid var(--primary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>Dönem Net Cirosu</span>
            <span style={{ padding: "4px 8px", borderRadius: "6px", backgroundColor: "rgba(15, 82, 186, 0.1)", color: "var(--primary)", fontSize: "0.75rem", fontWeight: 700 }}>
              {filteredSales.length} Satış
            </span>
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--primary)", marginTop: "0.35rem" }}>
            {formatCurrency(kpiMetrics.totalRevenue)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            Maliyet: {formatCurrency(kpiMetrics.totalCost)}
          </div>
        </div>

        {/* 2. Brüt Kâr & Marj */}
        <div className="card" style={{ padding: "1.1rem", borderLeft: "4px solid var(--success)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>Brüt Kâr (Kazanç)</span>
            <span className="badge badge-success" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
              %{kpiMetrics.profitMargin.toFixed(1)} Marj
            </span>
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--success)", marginTop: "0.35rem" }}>
            {formatCurrency(kpiMetrics.grossProfit)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            Net kârlılık katkısı
          </div>
        </div>

        {/* 3. Tahsilat */}
        <div className="card" style={{ padding: "1.1rem", borderLeft: "4px solid #0284c7" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>Dönem Tahsilatı</span>
            <span style={{ padding: "4px 8px", borderRadius: "6px", backgroundColor: "rgba(2, 132, 199, 0.1)", color: "#0284c7", fontSize: "0.75rem", fontWeight: 700 }}>
              {filteredPayments.length} Makbuz
            </span>
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0284c7", marginTop: "0.35rem" }}>
            {formatCurrency(kpiMetrics.totalCollections)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            Kasa + Banka + Kart
          </div>
        </div>

        {/* 4. Piyasadaki Alacak */}
        <div className="card" style={{ padding: "1.1rem", borderLeft: "4px solid var(--danger)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>Piyasadaki Alacak</span>
            <span className="badge badge-danger" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
              Cari Borçlar
            </span>
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--danger)", marginTop: "0.35rem" }}>
            {formatCurrency(kpiMetrics.totalReceivables)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            Müşterilerden beklenen tahsilat
          </div>
        </div>

        {/* 5. Depodaki Stok Sermayesi */}
        <div className="card" style={{ padding: "1.1rem", borderLeft: "4px solid #64748b" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>Depo Stok Sermayesi</span>
            <span style={{ padding: "4px 8px", borderRadius: "6px", backgroundColor: "rgba(100, 116, 139, 0.1)", color: "#64748b", fontSize: "0.75rem", fontWeight: 700 }}>
              {products.length} Çeşit
            </span>
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#334155", marginTop: "0.35rem" }}>
            {formatCurrency(kpiMetrics.totalInventoryValue)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            Maliyet bazlı toplam stok değeri
          </div>
        </div>
      </div>

      {/* SEKME BAŞLIKLARI */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className={`btn ${activeTab === "salespeople" ? "btn-primary" : "btn-secondary"}`}
          style={{ borderRadius: "var(--radius-sm) var(--radius-sm) 0 0", borderBottom: "none", fontSize: "0.9rem", gap: "0.4rem", padding: "0.6rem 1.1rem" }}
          onClick={() => setActiveTab("salespeople")}
        >
          <Award size={16} /> <span>1. Satışçı Performans & Ciro Masası ({salespeoplePerformance.length})</span>
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "products" ? "btn-primary" : "btn-secondary"}`}
          style={{ borderRadius: "var(--radius-sm) var(--radius-sm) 0 0", borderBottom: "none", fontSize: "0.9rem", gap: "0.4rem", padding: "0.6rem 1.1rem" }}
          onClick={() => setActiveTab("products")}
        >
          <TrendingUp size={16} /> <span>2. Ürün Kârlılık & Ölü Stok Alarmı ({deadStockProducts.length} Riskli)</span>
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "cashflow" ? "btn-primary" : "btn-secondary"}`}
          style={{ borderRadius: "var(--radius-sm) var(--radius-sm) 0 0", borderBottom: "none", fontSize: "0.9rem", gap: "0.4rem", padding: "0.6rem 1.1rem" }}
          onClick={() => setActiveTab("cashflow")}
        >
          <CreditCard size={16} /> <span>3. Nakit Akışı & Çek Vade Takvimi ({upcomingChecks.length} Çek)</span>
        </button>
      </div>

      {/* --- SEKME 1: SATIŞÇI PERFORMANS & CİRO MASASI --- */}
      {activeTab === "salespeople" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }} className="animate-fade">
          {/* Liderlik Podyumu (Top 3 Satışçı) */}
          {salespeoplePerformance.length >= 2 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
              {salespeoplePerformance.slice(0, 3).map((sp, idx) => {
                const medal = idx === 0 ? "🥇 Şampiyon Satışçı" : idx === 1 ? "🥈 İkinci Sıra" : "🥉 Üçüncü Sıra";
                const bgGradient =
                  idx === 0
                    ? "linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(234, 179, 8, 0.05) 100%)"
                    : idx === 1
                    ? "linear-gradient(135deg, rgba(148, 163, 184, 0.15) 0%, rgba(148, 163, 184, 0.05) 100%)"
                    : "linear-gradient(135deg, rgba(180, 83, 9, 0.15) 0%, rgba(180, 83, 9, 0.05) 100%)";
                const borderColor = idx === 0 ? "#eab308" : idx === 1 ? "#94a3b8" : "#b45309";

                return (
                  <div
                    key={sp.id}
                    className="card"
                    style={{
                      background: bgGradient,
                      borderColor,
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.6rem",
                      padding: "1.25rem"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 800, color: borderColor }}>{medal}</span>
                      <span className="badge badge-primary" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                        {sp.salesCount} Fiş
                      </span>
                    </div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)" }}>{sp.name}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", marginTop: "0.2rem" }}>
                      <span style={{ color: "var(--text-muted)" }}>Üretilen Ciro:</span>
                      <strong style={{ color: "var(--primary)" }}>{formatCurrency(sp.revenue)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                      <span style={{ color: "var(--text-muted)" }}>Ortalama Fiş:</span>
                      <strong style={{ color: "var(--text-primary)" }}>{formatCurrency(sp.avgTicket)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                      <span style={{ color: "var(--text-muted)" }}>Brüt Kâr Katkısı:</span>
                      <strong style={{ color: "var(--success)" }}>{formatCurrency(sp.grossProfit)} (%{sp.profitMargin.toFixed(1)})</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Satışçı Tablosu */}
          {salespeoplePerformance.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Bu Dönemde Satış Kaydı Yok"
              description="Seçilen tarih aralığında onaylanmış herhangi bir satışçı işlemi bulunmamaktadır."
            />
          ) : (
            <div className="table-container">
              <table className="table" style={{ fontSize: "0.88rem" }}>
                <thead>
                  <tr>
                    <th style={{ width: "40px", textAlign: "center" }}>#</th>
                    <th>Satış Temsilcisi</th>
                    <th style={{ textAlign: "center" }}>Onaylı Fiş</th>
                    <th style={{ textAlign: "right" }}>Ortalama Fiş (Sepet)</th>
                    <th style={{ textAlign: "right" }}>Üretilen Net Ciro</th>
                    <th style={{ textAlign: "right" }}>Brüt Kâr Katkısı</th>
                    <th style={{ textAlign: "center" }}>Kâr Marjı</th>
                  </tr>
                </thead>
                <tbody>
                  {salespeoplePerformance.map((sp, idx) => (
                    <tr key={sp.id}>
                      <td style={{ textAlign: "center", fontWeight: 800, color: idx === 0 ? "#eab308" : idx === 1 ? "#94a3b8" : idx === 2 ? "#b45309" : "var(--text-muted)" }}>
                        {idx + 1}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{sp.name}</div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="badge badge-secondary" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                          {sp.salesCount} Satış
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: "var(--text-secondary)" }}>
                        {formatCurrency(sp.avgTicket)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 800, color: "var(--primary)", fontSize: "0.95rem" }}>
                        {formatCurrency(sp.revenue)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--success)" }}>
                        {formatCurrency(sp.grossProfit)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="badge badge-success" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                          %{sp.profitMargin.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- SEKME 2: ÜRÜN KÂRLILIK & ÖLÜ STOK ALARMI --- */}
      {activeTab === "products" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade">
          {/* Top 10 Çok Satan ve Kâr Bırakan Ürünler */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <TrendingUp size={18} color="var(--primary)" />
                  <span>En Çok Satan & Kâr Bırakan Ürünler (Top 10)</span>
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginTop: "0.2rem" }}>
                  Dönem içinde şirket cirosunu ve kârlılığını sırtlayan lokomotif ürünler
                </p>
              </div>
            </div>

            {topProducts.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Satış Gören Ürün Yok"
                description="Seçilen dönemde henüz onaylı satış kaydı bulunmamaktadır."
              />
            ) : (
              <div className="table-container">
                <table className="table" style={{ fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "40px", textAlign: "center" }}>#</th>
                      <th>Ürün Kodu & Adı</th>
                      <th style={{ textAlign: "center" }}>Satılan Miktar</th>
                      <th style={{ textAlign: "right" }}>Üretilen Ciro</th>
                      <th style={{ textAlign: "right" }}>Brüt Kâr</th>
                      <th style={{ textAlign: "center" }}>Kâr Marjı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.slice(0, 10).map((p, idx) => (
                      <tr key={p.id}>
                        <td style={{ textAlign: "center", fontWeight: 700, color: "var(--text-muted)" }}>{idx + 1}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{p.code}</div>
                        </td>
                        <td style={{ textAlign: "center", fontWeight: 700 }}>
                          <span className="badge badge-secondary">{p.quantity} Adet</span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--primary)" }}>
                          {formatCurrency(p.revenue)}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--success)" }}>
                          {formatCurrency(p.grossProfit)}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className="badge badge-success" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                            %{p.profitMargin.toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ⚠️ ÖLÜ / HAREKETSİZ STOK ALARMI (DEPODA YATAN PARA) */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.75rem" }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--danger)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <AlertTriangle size={18} />
                  <span>Ölü / Hareketsiz Stok Alarmı (Depoda Yatan Para)</span>
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginTop: "0.2rem" }}>
                  Bu dönemde hiç satış görmemiş ve depoda bekleyen ürünler
                </p>
              </div>

              <div style={{ padding: "0.5rem 1rem", backgroundColor: "rgba(239, 68, 68, 0.08)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(239, 68, 68, 0.2)", textAlign: "right" }}>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>Depoda Kilitli Sermaye:</div>
                <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--danger)" }}>
                  {formatCurrency(deadStockProducts.reduce((s, p) => s + p.totalLockedCapital, 0))}
                </div>
              </div>
            </div>

            {deadStockProducts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--success)", fontWeight: 600, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                <CheckCircle2 size={32} />
                <span>Harika! Depodaki tüm ürünler seçilen dönemde satış görmüştür, hareketsiz stok bulunmuyor.</span>
              </div>
            ) : (
              <div className="table-container" style={{ maxHeight: "350px", overflowY: "auto" }}>
                <table className="table" style={{ fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th>Ürün Kodu & Adı</th>
                      <th style={{ textAlign: "center" }}>Depodaki Stok</th>
                      <th style={{ textAlign: "right" }}>Birim Maliyet</th>
                      <th style={{ textAlign: "right" }}>Depoda Bağlı Para</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deadStockProducts.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{p.code}</div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className="badge badge-warning" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                            {p.stock} Adet
                          </span>
                        </td>
                        <td style={{ textAlign: "right", color: "var(--text-secondary)" }}>
                          {formatCurrency(p.costPrice)}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 800, color: "var(--danger)" }}>
                          {formatCurrency(p.totalLockedCapital)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SEKME 3: NAKİT AKIŞI & ÇEK VADE TAKVİMİ --- */}
      {activeTab === "cashflow" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade">
          {/* Tahsilat Yöntemleri Dağılımı */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
            <div className="card" style={{ padding: "1.1rem" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>Nakit Kasa Girişi</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--success)", marginTop: "0.25rem" }}>
                {formatCurrency(paymentBreakdown.cash)}
              </div>
            </div>

            <div className="card" style={{ padding: "1.1rem" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>Kredi Kartı / POS</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--primary)", marginTop: "0.25rem" }}>
                {formatCurrency(paymentBreakdown.credit_card)}
              </div>
            </div>

            <div className="card" style={{ padding: "1.1rem" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>Banka Havalesi / EFT</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0284c7", marginTop: "0.25rem" }}>
                {formatCurrency(paymentBreakdown.bank_transfer)}
              </div>
            </div>

            <div className="card" style={{ padding: "1.1rem" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>Çek / Senet Portföyü</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#d97706", marginTop: "0.25rem" }}>
                {formatCurrency(paymentBreakdown.check)}
              </div>
            </div>
          </div>

          {/* 📅 YAKLAŞAN VE VADESİ GEÇMİŞ ÇEKLER ALARM TABLOSU */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.75rem" }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Calendar size={18} color="var(--primary)" />
                  <span>Çek & Senet Vade ve Tahsilat Masası</span>
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginTop: "0.2rem" }}>
                  Portföydeki müşteri çekleri, yaklaşan vadeler ve tek tıkla tahsilat / karşılıksız çek yönetimi
                </p>
              </div>

              {/* Alt Sekmeler (Portföyde / Karşılıksız / Tahsil Edilenler / Tümü) */}
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setCheckStatusTab("portfolio")}
                  className={`btn btn-sm ${checkStatusTab === "portfolio" ? "btn-warning" : "btn-secondary"}`}
                  style={{ fontSize: "0.78rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <Clock size={14} />
                  <span>Portföyde Bekleyen ({checkCounts.portfolioCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCheckStatusTab("bounced")}
                  className={`btn btn-sm ${checkStatusTab === "bounced" ? "btn-danger" : "btn-secondary"}`}
                  style={{ fontSize: "0.78rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <AlertTriangle size={14} />
                  <span>Karşılıksız ({checkCounts.bouncedCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCheckStatusTab("collected")}
                  className={`btn btn-sm ${checkStatusTab === "collected" ? "btn-success" : "btn-secondary"}`}
                  style={{ fontSize: "0.78rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <Check size={14} />
                  <span>Tahsil Edilenler ({checkCounts.collectedCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCheckStatusTab("all")}
                  className={`btn btn-sm ${checkStatusTab === "all" ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: "0.78rem", fontWeight: 600 }}
                >
                  Tümü ({checkCounts.totalCount})
                </button>
              </div>
            </div>

            {displayedChecks.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title={
                  checkStatusTab === "portfolio"
                    ? "Portföyde Bekleyen Çek Yok"
                    : checkStatusTab === "bounced"
                    ? "Karşılıksız Çek Bulunmuyor"
                    : checkStatusTab === "collected"
                    ? "Tahsil Edilmiş Çek Kaydı Yok"
                    : "Kayıtlı Çek / Senet Bulunmuyor"
                }
                description={
                  checkStatusTab === "portfolio"
                    ? "Vadesi bekleyen aktif müşteri çeki bulunmuyor. Tüm çekler tahsil edilmiş veya kapatılmıştır."
                    : checkStatusTab === "bounced"
                    ? "Harika! Sistemde karşılıksız/protestolu işaretlenmiş riskli çek kaydı yoktur."
                    : "Bu sekmede listelenecek çek veya senet kaydı bulunmamaktadır."
                }
              />
            ) : (
              <div className="table-container">
                <table className="table" style={{ fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th>Makbuz / Fiş No</th>
                      <th>Müşteri / Firma</th>
                      <th>Çek / Senet No</th>
                      <th style={{ textAlign: "right" }}>Tutar</th>
                      <th>Vade Tarihi</th>
                      <th style={{ textAlign: "center" }}>Vade Alarmı</th>
                      <th style={{ textAlign: "center" }}>Çek Durumu</th>
                      <th style={{ textAlign: "right" }}>Eylem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedChecks.map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.receiptNo}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--primary)" }}>{c.customerCompany}</div>
                        </td>
                        <td>
                          <span className="badge badge-secondary" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                            {c.checkNumber}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 800, color: "var(--text-primary)" }}>
                          {formatCurrency(c.amount)}
                        </td>
                        <td style={{ fontWeight: 600 }}>{formatDate(c.dueDate)}</td>
                        <td style={{ textAlign: "center" }}>
                          <span
                            className={`badge badge-${c.statusColor}`}
                            style={{ fontSize: "0.75rem", fontWeight: 700, padding: "3px 8px" }}
                          >
                            {c.statusLabel}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {c.checkStatus === "collected" ? (
                            <span className="badge badge-success" style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                              ✓ Tahsil Edildi
                            </span>
                          ) : c.checkStatus === "bounced" ? (
                            <span className="badge badge-danger" style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                              ✗ Karşılıksız
                            </span>
                          ) : (
                            <span className="badge badge-warning" style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                              ⏳ Portföyde
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {c.source === "sale" && c.checkStatus === "portfolio" ? (
                            <div style={{ display: "flex", gap: "0.35rem", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                onClick={() => handleCollectCheck(c)}
                                className="btn btn-sm btn-success"
                                style={{ padding: "3px 7px", fontSize: "0.73rem", display: "inline-flex", alignItems: "center", gap: "3px" }}
                                title="Çeki tahsil et, cari borçtan düş ve kapat"
                              >
                                <Check size={12} />
                                <span>Tahsil Et</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleBounceCheck(c)}
                                className="btn btn-sm btn-danger"
                                style={{ padding: "3px 7px", fontSize: "0.73rem", display: "inline-flex", alignItems: "center", gap: "3px" }}
                                title="Karşılıksız / Protestolu Olarak İşaretle"
                              >
                                <AlertTriangle size={12} />
                                <span>Karşılıksız</span>
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveReports;
