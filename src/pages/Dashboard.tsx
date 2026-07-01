// Takip Sistemi - Yönetici Paneli (Dashboard)
import React, { useState, useEffect } from "react";
import { getSales, getProducts } from "../services/db";
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
  Percent
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Sale, Product } from "../types";

const Dashboard = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [salesData, productsData] = await Promise.all([getSales(), getProducts()]);
        setSales(salesData);
        setProducts(productsData);
      } catch (err) {
        console.error("Dashboard verileri yüklenirken hata:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade">
        <section className="grid-cols-4">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </section>
        <section className="skeleton-card" style={{ height: "120px" }} />
        <section style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }} className="grid-cols-2">
          <div className="skeleton-card" style={{ height: "300px" }} />
          <div className="skeleton-card" style={{ height: "300px" }} />
        </section>
      </div>
    );
  }

  const approvedSales = sales.filter(s => s.status === "approved");
  const pendingSales = sales.filter(s => s.status === "pending_accounting");

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

  const dailySalesRevenue = approvedSales
    .filter(s => new Date(s.date) >= startOfToday)
    .reduce((sum, s) => sum + (s.netAmount || 0), 0);

  const weeklySalesRevenue = approvedSales
    .filter(s => new Date(s.date) >= oneWeekAgo)
    .reduce((sum, s) => sum + (s.netAmount || 0), 0);

  const monthlySalesRevenue = approvedSales
    .filter(s => new Date(s.date) >= oneMonthAgo)
    .reduce((sum, s) => sum + (s.netAmount || 0), 0);

  const criticalStockProducts = products.filter(p => p.stock <= p.criticalStock);

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

      const dayTotal = approvedSales
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade">

      <section className="grid-cols-4">
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ padding: "0.75rem", borderRadius: "var(--radius-md)", backgroundColor: "var(--success-light)", color: "var(--success)" }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Toplam Ciro</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>
              {totalRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </div>
          </div>
        </div>

        <Link to="/accounting" className="card" style={{ display: "flex", alignItems: "center", gap: "1rem", cursor: "pointer" }}>
          <div style={{ padding: "0.75rem", borderRadius: "var(--radius-md)", backgroundColor: pendingSales.length > 0 ? "var(--warning-light)" : "var(--primary-light)", color: pendingSales.length > 0 ? "var(--warning)" : "var(--primary)" }}>
            <CheckSquare size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Bekleyen Onay</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>
              {pendingSales.length} Kayıt
            </div>
          </div>
        </Link>

        <Link to="/inventory" className="card" style={{ display: "flex", alignItems: "center", gap: "1rem", cursor: "pointer" }}>
          <div style={{ padding: "0.75rem", borderRadius: "var(--radius-md)", backgroundColor: criticalStockProducts.length > 0 ? "var(--danger-light)" : "var(--primary-light)", color: criticalStockProducts.length > 0 ? "var(--danger)" : "var(--primary)" }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Kritik Stok Uyarısı</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>
              {criticalStockProducts.length} Ürün
            </div>
          </div>
        </Link>

        <Link to="/inventory" className="card" style={{ display: "flex", alignItems: "center", gap: "1rem", cursor: "pointer" }}>
          <div style={{ padding: "0.75rem", borderRadius: "var(--radius-md)", backgroundColor: "var(--info-light)", color: "var(--info)" }}>
            <Package size={24} />
          </div>
          <div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Toplam Ürün Çeşidi</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>
              {products.length} Barkod
            </div>
          </div>
        </Link>
      </section>

      {hasCostData && (
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }} className="grid-cols-2">
          <div className="card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ padding: "0.75rem", borderRadius: "var(--radius-md)", backgroundColor: "var(--success-light)", color: "var(--success)" }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Toplam Brüt Kar</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem", color: grossProfit >= 0 ? "var(--success)" : "var(--danger)" }}>
                {grossProfit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </div>
            </div>
          </div>
          <div className="card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ padding: "0.75rem", borderRadius: "var(--radius-md)", backgroundColor: (profitMarginPct ?? 0) >= 20 ? "var(--success-light)" : (profitMarginPct ?? 0) >= 10 ? "var(--warning-light)" : "var(--danger-light)", color: (profitMarginPct ?? 0) >= 20 ? "var(--success)" : (profitMarginPct ?? 0) >= 10 ? "var(--warning-hover)" : "var(--danger)" }}>
              <Percent size={24} />
            </div>
            <div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>Ortalama Kar Marjı</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>
                %{profitMarginPct?.toFixed(1) ?? "—"}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="card" style={{ padding: "1.5rem" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Calendar size={18} />
          <span>Dönemsel Satış Performansı</span>
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          <div style={{ padding: "1rem", backgroundColor: "var(--bg-primary)", borderRadius: "var(--radius-sm)", borderLeft: "4px solid var(--primary)" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 500 }}>GÜNLÜK CİRO</span>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: "0.25rem", color: "var(--text-primary)" }}>
              {dailySalesRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </div>
          </div>
          <div style={{ padding: "1rem", backgroundColor: "var(--bg-primary)", borderRadius: "var(--radius-sm)", borderLeft: "4px solid var(--info)" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 500 }}>HAFTALIK CİRO</span>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: "0.25rem", color: "var(--text-primary)" }}>
              {weeklySalesRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </div>
          </div>
          <div style={{ padding: "1rem", backgroundColor: "var(--bg-primary)", borderRadius: "var(--radius-sm)", borderLeft: "4px solid var(--success)" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 500 }}>AYLIK CİRO</span>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: "0.25rem", color: "var(--text-primary)" }}>
              {monthlySalesRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </div>
          </div>
        </div>
      </section>

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
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v: any) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                formatter={(v: any) => [`${v.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`, "Ciro"]}
                contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem" }}
                labelStyle={{ fontWeight: 700, color: "var(--text-primary)" }}
              />
              <Area type="monotone" dataKey="ciro" stroke="#2563eb" strokeWidth={2.5} fill="url(#ciroGrad)" dot={{ r: 4, fill: "#2563eb", strokeWidth: 0 }} activeDot={{ r: 6, fill: "#f59e0b" }} />
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
                        {sp.totalRevenue.toLocaleString('tr-TR')} ₺
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
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" interval={0} />
                  <YAxis tickFormatter={(v: any) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} tick={{ fontSize: 10, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip
                    formatter={(v: any) => [`${v.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`, "Ciro"]}
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
                      formatter={(v: any) => [`${v.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`]}
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
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                      Satış kaydı bulunamadı.
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
                        {p.revenue.toLocaleString('tr-TR')} ₺
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: p.hasCost ? (p.profit >= 0 ? "var(--success)" : "var(--danger)") : "var(--text-muted)", fontSize: "0.85rem" }}>
                        {p.hasCost ? `${p.profit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : "—"}
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
                      Tarih: {new Date(sale.date).toLocaleDateString('tr-TR')} | Temsilci: {sale.salespersonName}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.95rem" }}>
                      {sale.netAmount.toLocaleString('tr-TR')} ₺
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
