import React, { useState, useEffect, useMemo, useCallback } from "react";
import { getSales, processApproval, updateSale } from "../services/db";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatCurrency, formatDate, formatDateTime } from "../utils/format";
import { PAYMENT_METHOD_LABELS } from "../utils/salesMath";
import Modal from "../components/Modal";
import EmptyState from "../components/EmptyState";
import { SkeletonTable } from "../components/Skeleton";
import {
  Check,
  X,
  Edit,
  FileSearch,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  Download,
  Rows3,
  CheckSquare,
  Calendar,
  Search,
  CheckCheck
} from "lucide-react";
import * as XLSX from "xlsx";
import type { Sale, SaleItem } from "../types";

type DateFilterType = "all" | "today" | "week" | "month" | "custom";

const Accounting = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "archive">("pending");
  const [isCompact, setIsCompact] = useState<boolean>(() => {
    return localStorage.getItem("takip_accounting_compact") === "true";
  });

  const toggleCompact = () => {
    const next = !isCompact;
    setIsCompact(next);
    localStorage.setItem("takip_accounting_compact", next ? "true" : "false");
  };

  // Filtreleme & Arama States
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilterType>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Sıralama States
  const [sortField, setSortField] = useState<string>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Toplu Onay States
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchMicroProcessed, setBatchMicroProcessed] = useState(false);
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  // Detay & Onay Modalı States
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isMicroProcessed, setIsMicroProcessed] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Satış Kalemi Düzenleme Modu States
  const [isEditMode, setIsEditMode] = useState(false);
  const [editableItems, setEditableItems] = useState<SaleItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);

  const fetchSalesData = useCallback(async () => {
    try {
      const salesData = await getSales();
      setSales(salesData);
    } catch (err) {
      console.error("Satışlar yüklenirken hata:", err);
      showToast("Satış verileri yüklenemedi.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSalesData();
  }, [fetchSalesData]);

  // Sekme değiştiğinde çoklu seçimleri temizle
  useEffect(() => {
    setSelectedSaleIds([]);
  }, [activeTab]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Tarih ve Arama Filtresi Kontrolü
  const matchesFilter = useCallback((sale: Sale): boolean => {
    // Arama Filtresi
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchReceipt = sale.receiptNo?.toLowerCase().includes(q);
      const matchCompany = sale.customerCompany?.toLowerCase().includes(q);
      const matchCustomer = sale.customerName?.toLowerCase().includes(q);
      const matchSalesperson = sale.salespersonName?.toLowerCase().includes(q);
      if (!matchReceipt && !matchCompany && !matchCustomer && !matchSalesperson) return false;
    }

    // Tarih Filtresi
    if (dateFilter === "all") return true;

    const saleDate = new Date(sale.date);
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

    if (dateFilter === "custom") {
      if (customStartDate && saleDate < new Date(`${customStartDate}T00:00:00`)) return false;
      if (customEndDate && saleDate > new Date(`${customEndDate}T23:59:59`)) return false;
      return true;
    }

    return true;
  }, [searchQuery, dateFilter, customStartDate, customEndDate]);

  const getSortedData = useCallback((dataList: Sale[]): Sale[] => {
    return [...dataList].sort((a, b) => {
      let aVal: any = (a as any)[sortField];
      let bVal: any = (b as any)[sortField];

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal, 'tr')
          : bVal.localeCompare(aVal, 'tr');
      } else {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }
    });
  }, [sortField, sortOrder]);

  // Bekleyen ve Arşivlenen Satışlar
  const pendingSales = useMemo(() => {
    const filtered = sales.filter(s => s.status === "pending_accounting" && matchesFilter(s));
    return getSortedData(filtered);
  }, [sales, matchesFilter, getSortedData]);

  const archivedSales = useMemo(() => {
    const filtered = sales.filter(s => (s.status === "approved" || s.status === "rejected") && matchesFilter(s));
    return getSortedData(filtered);
  }, [sales, matchesFilter, getSortedData]);

  // Çoklu Seçim Mantığı
  const handleToggleSelectAll = () => {
    if (selectedSaleIds.length === pendingSales.length && pendingSales.length > 0) {
      setSelectedSaleIds([]);
    } else {
      setSelectedSaleIds(pendingSales.map(s => s.id));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedSaleIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Seçilen satışların toplam tutarı
  const selectedSalesList = useMemo(() => {
    return pendingSales.filter(s => selectedSaleIds.includes(s.id));
  }, [pendingSales, selectedSaleIds]);

  const totalSelectedAmount = useMemo(() => {
    return selectedSalesList.reduce((sum, s) => sum + (s.netAmount || 0), 0);
  }, [selectedSalesList]);

  // Toplu Onaylama İşi
  const handleBatchApproveSubmit = async () => {
    if (selectedSaleIds.length === 0 || !user) return;
    setBatchSubmitting(true);
    let successCount = 0;
    let failCount = 0;

    for (const saleId of selectedSaleIds) {
      try {
        await processApproval(
          saleId,
          "approved",
          "Toplu onay işlemi",
          batchMicroProcessed,
          user.uid,
          user.displayName,
          user.role
        );
        successCount++;
      } catch (err) {
        console.error(`Satış ${saleId} onaylanırken hata:`, err);
        failCount++;
      }
    }

    if (failCount === 0) {
      showToast(`${successCount} adet satış kaydı başarıyla toplu onaylandı.`, "success");
    } else {
      showToast(`${successCount} satış onaylandı, ${failCount} satışta hata oluştu.`, "warning");
    }

    setSelectedSaleIds([]);
    setShowBatchModal(false);
    setBatchSubmitting(false);
    fetchSalesData();
  };

  // Tekil İnceleme Modalı
  const handleOpenReview = (sale: Sale) => {
    setSelectedSale(sale);
    setIsMicroProcessed(sale.accountingProcessed || false);
    setApprovalNotes("");
    setRejectReason("");
    setShowRejectForm(false);

    // Düzenlenebilir kalemleri hazırla
    setEditableItems(JSON.parse(JSON.stringify(sale.items || [])));
    setDiscountAmount(sale.discountAmount || 0);
    setIsEditMode(false);

    setShowReviewModal(true);
  };

  // Kalem Düzenleme İşlemleri
  const handleItemQtyChange = (idx: number, newQty: string) => {
    const updated = [...editableItems];
    const qty = Math.max(1, parseInt(newQty, 10) || 1);
    updated[idx].quantity = qty;
    updated[idx].total = qty * updated[idx].price;
    setEditableItems(updated);
  };

  const handleSaveEditedSale = async () => {
    if (!selectedSale || !user) return;

    const totalAmount = editableItems.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = editableItems.reduce((sum, item) => sum + (item.total * (item.taxRate / 100)), 0);
    const discount = discountAmount || 0;
    const netAmount = Math.max(0, (totalAmount + taxAmount) - discount);

    const updatedSaleFields = {
      items: editableItems,
      totalAmount,
      taxAmount,
      discountAmount: discount,
      netAmount
    };

    try {
      await updateSale(
        selectedSale.id,
        updatedSaleFields,
        user.uid,
        user.displayName,
        user.role
      );

      setSelectedSale({ ...selectedSale, ...updatedSaleFields });
      setIsEditMode(false);
      showToast("Satış kalemleri güncellendi.", "success");
      fetchSalesData();
    } catch (err: any) {
      showToast("Güncelleme hatası: " + err.message, "error");
    }
  };

  const handleApprove = async () => {
    if (!selectedSale || !user) return;

    try {
      await processApproval(
        selectedSale.id,
        "approved",
        approvalNotes,
        isMicroProcessed,
        user.uid,
        user.displayName,
        user.role
      );
      showToast("Satış kaydı onaylandı.", "success");
      setShowReviewModal(false);
      fetchSalesData();
    } catch (err: any) {
      showToast("Onaylama sırasında hata oluştu: " + err.message, "error");
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason) {
      showToast("Lütfen reddetme gerekçesini belirtin.", "warning");
      return;
    }
    if (!selectedSale || !user) return;

    try {
      await processApproval(
        selectedSale.id,
        "rejected",
        rejectReason,
        false,
        user.uid,
        user.displayName,
        user.role
      );
      showToast("Satış kaydı reddedildi.", "success");
      setShowReviewModal(false);
      fetchSalesData();
    } catch (err: any) {
      showToast("Reddetme sırasında hata oluştu: " + err.message, "error");
    }
  };

  const handleExportMikroExcel = (sale: Sale | null) => {
    if (!sale) return;

    const data = sale.items.map(item => ({
      "Evrak No": sale.receiptNo,
      "Tarih": new Date(sale.date).toLocaleDateString('tr-TR'),
      "Cari Unvanı": sale.customerCompany,
      "Musteri Yetkilisi": sale.customerName,
      "Stok Kodu": item.productCode || "",
      "Stok Adi": item.productName,
      "Miktar": item.quantity,
      "Birim Fiyat": item.price,
      "KDV Orani (%)": item.taxRate,
      "KDV Tutari": item.total * (item.taxRate / 100),
      "Toplam Tutar (KDV Dahil)": item.total * (1 + item.taxRate / 100),
      "Satis Temsilcisi": sale.salespersonName
    }));

    try {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Mikro_Fatura");
      XLSX.writeFile(workbook, `Mikro_Entegrasyon_${sale.receiptNo}.xlsx`);
      showToast("Mikro uyumlu Excel dosyası indirildi.", "success");
    } catch (error: any) {
      showToast("Excel dışa aktarılırken hata: " + error.message, "error");
    }
  };

  if (!user) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade">

      {/* Üst Sekmeler, Arama ve Filtre Çubuğu */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        borderBottom: "1px solid var(--border-color)",
        paddingBottom: "1rem"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem"
        }}>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            <button
              onClick={() => setActiveTab("pending")}
              style={{
                fontSize: "1rem",
                fontWeight: activeTab === "pending" ? 600 : 500,
                color: activeTab === "pending" ? "var(--primary)" : "var(--text-secondary)",
                borderBottom: activeTab === "pending" ? "2px solid var(--primary)" : "2px solid transparent",
                paddingBottom: "0.5rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "none",
                borderTop: "none",
                borderLeft: "none",
                borderRight: "none"
              }}
            >
              <Clock size={18} />
              <span>Bekleyen Onaylar</span>
              <span className="badge badge-warning" style={{ fontSize: "0.7rem", marginLeft: "0.25rem" }}>
                {pendingSales.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("archive")}
              style={{
                fontSize: "1rem",
                fontWeight: activeTab === "archive" ? 600 : 500,
                color: activeTab === "archive" ? "var(--primary)" : "var(--text-secondary)",
                borderBottom: activeTab === "archive" ? "2px solid var(--primary)" : "2px solid transparent",
                paddingBottom: "0.5rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "none",
                borderTop: "none",
                borderLeft: "none",
                borderRight: "none"
              }}
            >
              <Database size={18} />
              <span>Arşivlenmiş Kayıtlar</span>
              <span className="badge badge-primary" style={{ fontSize: "0.7rem", marginLeft: "0.25rem" }}>
                {archivedSales.length}
              </span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              type="button"
              className={`btn btn-secondary btn-sm ${isCompact ? "btn-primary" : ""}`}
              onClick={toggleCompact}
              title={isCompact ? "Standart satır aralığına geç" : "Daha fazla satır görmek için aralıkları daralt"}
            >
              <Rows3 size={16} />
              <span>{isCompact ? "Kompakt Tablo" : "Normal Tablo"}</span>
            </button>
          </div>
        </div>

        {/* Arama ve Tarih Filtreleme Çubuğu */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <div style={{ position: "relative", minWidth: "260px", flex: 1, maxWidth: "420px" }}>
            <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
              <Search size={16} />
            </span>
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: "2.25rem", height: "36px", fontSize: "0.85rem" }}
              placeholder="Fiş no, müşteri, firma veya satışçı ara..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <Calendar size={14} /> Tarih:
            </span>
            {(["all", "today", "week", "month", "custom"] as DateFilterType[]).map((f) => {
              const labels: Record<DateFilterType, string> = {
                all: "Tümü",
                today: "Bugün",
                week: "Bu Hafta",
                month: "Bu Ay",
                custom: "Özel Tarih"
              };
              const isActive = dateFilter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setDateFilter(f)}
                  className={`btn btn-sm ${isActive ? "btn-primary" : "btn-secondary"}`}
                  style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem" }}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Özel Tarih Aralığı Seçim Kutusu */}
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
              Aralık Belirleyin:
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
      </div>

      {/* TOPLU ONAY EYLEM ÇUBUĞU (Bekleyen sekmesinde seçim yapıldığında görünür) */}
      {activeTab === "pending" && selectedSaleIds.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.85rem 1.25rem",
            backgroundColor: "rgba(99, 102, 241, 0.08)",
            border: "1px solid rgba(99, 102, 241, 0.25)",
            borderRadius: "var(--radius-md)",
            flexWrap: "wrap",
            gap: "0.75rem"
          }}
          className="animate-slide-up"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <CheckSquare size={20} color="var(--primary)" />
            <span style={{ fontWeight: 600, fontSize: "0.92rem", color: "var(--text-primary)" }}>
              <strong>{selectedSaleIds.length}</strong> adet satış seçildi
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              (Toplam Tutar: <strong style={{ color: "var(--primary)" }}>{formatCurrency(totalSelectedAmount)}</strong>)
            </span>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedSaleIds([])}
            >
              Seçimi Kaldır
            </button>
            <button
              type="button"
              className="btn btn-success btn-sm"
              style={{ gap: "0.35rem", padding: "0.4rem 0.8rem", fontWeight: 600 }}
              onClick={() => setShowBatchModal(true)}
            >
              <CheckCheck size={16} />
              <span>Seçilenleri Toplu Onayla</span>
            </button>
          </div>
        </div>
      )}

      {/* İÇERİK TABLOSU */}
      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "1.5rem" }}>
            <SkeletonTable rows={6} columns={6} />
          </div>
        ) : (
          <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
            <table className={`table ${isCompact ? "table-compact" : ""}`}>
              <thead>
                <tr>
                  {activeTab === "pending" && (
                    <th style={{ width: "40px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={pendingSales.length > 0 && selectedSaleIds.length === pendingSales.length}
                        onChange={handleToggleSelectAll}
                        style={{ cursor: "pointer", width: "15px", height: "15px" }}
                        title="Tümünü Seç / Seçimi Kaldır"
                      />
                    </th>
                  )}
                  <th onClick={() => handleSort("receiptNo")} style={{ cursor: "pointer" }}>
                    Fiş No / Tarih {sortField === "receiptNo" ? (sortOrder === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th onClick={() => handleSort("customerCompany")} style={{ cursor: "pointer" }}>
                    Müşteri / Firma {sortField === "customerCompany" ? (sortOrder === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th onClick={() => handleSort("salespersonName")} style={{ cursor: "pointer" }}>
                    Satış Temsilcisi {sortField === "salespersonName" ? (sortOrder === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th onClick={() => handleSort("netAmount")} style={{ textAlign: "right", cursor: "pointer" }}>
                    Tutar {sortField === "netAmount" ? (sortOrder === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  {activeTab === "archive" && <th>Mikro Entegrasyonu</th>}
                  <th style={{ textAlign: "center" }}>Durum</th>
                  <th style={{ width: "100px", textAlign: "center" }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {activeTab === "pending" ? (
                  /* --- BEKLEYEN SATIŞLAR TABLOSU --- */
                  pendingSales.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 0 }}>
                        <EmptyState
                          icon={CheckCircle2}
                          title="Onay Bekleyen Sipariş Yok"
                          description="Tüm satış kayıtları muhasebe tarafından işlenmiş veya onaylanmıştır."
                        />
                      </td>
                    </tr>
                  ) : (
                    pendingSales.map((sale) => {
                      const isSelected = selectedSaleIds.includes(sale.id);
                      return (
                        <tr
                          key={sale.id}
                          style={{
                            backgroundColor: isSelected ? "rgba(99, 102, 241, 0.04)" : undefined
                          }}
                        >
                          <td style={{ textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectRow(sale.id)}
                              style={{ cursor: "pointer", width: "15px", height: "15px" }}
                            />
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{sale.receiptNo}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              {formatDateTime(sale.date)}
                            </div>
                            {sale.paymentMethod && (
                              <span className="badge badge-secondary" style={{ fontSize: "0.68rem", marginTop: "0.2rem" }}>
                                {PAYMENT_METHOD_LABELS[sale.paymentMethod]}
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{sale.customerCompany}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{sale.customerName}</div>
                          </td>
                          <td>{sale.salespersonName}</td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "var(--text-primary)" }}>
                            {formatCurrency(sale.netAmount)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span className="badge badge-warning" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                              <Clock size={12} />
                              <span>Onay Bekliyor</span>
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              onClick={() => handleOpenReview(sale)}
                              className="btn btn-primary btn-sm"
                              style={{ gap: "0.35rem" }}
                            >
                              <FileSearch size={14} />
                              <span>İncele</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )
                ) : (
                  /* --- ARŞİVLENMİŞ SATIŞLAR TABLOSU --- */
                  archivedSales.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 0 }}>
                        <EmptyState
                          icon={Database}
                          title="Arşivde Kayıt Bulunmuyor"
                          description="Belirtilen kriterlere uygun onaylanmış veya reddedilmiş bir satış kaydı bulunamadı."
                        />
                      </td>
                    </tr>
                  ) : (
                    archivedSales.map((sale) => (
                      <tr key={sale.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{sale.receiptNo}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            {formatDate(sale.date)}
                          </div>
                          {sale.paymentMethod && (
                            <span className="badge badge-secondary" style={{ fontSize: "0.68rem", marginTop: "0.2rem" }}>
                              {PAYMENT_METHOD_LABELS[sale.paymentMethod]}
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{sale.customerCompany}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{sale.customerName}</div>
                        </td>
                        <td>{sale.salespersonName}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          {formatCurrency(sale.netAmount)}
                        </td>
                        <td>
                          {sale.status === "approved" ? (
                            <span style={{
                              fontSize: "0.85rem",
                              fontWeight: 500,
                              color: sale.accountingProcessed ? "var(--success)" : "var(--danger)",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.25rem"
                            }}>
                              {sale.accountingProcessed ? "✓ Mikro'ya İşlendi" : "✗ Mikro'ya İşlenmedi"}
                            </span>
                          ) : "-"}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className={`badge badge-${sale.status === "approved" ? "success" : "danger"}`} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                            {sale.status === "approved" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            <span>{sale.status === "approved" ? "Onaylandı" : "Reddedildi"}</span>
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            onClick={() => handleOpenReview(sale)}
                            className="btn btn-secondary btn-sm"
                            style={{ gap: "0.35rem" }}
                          >
                            <FileSearch size={14} />
                            <span>Detay</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* TOPLU SATIŞ ONAY MODALI */}
      {showBatchModal && (
        <Modal
          isOpen={showBatchModal}
          onClose={() => !batchSubmitting && setShowBatchModal(false)}
          maxWidth="520px"
          title="Toplu Satış Onayı"
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowBatchModal(false)}
                disabled={batchSubmitting}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleBatchApproveSubmit}
                disabled={batchSubmitting}
              >
                <CheckCheck size={16} />
                <span>{batchSubmitting ? "Onaylanıyor..." : `Evet, ${selectedSaleIds.length} Satışı Onayla`}</span>
              </button>
            </>
          }
        >
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "1rem",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.2)"
            }}>
              <CheckCheck size={28} color="var(--success)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                  {selectedSaleIds.length} adet bekleyen satış onaylanacak
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                  Toplam Onay Tutarı: <strong>{formatCurrency(totalSelectedAmount)}</strong>
                </div>
              </div>
            </div>

            <div style={{ maxHeight: "160px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", padding: "0.5rem" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: "0.35rem" }}>
                ONAYLANACAK FİŞLER:
              </div>
              {selectedSalesList.map(s => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", padding: "0.25rem 0", borderBottom: "1px solid var(--border-color)" }}>
                  <span><strong>{s.receiptNo}</strong> - {s.customerCompany}</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(s.netAmount)}</span>
                </div>
              ))}
            </div>

            <label style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.85rem 1rem",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-color)",
              cursor: "pointer",
              fontSize: "0.9rem"
            }}>
              <input
                type="checkbox"
                style={{ width: "16px", height: "16px" }}
                checked={batchMicroProcessed}
                onChange={e => setBatchMicroProcessed(e.target.checked)}
              />
              <div>
                <strong>Mikro Muhasebe programına işlendi</strong>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Tüm bu satışların Mikro sistemine aktarımı tamamlandıysa işaretleyin.
                </div>
              </div>
            </label>
          </div>
        </Modal>
      )}

      {/* TEKİL İNCELEME & ONAY MODALI */}
      {showReviewModal && selectedSale && (
        <Modal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          maxWidth="760px"
          title={`Satış Detayı & Onay [${selectedSale.receiptNo}]`}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowReviewModal(false)}
              >
                Kapat
              </button>

              {selectedSale.status === "pending_accounting" && user.role !== "admin" && !showRejectForm && (
                <>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => setShowRejectForm(true)}
                    disabled={isEditMode}
                  >
                    <X size={16} />
                    <span>Reddet</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={handleApprove}
                    disabled={isEditMode}
                  >
                    <Check size={16} />
                    <span>Onayla</span>
                  </button>
                </>
              )}
            </>
          }
        >
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Müşteri Bilgi Bölümü */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", padding: "1rem", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>MÜŞTERİ / FİRMA</div>
                <div style={{ fontWeight: 600, fontSize: "0.95rem", marginTop: "0.15rem" }}>{selectedSale.customerCompany}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Yetkili: {selectedSale.customerName}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>BİLGİLER</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                  <strong>Tarih:</strong> {formatDateTime(selectedSale.date)}
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  <strong>Satıcı:</strong> {selectedSale.salespersonName}
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                  <strong>Ödeme Şekli:</strong> <span className="badge badge-primary" style={{ fontSize: "0.72rem" }}>{PAYMENT_METHOD_LABELS[selectedSale.paymentMethod || "open_account"]}</span>
                  {selectedSale.checkNumber ? ` (Çek No: ${selectedSale.checkNumber})` : ""}
                </div>
              </div>
            </div>

            {/* Kalem Listesi & Düzenleme */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <h4 style={{ fontSize: "0.95rem", fontWeight: 600 }}>Satış Kalemleri</h4>
                {selectedSale.status === "pending_accounting" && user.role !== "admin" && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      if (isEditMode) {
                        setEditableItems(JSON.parse(JSON.stringify(selectedSale.items || [])));
                        setDiscountAmount(selectedSale.discountAmount || 0);
                      }
                      setIsEditMode(!isEditMode);
                    }}
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                  >
                    <Edit size={14} />
                    <span>{isEditMode ? "Düzenlemeyi İptal Et" : "Miktarları Düzenle"}</span>
                  </button>
                )}
              </div>

              <div className="table-container">
                <table className="table" style={{ fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th>Ürün Adı</th>
                      <th style={{ textAlign: "right" }}>Birim Fiyat</th>
                      <th style={{ textAlign: "center", width: "100px" }}>Miktar</th>
                      <th style={{ textAlign: "right" }}>Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isEditMode ? (
                      /* Düzenleme Modunda Kalem Satırları */
                      editableItems.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <span style={{ fontWeight: 600 }}>{item.productName}</span>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{item.productCode}</div>
                          </td>
                          <td style={{ textAlign: "right" }}>{formatCurrency(item.price)}</td>
                          <td style={{ textAlign: "center" }}>
                            <input
                              type="number"
                              min="1"
                              className="form-control"
                              style={{ padding: "0.25rem", textAlign: "center", fontSize: "0.85rem" }}
                              value={item.quantity}
                              onChange={(e) => handleItemQtyChange(idx, e.target.value)}
                            />
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>{formatCurrency(item.total)}</td>
                        </tr>
                      ))
                    ) : (
                      /* Normal İzleme Modunda Kalem Satırları */
                      (selectedSale.items || []).map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <span style={{ fontWeight: 600 }}>{item.productName}</span>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{item.productCode}</div>
                          </td>
                          <td style={{ textAlign: "right" }}>{formatCurrency(item.price)}</td>
                          <td style={{ textAlign: "center", fontWeight: 600 }}>{item.quantity}</td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>{formatCurrency(item.total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Düzenleme Modu Ara-Kaydet Butonu ve İskonto Alanı */}
              {isEditMode && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", padding: "1rem", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>İndirim:</span>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      style={{ width: "90px", padding: "0.25rem", textAlign: "right" }}
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveEditedSale}
                  >
                    Değişiklikleri Kaydet
                  </button>
                </div>
              )}
            </div>

            {/* Toplam Bilgiler ve Notlar */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "1rem" }} className="grid-cols-2">
              <div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  <strong>Sipariş Notu:</strong>
                  <p style={{ marginTop: "0.25rem", fontStyle: "italic", color: "var(--text-primary)" }}>
                    {selectedSale.notes || "Not bırakılmamış."}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.85rem", textAlign: "right" }}>
                <div>Ara Toplam: {formatCurrency(selectedSale.totalAmount)}</div>
                <div>KDV (%20): {formatCurrency(selectedSale.taxAmount)}</div>
                {selectedSale.discountAmount > 0 && (
                  <div style={{ color: "var(--danger)" }}>İndirim: -{formatCurrency(selectedSale.discountAmount)}</div>
                )}
                <div style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: "0.25rem", color: "var(--primary)" }}>
                  Net Tutar: {formatCurrency(selectedSale.netAmount)}
                </div>
              </div>
            </div>

            {/* ONAYLAMA PANELİ (Yalnızca beklemedeyse) */}
            {selectedSale.status === "pending_accounting" && user.role !== "admin" && !showRejectForm && (
              <div style={{ borderTop: "1px dashed var(--border-color)", paddingTop: "1.25rem", marginTop: "0.5rem" }}>
                <h4 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.75rem" }}>Muhasebe Onay Adımları</h4>

                {/* Mikro Entegrasyon Checkbox */}
                <label style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.85rem 1rem",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "rgba(16, 185, 129, 0.05)",
                  border: "1px solid rgba(16, 185, 129, 0.15)",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  marginBottom: "1rem"
                }}>
                  <input
                    type="checkbox"
                    style={{ width: "16px", height: "16px" }}
                    checked={isMicroProcessed}
                    onChange={(e) => setIsMicroProcessed(e.target.checked)}
                  />
                  <div>
                    <strong>Mikro Muhasebe programına işlendi</strong>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Bu kaydı harici Mikro muhasebe yazılımınıza girdiğinizde onay kutusunu işaretleyin.
                    </div>
                  </div>
                </label>

                <div className="form-group">
                  <label className="form-label">Onay/İşlem Notları</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Onay açıklaması yazın (opsiyonel)..."
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* RED DETAY FORMU (Reddet butonuna tıklandığında açılır) */}
            {showRejectForm && (
              <form onSubmit={handleRejectSubmit} style={{ borderTop: "1px dashed var(--border-color)", paddingTop: "1.25rem" }}>
                <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--danger)", marginBottom: "0.5rem" }}>
                  Satış Red Formu
                </h4>
                <div className="form-group">
                  <label className="form-label">Reddetme Gerekçesi (Zorunlu)</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Bu sipariş neden reddediliyor? Açıklayınız..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowRejectForm(false)}>
                    Vazgeç
                  </button>
                  <button type="submit" className="btn btn-danger btn-sm">
                    Satışı Reddet
                  </button>
                </div>
              </form>
            )}

            {/* Geçmiş Onay Detayları (Arşivdeyse) */}
            {selectedSale.status !== "pending_accounting" && (
              <div style={{ borderTop: "1px dashed var(--border-color)", paddingTop: "1rem", marginTop: "0.5rem", fontSize: "0.85rem" }}>
                <strong>İşlem Geçmişi:</strong>
                <div style={{ marginTop: "0.5rem", padding: "0.75rem", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-tertiary)" }}>
                  <div><strong>İşlem Yapan:</strong> {selectedSale.processedBy || "Sistem"}</div>
                  <div><strong>İşlem Zamanı:</strong> {selectedSale.processedAt ? formatDateTime(selectedSale.processedAt) : "-"}</div>
                  <div><strong>Mikro Entegrasyonu:</strong> {selectedSale.accountingProcessed ? "✓ Mikro sistemine girildi" : "✗ Mikro sistemine girilmedi"}</div>
                </div>
              </div>
            )}

            {selectedSale.status === "approved" && (
              <div style={{ marginTop: "1rem" }}>
                <button
                  type="button"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    backgroundColor: "var(--primary-strong)",
                    color: "#fff",
                    border: "none",
                    padding: "0.6rem",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.9rem"
                  }}
                  onClick={() => handleExportMikroExcel(selectedSale)}
                >
                  <Download size={16} />
                  <span>Mikro Uyumlu Excel Aktar (Entegrasyon)</span>
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

    </div>
  );
};

export default Accounting;
