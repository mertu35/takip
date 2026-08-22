// Takip Sistemi - Yönetici Paneli (Dashboard)
import React, { useState, useEffect, useMemo } from "react";
import { getSales, getProducts, getCustomers, getPayments } from "../services/db";
import { useTheme } from "../context/ThemeContext";
import { formatCurrency, formatDate } from "../utils/format";
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip
} from "recharts";
import {
  TrendingUp,
  Package,
  CheckSquare,
  DollarSign,
  AlertTriangle,
  Award,
  Calendar,
  Clock,
  ArrowRight,
  Wallet,
  Receipt
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Sale, Product, Customer, Payment } from "../types";

type DashboardDateFilter = "all" | "today" | "week" | "month" | "year" | "custom";

const CHART_PALETTE = {
  light: { primary: "#1e3a8a", warning: "#c2410c", border: "#cbd5e1", textSecondary: "#334155" },
  dark: { primary: "#3b82f6", warning: "#f97316", border: "#242f49", textSecondary: "#94a3b8" }
} as const;

const Dashboard = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();

  // Tarih Filtresi State
  // Varsayılan "Bu Yıl": eskiden "Tümü" idi ve Dashboard her açılışta TÜM
  // satışları indiriyordu. Firestore her dokümanı ayrı okuma saydığı için
  // bu, veri büyüdükçe en pahalı ekran oluyordu. "Tümü" seçeneği duruyor,
  // isteyen tek tıkla tüm zamanlara bakabilir.
  const [dateFilter, setDateFilter] = useState<DashboardDateFilter>("year");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const chartColor = useMemo(() => CHART_PALETTE[theme] ?? CHART_PALETTE.light, [theme]);

  // Seçili döneme göre sorguya gönderilecek başlangıç tarihi.
  // null dönerse (Tümü / Özel) eski davranış geçerli: hepsini getir.
  const querySince = useMemo(() => {
    const now = new Date();
    if (dateFilter === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dateFilter === "week") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d;
    }
    if (dateFilter === "month") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d;
    }
    if (dateFilter === "year") return new Date(now.getFullYear(), 0, 1);
    if (dateFilter === "custom" && customStartDate) return new Date(`${customStartDate}T00:00:00`);
    return null;
  }, [dateFilter, customStartDate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [salesData, productsData, customersData, paymentsData] = await Promise.all([
          getSales(undefined, undefined, querySince ? { since: querySince.toISOString() } : undefined),
          getProducts(),
          getCustomers(),
          getPayments().catch(() => [] as Payment[])
        ]);
        setSales(salesData);
        setProducts(productsData);
        setCustomers(customersData);
        setPayments(paymentsData);
      } catch (err) {
        console.error("Dashboard verileri yüklenirken hata:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // Dönem değişince veri yeniden çekilir (filtre artık sunucu tarafında).
  }, [querySince]);

  // Tarih Filtreleme Fonksiyonu
  // NOT: Sorgu zaten başlangıç tarihine göre daraltıyor; bu fonksiyon bitiş
  // tarihi ve "özel aralık" için istemci tarafında ikinci bir süzgeç olarak
  // kalıyor. İkisi çakışmaz, sadece aynı sonucu garantiler.
  const matchesDate = (dateStr: string): boolean => {
    if (dateFilter === "all") return true;

    const saleDate = new Date(dateStr);
    const now = new Date();

    if (dateFilter === "today") {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return saleDate >= startOfToday;
    }

    if (dateFilter === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return saleDate >= weekAgo;
    }

    if (dateFilter === "month") {
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      return saleDate >= monthAgo;
    }

    if (dateFilter === "year") {
      return saleDate >= new Date(now.getFullYear(), 0, 1);
    }

    if (dateFilter === "custom") {
      if (customStartDate && saleDate < new Date(`${customStartDate}T00:00:00`)) return false;
      if (customEndDate && saleDate > new Date(`${customEndDate}T23:59:59`)) return false;
      return true;
    }

    return true;
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade">
        <section className="grid-cols-4" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", minHeight: "110px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="skeleton" style={{ width: "80px", height: "14px" }} />
                <div className="skeleton" style={{ width: "32px", height: "32px", borderRadius: "8px" }} />
              </div>
              <div className="skeleton" style={{ width: "130px", height: "26px" }} />
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }} className="grid-cols-2">
          <div className="card" style={{ minHeight: "340px", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="skeleton" style={{ width: "140px", height: "20px" }} />
            <div className="skeleton" style={{ width: "100%", height: "260px", borderRadius: "10px" }} />
          </div>
          <div className="card" style={{ minHeight: "340px", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="skeleton" style={{ width: "140px", height: "20px" }} />
            <div className="skeleton" style={{ width: "100%", height: "260px", borderRadius: "10px" }} />
          </div>
        </section>
      </div>
    );
  }

  // Filtrelenmiş Satışlar
  const allApprovedSales = sales.filter(s => s.status === "approved");
  const approvedSales = allApprovedSales.filter(s => matchesDate(s.date));
  const pendingSales = sales.filter(s => s.status === "pending_accounting" && matchesDate(s.date));

  const totalRevenue = approvedSales.reduce((sum, s) => sum + (s.netAmount || 0), 0);

  const grossProfit = approvedSales.reduce((sum, s) => {
    const saleProfit = (s.items || []).reduce((itemSum, item: any) => {
      const cost = (item.costPrice ?? 0) * (item.quantity || 0);
      return itemSum + ((item.total || 0) - cost);
    }, 0);
    return sum + saleProfit;
  }, 0);

  const hasCostData = approvedSales.some(s => (s.items || []).some((i: any) => (i.costPrice ?? 0) > 0));
  const profitMarginPct: number | null = totalRevenue > 0 && hasCostData ? (grossProfit / totalRevenue * 100) : null;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

  const dailySalesRevenue = allApprovedSales
    .filter(s => new Date(s.date) >= startOfToday)
    .reduce((sum, s) => sum + (s.netAmount || 0), 0);

  const weeklySalesRevenue = allApprovedSales
    .filter(s => new Date(s.date) >= oneWeekAgo)
    .reduce((sum, s) => sum + (s.netAmount || 0), 0);

  const monthlySalesRevenue = allApprovedSales
    .filter(s => new Date(s.date) >= oneMonthAgo)
    .reduce((sum, s) => sum + (s.netAmount || 0), 0);

  const criticalStockProducts = products.filter(p => p.stock <= p.criticalStock);

  const filteredPayments = payments.filter(p => matchesDate(p.date));
  const totalCollections = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalReceivables = customers.reduce((sum, c) => sum + Math.max(0, c.currentBalance || 0), 0);

  const productSalesMap: Record<string, any> = {};
  approvedSales.forEach(sale => {
    if (sale.items) {
      sale.items.forEach((item: any) => {
        if (!productSalesMap[item.productId]) {
          productSalesMap[item.productId] = {
            name: item.productName,
            code: item.productCode,
            quantity: 0,
            revenue: 0,
            profit: 0,
            hasCost: false
          };
        }
        productSalesMap[item.productId].quantity += (item.quantity || 0);
        productSalesMap[item.productId].revenue += (item.total || 0);
        if ((item.costPrice ?? 0) > 0) {
          productSalesMap[item.productId].profit += (item.total || 0) - (item.costPrice * item.quantity);
          productSalesMap[item.productId].hasCost = true;
        }
      });
    }
  });

  const topSellingProducts = Object.values(productSalesMap)
    .sort((a: any, b: any) => b.quantity - a.quantity)
    .slice(0, 5);

  const performanceMap: Record<string, any> = {};
  approvedSales.forEach(sale => {
    const spId = sale.salespersonId || "Bilinmeyen";
    if (!performanceMap[spId]) {
      performanceMap[spId] = {
        name: sale.salespersonName || "Bilinmeyen Satıcı",
        totalRevenue: 0,
        salesCount: 0
      };
    }
    performanceMap[spId].totalRevenue += (sale.netAmount || 0);
    performanceMap[spId].salesCount += 1;
  });

  const salespersonPerformance = Object.values(performanceMap)
    .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue);

  const getCategorySalesData = () => {
    const catMap: Record<string, number> = {};
    approvedSales.forEach(sale => {
      if (sale.items) {
        sale.items.forEach((item: any) => {
          const catName = item.categoryName || "Kategorisiz";
          if (!catMap[catName]) catMap[catName] = 0;
          catMap[catName] += (item.total || 0);
        });
      }
    });
    return Object.entries(catMap).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const categorySales = getCategorySalesData();

  const getSalesTrendData = () => {
    const trend: { label: string; ciro: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

      const dayTotal = allApprovedSales
        .filter(s => {
          const saleDate = new Date(s.date);
          return saleDate >= dayStart && saleDate <= dayEnd;
        })
        .reduce((sum, s) => sum + (s.netAmount || 0), 0);

      trend.push({ label: dateString, ciro: dayTotal });
    }
    return trend;
  };

  const trendData = getSalesTrendData();

  const dateFilterLabels: Record<DashboardDateFilter, string> = {
    all: "Tümü",
    today: "Bugün",
    week: "Bu Hafta",
    month: "Bu Ay",
    year: "Bu Yıl",
    custom: "Özel Tarih"
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade">

      {/* Üst Banner & Patron Raporu Geçişi */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1rem"
      }}>
        <div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 800 }}>Yönetici Dashboard</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
            Şirket genel operasyon özeti ve gerçek zamanlı satış grafikleri
          </p>
        </div>

        <Link
          to="/reports"
          className="btn btn-primary"
          style={{
            gap: "0.45rem",
            padding: "0.55rem 1.1rem",
            fontSize: "0.9rem",
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 2px 8px rgba(15, 82, 186, 0.25)"
          }}
        >
          <TrendingUp size={18} />
          <span>👑 Patron & Yönetici Raporları</span>
          <ArrowRight size={16} />
        </Link>
      </div>

      {/* Tarih Filtreleme Çubuğu */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1rem",
        padding: "0.75rem 1.25rem",
        backgroundColor: "var(--bg-secondary)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-color)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Calendar size={18} color="var(--primary)" />
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Rapor Dönemi:</span>
          {dateFilter !== "all" && (
            <span className="badge badge-primary" style={{ fontSize: "0.75rem" }}>
              {dateFilterLabels[dateFilter]}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          {(["all", "today", "week", "month", "year", "custom"] as DashboardDateFilter[]).map((f) => {
            const isActive = dateFilter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setDateFilter(f)}
                className={`btn btn-sm ${isActive ? "btn-primary" : "btn-secondary"}`}
                style={{ padding: "0.25rem 0.65rem", fontSize: "0.78rem" }}
              >
                {dateFilterLabels[f]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Özel Tarih Aralığı Seçim Çubuğu */}
      {dateFilter === "custom" && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.75rem 1rem",
          backgroundColor: "var(--bg-tertiary)",
          borderRadius: "var(--radius-sm)",
          flexWrap: "wrap"
        }} className="animate-slide-up">
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)" }}>
            Aralık Seçin:
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Başlangıç:</span>
            <input
              type="date"
              className="form-control"
              style={{ width: "140px", padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
              value={customStartDate}
              onChange={e => setCustomStartDate(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Bitiş:</span>
            <input
              type="date"
              className="form-control"
              style={{ width: "140px", padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
              value={customEndDate}
              onChange={e => setCustomEndDate(e.target.value)}
            />
          </div>
          {(customStartDate || customEndDate) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
              onClick={() => { setCustomStartDate(""); setCustomEndDate(""); }}
            >
              Tarihleri Temizle
            </button>
          )}
        </div>
      )}

      {/* Üst KPI Kartları */}
      <section className="grid-cols-4">
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ padding: "0.75rem", borderRadius: "var(--radius-md)", backgroundColor: "var(--success-light)", color: "var(--success)" }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              {dateFilter === "all" ? "Toplam Ciro" : `Dönem Cirosu (${dateFilterLabels[dateFilter]})`}
            </div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)" }}>
              {formatCurrency(totalRevenue)}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ padding: "0.75rem", borderRadius: "var(--radius-md)", backgroundColor: "var(--primary-light)", color: "var(--primary)" }}>
            <CheckSquare size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Onaylanan Satış</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)" }}>
              {approvedSales.length} Adet
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ padding: "0.75rem", borderRadius: "var(--radius-md)", backgroundColor: "var(--warning-light)", color: "var(--warning)" }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Onay Bekleyen</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)" }}>
              {pendingSales.length} Adet
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ padding: "0.75rem", borderRadius: "var(--radius-md)", backgroundColor: "var(--danger-light)", color: "var(--danger)" }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Kritik Stok Ürün</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--danger)" }}>
              {criticalStockProducts.length} Çeşit
            </div>
          </div>
        </div>
      </section>

      {/* Dönemsel Satış ve Kar Özeti */}
      <section className="grid-cols-4">
        <div className="card">
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Bugünkü Ciro</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {formatCurrency(dailySalesRevenue)}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Bu Haftaki Ciro</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {formatCurrency(weeklySalesRevenue)}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Bu Ayki Ciro</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {formatCurrency(monthlySalesRevenue)}
          </div>
        </div>
        <div className="card" style={{ position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Tahmini Brüt Kâr</div>
            {profitMarginPct !== null && (
              <span className="badge badge-success" style={{ fontSize: "0.68rem", fontWeight: 700 }}>
                %{profitMarginPct.toFixed(1)} Marj
              </span>
            )}
          </div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: hasCostData ? "var(--success)" : "var(--text-muted)" }}>
            {hasCostData ? formatCurrency(grossProfit) : "—"}
          </div>
          {!hasCostData && (
            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
              Maliyet fiyatı girildiğinde hesaplanır
            </div>
          )}
        </div>
      </section>

      {/* Finansal Durum & Cari Alacak Özeti */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ padding: "0.75rem", borderRadius: "var(--radius-md)", backgroundColor: "rgba(16, 185, 129, 0.12)", color: "var(--success)" }}>
            <Wallet size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              {dateFilter === "all" ? "Toplam Tahsilat" : `Dönem Tahsilatı (${dateFilterLabels[dateFilter]})`}
            </div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--success)" }}>
              {formatCurrency(totalCollections)}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ padding: "0.75rem", borderRadius: "var(--radius-md)", backgroundColor: "rgba(239, 68, 68, 0.12)", color: "var(--danger)" }}>
            <Receipt size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Toplam Piyasa Alacağı (Cari Borç)</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--danger)" }}>
              {formatCurrency(totalReceivables)}
            </div>
          </div>
        </div>
      </section>

      {/* Grafikler: Satış Trendi & Personel Performansı */}
      <section style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }} className="grid-cols-2">

        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <TrendingUp size={18} />
            <span>Son 7 Günlük Satış Trendi</span>
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ciroGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor.primary} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={chartColor.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColor.border} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartColor.textSecondary }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v: any) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} tick={{ fontSize: 11, fill: chartColor.textSecondary }} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                formatter={(v: any) => [formatCurrency(v), "Ciro"]}
                contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem" }}
                labelStyle={{ fontWeight: 700, color: "var(--text-primary)" }}
              />
              <Area type="monotone" dataKey="ciro" stroke={chartColor.primary} strokeWidth={2.5} fill="url(#ciroGrad)" dot={{ r: 4, fill: chartColor.primary, strokeWidth: 0 }} activeDot={{ r: 6, fill: chartColor.warning }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Award size={18} />
            <span>Personel Performansı</span>
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", flex: 1 }}>
            {salespersonPerformance.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", textAlign: "center", margin: "auto" }}>
                Kayıtlı satış performansı yok.
              </div>
            ) : (
              salespersonPerformance.map((sp: any, idx: number) => {
                const maxPerfRev = Math.max(...salespersonPerformance.map((s: any) => s.totalRevenue), 1);
                const pct = (sp.totalRevenue / maxPerfRev) * 100;
                return (
                  <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{sp.name}</span>
                      <span style={{ fontWeight: 700, color: "var(--primary)" }}>
                        {formatCurrency(sp.totalRevenue)}
                      </span>
                    </div>
                    <div style={{ height: "8px", width: "100%", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          backgroundColor: idx === 0 ? "var(--primary)" : "var(--info)",
                          borderRadius: "var(--radius-full)"
                        }}
                      />
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", alignSelf: "flex-end" }}>
                      {sp.salesCount} Satış İşlemi
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Kategori Bazlı Dağılım */}
      {categorySales.length > 0 && (() => {
        const PIE_COLORS = ["#2563eb", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];
        return (
          <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }} className="grid-cols-2">
            <div className="card">
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Package size={18} /><span>Kategori Bazlı Ciro</span>
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categorySales} margin={{ top: 4, right: 16, left: 0, bottom: 32 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColor.border} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: chartColor.textSecondary }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" interval={0} />
                  <YAxis tickFormatter={(v: any) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} tick={{ fontSize: 10, fill: chartColor.textSecondary }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip
                    formatter={(v: any) => [formatCurrency(v), "Ciro"]}
                    contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", fontSize: "0.82rem" }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {categorySales.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ display: "flex", flexDirection: "column" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Package size={18} /><span>Kategori Pay Dağılımı</span>
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1 }}>
                <ResponsiveContainer width="55%" height={200}>
                  <PieChart>
                    <Pie data={categorySales} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                      {categorySales.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v: any) => [formatCurrency(v)]}
                      contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", fontSize: "0.82rem" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1, minWidth: 0 }}>
                  {categorySales.map((cat, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "2px", backgroundColor: PIE_COLORS[idx % PIE_COLORS.length], flexShrink: 0 }} />
                      <span style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* En Çok Satan Ürünler & Son Onay Bekleyen Satışlar */}
      <section className="grid-cols-2">
        <div className="card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <TrendingUp size={18} />
            <span>En Çok Satan Ürünler</span>
          </h3>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Ürün Bilgisi</th>
                  <th style={{ textAlign: "center" }}>Adet</th>
                  <th style={{ textAlign: "right" }}>Ciro</th>
                  <th style={{ textAlign: "right" }}>Brüt Kar</th>
                </tr>
              </thead>
              <tbody>
                {topSellingProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                      Seçilen döneme ait satış kaydı bulunamadı.
                    </td>
                  </tr>
                ) : (
                  topSellingProducts.map((p: any, idx: number) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{p.code}</div>
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 600 }}>{p.quantity} Adet</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--success)" }}>
                        {formatCurrency(p.revenue)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: p.hasCost ? (p.profit >= 0 ? "var(--success)" : "var(--danger)") : "var(--text-muted)", fontSize: "0.85rem" }}>
                        {p.hasCost ? formatCurrency(p.profit) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Clock size={18} />
              <span>Son Onay Bekleyen Satışlar</span>
            </h3>
            <Link to="/accounting" style={{ fontSize: "0.85rem", color: "var(--primary)", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <span>Tümünü Gör</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
            {pendingSales.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", textAlign: "center", margin: "auto" }}>
                Onay bekleyen satış kaydı yok.
              </div>
            ) : (
              pendingSales.slice(0, 4).map((sale, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "0.85rem 1rem",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-primary)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>
                      {sale.customerCompany}
                    </span>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                      Tarih: {formatDate(sale.date)} | Temsilci: {sale.salespersonName}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.95rem" }}>
                      {formatCurrency(sale.netAmount)}
                    </div>
                    <span className="badge badge-warning" style={{ fontSize: "0.6rem", padding: "0.1rem 0.4rem", marginTop: "0.25rem" }}>
                      ONAY BEKLİYOR
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

    </div>
  );
};

export default Dashboard;
