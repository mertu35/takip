// Takip Sistemi - Muhasebeci Modülü (Accounting)
import React, { useState, useEffect } from "react";
import { getSales, processApproval, updateSale } from "../services/db";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { 
  Check, 
  X, 
  Edit, 
  FileSearch, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Database,
  Eye,
  Download
} from "lucide-react";
import * as XLSX from "xlsx";

const Accounting = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending"); // "pending" | "archive"

  // Sorting States
  const [sortField, setSortField] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");

  // Detay & Onay Modalı States
  const [selectedSale, setSelectedSale] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isMicroProcessed, setIsMicroProcessed] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Satış Kalemi Düzenleme Modu States
  const [isEditMode, setIsEditMode] = useState(false);
  const [editableItems, setEditableItems] = useState([]);
  const [discountAmount, setDiscountAmount] = useState(0);

  useEffect(() => {
    fetchSalesData();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowReviewModal(false);
      }
    };
    if (showReviewModal) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [showReviewModal]);

  const handleOverlayClick = (e) => {
    if (e.target.className === "modal-overlay") {
      setShowReviewModal(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortedData = (dataList) => {
    return [...dataList].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
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
  };

  const fetchSalesData = async () => {
    try {
      const salesData = await getSales();
      setSales(salesData);
    } catch (err) {
      console.error("Satışlar yüklenirken hata:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade">
        <section className="card" style={{ height: "60px" }}>
          <div className="skeleton-row" style={{ width: "15%" }} />
        </section>
        <section className="card">
          <div className="skeleton-loader-container">
            <div className="skeleton-row title" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        </section>
      </div>
    );
  }

  // Bekleyen ve Onaylananlar
  const pendingSales = getSortedData(sales.filter(s => s.status === "pending_accounting"));
  const archivedSales = getSortedData(sales.filter(s => s.status === "approved" || s.status === "rejected"));

  const handleOpenReview = (sale) => {
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

  // --- KALEM DÜZENLEME İŞLEMLERİ ---
  const handleItemQtyChange = (idx, newQty) => {
    const updated = [...editableItems];
    const qty = Math.max(1, parseInt(newQty, 10) || 1);
    updated[idx].quantity = qty;
    updated[idx].total = qty * updated[idx].price;
    setEditableItems(updated);
  };

  const handleSaveEditedSale = async () => {
    if (!selectedSale) return;

    // Fiyat ve KDV toplamlarını yeniden hesapla
    const totalAmount = editableItems.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = editableItems.reduce((sum, item) => sum + (item.total * (item.taxRate / 100)), 0);
    const discount = parseFloat(discountAmount) || 0;
    const netAmount = Math.max(0, (totalAmount + taxAmount) - discount);

    const updatedSaleFields = {
      items: editableItems,
      totalAmount,
      taxAmount,
      discountAmount: discount,
      netAmount
    };

    try {
      await updateSale(selectedSale.id, updatedSaleFields, user.uid, user.displayName, user.role);
      showToast("Satış kaydı başarıyla güncellendi.", "success");
      
      // Lokal nesneyi de güncelle ki modalda tutarlar doğru görünsün
      setSelectedSale({
        ...selectedSale,
        ...updatedSaleFields
      });
      setIsEditMode(false);
      
      // Satış listesini tazele
      fetchSalesData();
    } catch (err) {
      showToast("Düzenleme kaydedilirken hata: " + err.message, "error");
    }
  };

  // --- ONAYLAMA / REDDETME ---
  const handleApprove = async () => {
    if (!selectedSale) return;

    try {
      await processApproval(
        selectedSale.id,
        "approved",
        approvalNotes || "Muhasebe tarafından onaylandı.",
        isMicroProcessed,
        user.uid,
        user.displayName,
        user.role
      );
      showToast("Satış kaydı onaylandı.", "success");
      setShowReviewModal(false);
      fetchSalesData();
    } catch (err) {
      showToast("Onaylama sırasında hata oluştu: " + err.message, "error");
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectReason) {
      showToast("Lütfen reddetme gerekçesini belirtin.", "warning");
      return;
    }

    try {
      await processApproval(
        selectedSale.id,
        "rejected",
        rejectReason,
        false, // Reddedilen kayıt Mikro'ya girilmez
        user.uid,
        user.displayName,
        user.role
      );
      showToast("Satış kaydı reddedildi.", "success");
      setShowReviewModal(false);
      fetchSalesData();
    } catch (err) {
      showToast("Reddetme sırasında hata oluştu: " + err.message, "error");
    }
  };

  const handleExportMikroExcel = (sale) => {
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
    } catch (error) {
      showToast("Excel dışa aktarılırken hata: " + error.message, "error");
    }
  };

  if (!user) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade">
      
      {/* Tab Kontrolü */}
      <div style={{ 
        display: "flex", 
        borderBottom: "1px solid var(--border-color)", 
        gap: "2rem",
        paddingBottom: "0.25rem" 
      }}>
        <button
          onClick={() => setActiveTab("pending")}
          style={{
            fontSize: "1rem",
            fontWeight: activeTab === "pending" ? 600 : 500,
            color: activeTab === "pending" ? "var(--primary)" : "var(--text-secondary)",
            borderBottom: activeTab === "pending" ? "2px solid var(--primary)" : "2px solid transparent",
            paddingBottom: "0.75rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem"
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
            paddingBottom: "0.75rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem"
          }}
        >
          <Database size={18} />
          <span>Arşivlenmiş Kayıtlar</span>
          <span className="badge badge-primary" style={{ fontSize: "0.7rem", marginLeft: "0.25rem" }}>
            {archivedSales.length}
          </span>
        </button>
      </div>

      {/* İÇERİK TABLOSU */}
      <section className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
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
                <th style={{ width: "100px" }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {activeTab === "pending" ? (
                /* --- BEKLEYEN SATIŞLAR TABLOSU --- */
                pendingSales.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem" }}>
                      Onay bekleyen satış kaydı bulunmamaktadır.
                    </td>
                  </tr>
                ) : (
                  pendingSales.map((sale) => (
                    <tr key={sale.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{sale.receiptNo}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {new Date(sale.date).toLocaleDateString('tr-TR')} {new Date(sale.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{sale.customerCompany}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{sale.customerName}</div>
                      </td>
                      <td>{sale.salespersonName}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--text-primary)" }}>
                        {sale.netAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="badge badge-warning" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                          <Clock size={12} />
                          <span>Onay Bekliyor</span>
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => handleOpenReview(sale)}
                          className="btn btn-primary btn-sm"
                          style={{ gap: "0.25rem", padding: "0.35rem 0.65rem" }}
                        >
                          {user.role === "admin" ? <Eye size={14} /> : <FileSearch size={14} />}
                          <span>{user.role === "admin" ? "Görüntüle" : "İncele"}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )
              ) : (
                /* --- ARŞİVLENMİŞ SATIŞLAR TABLOSU --- */
                archivedSales.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem" }}>
                      Arşivde kayıtlı satış bulunmamaktadır.
                    </td>
                  </tr>
                ) : (
                  archivedSales.map((sale) => (
                    <tr key={sale.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{sale.receiptNo}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {new Date(sale.date).toLocaleDateString('tr-TR')}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{sale.customerCompany}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{sale.customerName}</div>
                      </td>
                      <td>{sale.salespersonName}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>
                        {sale.netAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
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
                      <td>
                        <button
                          onClick={() => handleOpenReview(sale)}
                          className="btn btn-secondary btn-sm"
                          style={{ gap: "0.25rem", padding: "0.35rem 0.65rem" }}
                        >
                          <Eye size={14} />
                          <span>Görüntüle</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- DETAYLI İNCELEME & ONAY MODALI --- */}
      {showReviewModal && selectedSale && (
        <div className="modal-overlay" onClick={handleOverlayClick}>
          <div className="modal-content animate-slide-up" style={{ maxWidth: "680px" }} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                Satış Detayı ve İşlemleri - {selectedSale.receiptNo}
              </h3>
              <button onClick={() => setShowReviewModal(false)} style={{ cursor: "pointer", fontSize: "1.25rem" }} aria-label="Kapat">&times;</button>
            </div>

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
                    <strong>Tarih:</strong> {new Date(selectedSale.date).toLocaleString('tr-TR')}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    <strong>Satıcı:</strong> {selectedSale.salespersonName}
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
                          // Değişiklikleri iptal et ve çık
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
                            <td style={{ textAlign: "right" }}>{item.price.toFixed(2)} ₺</td>
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
                            <td style={{ textAlign: "right", fontWeight: 600 }}>{item.total.toFixed(2)} ₺</td>
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
                            <td style={{ textAlign: "right" }}>{item.price.toFixed(2)} ₺</td>
                            <td style={{ textAlign: "center", fontWeight: 600 }}>{item.quantity}</td>
                            <td style={{ textAlign: "right", fontWeight: 600 }}>{item.total.toFixed(2)} ₺</td>
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
                  <div>Ara Toplam: {selectedSale.totalAmount.toFixed(2)} ₺</div>
                  <div>KDV (%20): {selectedSale.taxAmount.toFixed(2)} ₺</div>
                  {selectedSale.discountAmount > 0 && (
                    <div style={{ color: "var(--danger)" }}>İndirim: -{selectedSale.discountAmount.toFixed(2)} ₺</div>
                  )}
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: "0.25rem", color: "var(--primary)" }}>
                    Net Tutar: {selectedSale.netAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
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
                      rows="2"
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
                    <div><strong>İşlem Zamanı:</strong> {selectedSale.processedAt ? new Date(selectedSale.processedAt).toLocaleString('tr-TR') : "-"}</div>
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
                      backgroundColor: "var(--primary)",
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

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowReviewModal(false)}>
                Kapat
              </button>
              
              {selectedSale.status === "pending_accounting" && user.role !== "admin" && !showRejectForm && (
                <>
                  <button 
                    type="button" 
                    className="btn btn-danger" 
                    onClick={() => setShowRejectForm(true)}
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
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Accounting;
