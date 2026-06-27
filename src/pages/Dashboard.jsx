// Takip Sistemi - Yönetici Paneli (Dashboard)
import React, { useState, useEffect } from "react";
import { getSales, getProducts } from "../services/db";
import { 
  TrendingUp, 
  Package, 
  CheckSquare, 
  DollarSign, 
  AlertTriangle, 
  Award,
  Calendar,
  Clock,
  ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [salesData, productsData] = await Promise.all([
          getSales(),
          getProducts()
        ]);
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

  // --- İSTATİSTİKSEL HESAPLAMALAR ---
  const approvedSales = sales.filter(s => s.status === "approved");
  const pendingSales = sales.filter(s => s.status === "pending_accounting");

  // Toplam Ciro (Net Tutar üzerinden)
  const totalRevenue = approvedSales.reduce((sum, s) => sum + (s.netAmount || 0), 0);

  // Günlük, Haftalık, Aylık Satışlar
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

  // Kritik Stok Durumundaki Ürünler
  const criticalStockProducts = products.filter(p => p.stock <= p.criticalStock);

  // En Çok Satılan Ürünler
  const productSalesMap = {};
  approvedSales.forEach(sale => {
    if (sale.items) {
      sale.items.forEach(item => {
        if (!productSalesMap[item.productId]) {
          productSalesMap[item.productId] = {
            name: item.productName,
            code: item.productCode,
            quantity: 0,
            revenue: 0
          };
        }
        productSalesMap[item.productId].quantity += (item.quantity || 0);
        productSalesMap[item.productId].revenue += (item.total || 0);
      });
    }
  });

  const topSellingProducts = Object.values(productSalesMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Satışçı Performans Verileri
  const performanceMap = {};
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
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Kategori Bazlı Satış Hacmi
  const getCategorySalesData = () => {
    const catMap = {};
    approvedSales.forEach(sale => {
      if (sale.items) {
        sale.items.forEach(item => {
          const catName = item.categoryName || "Kategorisiz";
          if (!catMap[catName]) {
            catMap[catName] = 0;
          }
          catMap[catName] += (item.total || 0);
        });
      }
    });
    return Object.entries(catMap).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const categorySales = getCategorySalesData();
  const maxCatVal = Math.max(...categorySales.map(c => c.value), 1);

  // Grafik için son 7 günün satış trendleri
  const getSalesTrendData = () => {
    const trend = [];
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

      trend.push({ label: dateString, value: dayTotal });
    }
    return trend;
  };

  const trendData = getSalesTrendData();
  const maxTrendVal = Math.max(...trendData.map(t => t.value), 1000);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade">
      
      {/* 1. Üst Özet Kartları */}
      <section className="grid-cols-4">
        {/* Toplam Ciro */}
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

        {/* Bekleyen Onaylar */}
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

        {/* Kritik Stok Uyarısı */}
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

        {/* Toplam Aktif Ürün */}
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

      {/* 2. Ciro Raporu Karşılaştırma Panel */}
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

      {/* 3. Grafik ve Performans Bölümü */}
      <section style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }} className="grid-cols-2">
        
        {/* Satış Trend Grafiği (SVG) */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <TrendingUp size={18} />
            <span>Son 7 Günlük Satış Grafiği</span>
          </h3>
          <div style={{ flex: 1, position: "relative", minHeight: "220px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 1rem" }}>
            {/* SVG Grafik Gövdesi */}
            <svg 
              viewBox="0 0 500 200" 
              style={{
                width: "100%",
                height: "100%",
                overflow: "visible",
                position: "absolute",
                inset: 0
              }}
            >
              {/* Kılavuz çizgileri */}
              <line x1="40" y1="20" x2="480" y2="20" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3" />
              <line x1="40" y1="80" x2="480" y2="80" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3" />
              <line x1="40" y1="140" x2="480" y2="140" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3" />
              <line x1="40" y1="170" x2="480" y2="170" stroke="var(--border-color)" strokeWidth="1" />

              {/* Grafik Eğrisi */}
              <path
                fill="none"
                stroke="var(--primary)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                d={trendData.map((d, index) => {
                  const x = 40 + (index * 70);
                  const y = 170 - ((d.value / maxTrendVal) * 140);
                  return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(" ")}
              />

              {/* Alt Alan Boyama */}
              <path
                fill="var(--primary-light)"
                opacity="0.3"
                d={`${trendData.map((d, index) => {
                  const x = 40 + (index * 70);
                  const y = 170 - ((d.value / maxTrendVal) * 140);
                  return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(" ")} L 460 170 L 40 170 Z`}
              />

              {/* Veri Noktaları (Circles) */}
              {trendData.map((d, index) => {
                const x = 40 + (index * 70);
                const y = 170 - ((d.value / maxTrendVal) * 140);
                return (
                  <g key={index}>
                    <circle
                      cx={x}
                      cy={y}
                      r={hoveredPoint?.index === index ? "8" : "5"}
                      fill={hoveredPoint?.index === index ? "var(--warning)" : "var(--bg-secondary)"}
                      stroke={hoveredPoint?.index === index ? "var(--warning)" : "var(--primary)"}
                      strokeWidth="2.5"
                      style={{ cursor: "pointer", transition: "all var(--transition-fast)" }}
                      onMouseEnter={() => setHoveredPoint({ x, y, label: d.label, value: d.value, index })}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                    {/* Gün Etiketleri */}
                    <text
                      x={x}
                      y="188"
                      textAnchor="middle"
                      fill="var(--text-secondary)"
                      fontSize="9.5"
                      fontWeight="500"
                    >
                      {d.label}
                    </text>
                  </g>
                );
              })}

              {/* Etkileşimli Hover Tooltip */}
              {hoveredPoint && (
                <g style={{ pointerEvents: "none" }}>
                  <rect
                    x={hoveredPoint.x - 65}
                    y={hoveredPoint.y - 36}
                    width="130"
                    height="24"
                    rx="4"
                    fill="var(--bg-secondary)"
                    stroke="var(--warning)"
                    strokeWidth="1.5"
                  />
                  <text
                    x={hoveredPoint.x}
                    y={hoveredPoint.y - 21}
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize="9.5"
                    fontWeight="700"
                  >
                    {hoveredPoint.value.toLocaleString('tr-TR')} ₺
                  </text>
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* Satışçı Performansı */}
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
              salespersonPerformance.map((sp, idx) => {
                const maxPerfRev = Math.max(...salespersonPerformance.map(s => s.totalRevenue), 1);
                const pct = (sp.totalRevenue / maxPerfRev) * 100;
                return (
                  <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{sp.name}</span>
                      <span style={{ fontWeight: 700, color: "var(--primary)" }}>
                        {sp.totalRevenue.toLocaleString('tr-TR')} ₺
                      </span>
                    </div>
                    {/* İlerleme Çubuğu */}
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

      {/* 3.5 Kategori Bazlı Satış Dağılımı */}
      <section className="card">
        <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Package size={18} />
          <span>Kategori Bazlı Satış Dağılımı</span>
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {categorySales.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", textAlign: "center", padding: "1.5rem" }}>
              Kategori bazlı satış verisi bulunmuyor.
            </div>
          ) : (
            categorySales.map((cat, idx) => {
              const percent = (cat.value / maxCatVal) * 100;
              return (
                <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{cat.name}</span>
                    <span style={{ fontWeight: 700, color: "var(--warning)" }}>
                      {cat.value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </span>
                  </div>
                  <div style={{ height: "10px", width: "100%", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                    <div 
                      style={{ 
                        height: "100%", 
                        width: `${percent}%`, 
                        backgroundColor: "var(--warning)", 
                        borderRadius: "var(--radius-full)",
                        transition: "width 1s ease"
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 4. En Çok Satanlar & Son Bekleyenler */}
      <section className="grid-cols-2">
        {/* En Çok Satan Ürünler */}
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
                  <th style={{ textAlign: "right" }}>Toplam Ciro</th>
                </tr>
              </thead>
              <tbody>
                {topSellingProducts.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ textAlign: "center", color: "var(--text-muted)" }}>
                      Satış kaydı bulunamadı.
                    </td>
                  </tr>
                ) : (
                  topSellingProducts.map((p, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{p.code}</div>
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 600 }}>{p.quantity} Adet</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--success)" }}>
                        {p.revenue.toLocaleString('tr-TR')} ₺
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Son Muhasebe Bekleyenleri */}
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
