import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getCustomers, addCustomer, updateCustomer, deleteCustomer, getSales, getSalesByCustomer } from "../services/db";
import { generateInvoicePDF } from "../utils/generateInvoicePDF";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Modal from "../components/Modal";
import {
  UserPlus, Search, Phone, Mail, Building2, Hash, History, TrendingUp, X, Download,
  MoreVertical, Edit, Trash2, LayoutGrid, List
} from "lucide-react";
import type { Customer, Sale } from "../types";

type CustomerForm = Omit<Customer, "id" | "createdAt">;
type SortKey = "name" | "revenue" | "recent";
type ViewMode = "grid" | "list";

interface CustomerStats {
  lastOrderDate: string | null;
  totalRevenue: number;
  orderCount: number;
}

const emptyForm: CustomerForm = {
  name: "", company: "", phone: "", email: "",
  taxOffice: "", taxNumber: "", address: ""
};

const statusLabel = (s: string) => s === "approved" ? "Onaylandı" : s === "rejected" ? "Reddedildi" : "Bekliyor";
const statusBadge = (s: string) => s === "approved" ? "success" : s === "rejected" ? "danger" : "warning";

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatRelativeDate = (dateStr: string | null): string => {
  if (!dateStr) return "—";
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Bugün";
  if (diffDays === 1) return "Dün";
  if (diffDays < 30) return `${diffDays} gün önce`;
  return new Date(dateStr).toLocaleDateString('tr-TR');
};

const Customers = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [submitting, setSubmitting] = useState(false);

  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [historySales, setHistorySales] = useState<Sale[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      const [customerData, salesData] = await Promise.all([
        getCustomers(),
        user ? getSales(user.role, user.uid) : Promise.resolve([] as Sale[])
      ]);
      setCustomers(customerData);
      setSales(salesData);
    } catch (e) {
      showToast("Müşteriler yüklenemedi.", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  // Her müşteri için satış geçmişinden son sipariş tarihi ve onaylanan
  // satışların toplam cirosu hesaplanır (bkz. müşteri listesi redesign'ı:
  // eskiden kartlarda sadece iletişim bilgisi vardı, iş verisi yoktu).
  const customerStats = useMemo(() => {
    const map: Record<string, CustomerStats> = {};
    for (const s of sales) {
      if (!map[s.customerId]) map[s.customerId] = { lastOrderDate: null, totalRevenue: 0, orderCount: 0 };
      const entry = map[s.customerId];
      entry.orderCount += 1;
      if (!entry.lastOrderDate || new Date(s.date) > new Date(entry.lastOrderDate)) {
        entry.lastOrderDate = s.date;
      }
      if (s.status === "approved") {
        entry.totalRevenue += s.netAmount || 0;
      }
    }
    return map;
  }, [sales]);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone && c.phone.includes(searchQuery)) ||
    (c.taxNumber && c.taxNumber.includes(searchQuery))
  );

  const sortedCustomers = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      if (sortBy === "revenue") {
        return (customerStats[b.id]?.totalRevenue || 0) - (customerStats[a.id]?.totalRevenue || 0);
      }
      if (sortBy === "recent") {
        const da = customerStats[a.id]?.lastOrderDate;
        const db = customerStats[b.id]?.lastOrderDate;
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return new Date(db).getTime() - new Date(da).getTime();
      }
      return a.name.localeCompare(b.name, "tr");
    });
    return list;
  }, [filtered, sortBy, customerStats]);

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Ad Soyad boş olamaz.";
    if (!form.company.trim()) e.company = "Firma unvanı boş olamaz.";
    if (form.phone && !/^\d{10,11}$/.test(form.phone.replace(/\s+/g, "")))
      e.phone = "Telefon 10 veya 11 haneli olmalıdır.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email))
      e.email = "Geçersiz e-posta formatı.";
    if (form.taxNumber && !/^\d{10}$/.test(form.taxNumber))
      e.taxNumber = "Vergi numarası 10 haneli olmalıdır.";
    return e;
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setShowModal(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setOpenMenuId(null);
    setEditingId(c.id);
    setForm({
      name: c.name, company: c.company, phone: c.phone || "", email: c.email || "",
      taxOffice: c.taxOffice || "", taxNumber: c.taxNumber || "", address: c.address || ""
    });
    setErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      if (editingId) {
        await updateCustomer(editingId, form, user!.uid, user!.displayName, user!.role);
        showToast("Müşteri bilgileri güncellendi.", "success");
      } else {
        await addCustomer(form, user!.uid, user!.displayName, user!.role);
        showToast("Müşteri başarıyla eklendi.", "success");
      }
      setForm(emptyForm);
      setErrors({});
      setShowModal(false);
      setEditingId(null);
      fetchCustomers();
    } catch (err: any) {
      showToast(`Müşteri ${editingId ? "güncellenemedi" : "eklenemedi"}: ` + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (c: Customer) => {
    setOpenMenuId(null);
    if (window.confirm(`"${c.name}" (${c.company}) müşterisini silmek istediğinize emin misiniz?`)) {
      try {
        await deleteCustomer(c.id, user!.uid, user!.displayName, user!.role);
        showToast("Müşteri silindi.", "success");
        fetchCustomers();
      } catch (err: any) {
        showToast("Müşteri silinirken hata: " + err.message, "error");
      }
    }
  };

  const handleOpenHistory = async (customer: Customer) => {
    setOpenMenuId(null);
    setHistoryCustomer(customer);
    setHistorySales([]);
    setHistoryLoading(true);
    try {
      const sales = await getSalesByCustomer(customer.id);
      setHistorySales(sales);
    } catch (err: any) {
      showToast("Satış geçmişi yüklenemedi: " + err.message, "error");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCloseHistory = () => {
    setHistoryCustomer(null);
    setHistorySales([]);
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh", color: "var(--text-secondary)" }}>
      Yükleniyor...
    </div>
  );

  const historyStats = historyCustomer ? (() => {
    const approved = historySales.filter(s => s.status === "approved");
    const totalRevenue = approved.reduce((s, sale) => s + (sale.netAmount || 0), 0);
    const totalTax = approved.reduce((s, sale) => s + (sale.taxAmount || 0), 0);
    return { totalRevenue, totalTax, approvedCount: approved.length, totalCount: historySales.length };
  })() : null;

  const renderActionsMenu = (c: Customer) => (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === c.id ? null : c.id); }}
        aria-label="Diğer işlemler"
        style={{
          cursor: "pointer", color: "var(--text-secondary)", padding: "0.3rem",
          borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center"
        }}
      >
        <MoreVertical size={16} />
      </button>
      {openMenuId === c.id && (
        <>
          <div onClick={() => setOpenMenuId(null)} style={{ position: "fixed", inset: 0, zIndex: 199, background: "transparent" }} />
          <div
            className="card animate-slide-up"
            style={{
              position: "absolute", right: 0, top: "100%", marginTop: "0.25rem", zIndex: 200,
              padding: "0.3rem", minWidth: "140px", boxShadow: "var(--shadow-lg)"
            }}
          >
            <button
              type="button"
              onClick={() => handleOpenEdit(c)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.6rem", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", cursor: "pointer" }}
            >
              <Edit size={14} /> Düzenle
            </button>
            <button
              type="button"
              onClick={() => handleDelete(c)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.6rem", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", cursor: "pointer", color: "var(--danger)" }}
            >
              <Trash2 size={14} /> Sil
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade">

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Müşteri Listesi</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Toplam {customers.length} müşteri kayıtlı
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <UserPlus size={18} /> <span>Yeni Müşteri</span>
        </button>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 320px", maxWidth: "420px" }}>
          <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
            <Search size={16} />
          </span>
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: "2.25rem" }}
            placeholder="Ad, firma, telefon veya vergi no ile ara..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="form-control"
          style={{ width: "180px" }}
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortKey)}
        >
          <option value="name">İsme göre</option>
          <option value="revenue">Ciroya göre</option>
          <option value="recent">Son işleme göre</option>
        </select>

        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            aria-label="Kart görünümü"
            style={{
              width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)",
              backgroundColor: viewMode === "grid" ? "var(--bg-tertiary)" : "transparent",
              color: viewMode === "grid" ? "var(--primary)" : "var(--text-secondary)"
            }}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-label="Liste görünümü"
            style={{
              width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)",
              backgroundColor: viewMode === "list" ? "var(--bg-tertiary)" : "transparent",
              color: viewMode === "list" ? "var(--primary)" : "var(--text-secondary)"
            }}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {sortedCustomers.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
          {searchQuery ? "Aramanızla eşleşen müşteri bulunamadı." : "Henüz müşteri kaydı yok. Yeni müşteri ekleyebilirsiniz."}
        </div>
      ) : viewMode === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
          {sortedCustomers.map(c => {
            const stats = customerStats[c.id];
            return (
              <div key={c.id} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
                  <div style={{
                    width: "38px", height: "38px", borderRadius: "50%", flexShrink: 0,
                    backgroundColor: "var(--primary-light)", color: "var(--primary)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.8rem"
                  }}>
                    {getInitials(c.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>{c.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--primary)", fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <Building2 size={13} style={{ flexShrink: 0 }} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.company}</span>
                    </div>
                  </div>
                  {renderActionsMenu(c)}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.82rem" }}>
                  {c.phone && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)" }}>
                      <Phone size={13} /> {c.phone}
                    </div>
                  )}
                  {c.email && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <Mail size={13} /> {c.email}
                    </div>
                  )}
                  {c.taxNumber && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-muted)", fontSize: "0.78rem" }}>
                      <Hash size={13} /> VN: {c.taxNumber} {c.taxOffice && `/ ${c.taxOffice} V.D.`}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <div style={{ flex: 1, backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", padding: "0.4rem 0.6rem" }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Son Sipariş</div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700 }}>{formatRelativeDate(stats?.lastOrderDate ?? null)}</div>
                  </div>
                  <div style={{ flex: 1, backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", padding: "0.4rem 0.6rem" }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Toplam Ciro</div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700 }}>{(stats?.totalRevenue ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</div>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "0.6rem", marginTop: "0.1rem" }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ width: "100%", fontSize: "0.8rem" }}
                    onClick={() => handleOpenHistory(c)}
                  >
                    <History size={14} /> <span>Satış Geçmişi</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="table-container">
          <table className="table" style={{ fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th>Müşteri</th>
                <th>Telefon</th>
                <th>E-posta</th>
                <th>Vergi No</th>
                <th style={{ textAlign: "center" }}>Son Sipariş</th>
                <th style={{ textAlign: "right" }}>Toplam Ciro</th>
                <th style={{ width: "110px" }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {sortedCustomers.map(c => {
                const stats = customerStats[c.id];
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <div style={{
                          width: "30px", height: "30px", borderRadius: "50%", flexShrink: 0,
                          backgroundColor: "var(--primary-light)", color: "var(--primary)",
                          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.7rem"
                        }}>
                          {getInitials(c.name)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>{c.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "220px" }}>{c.company}</div>
                        </div>
                      </div>
                    </td>
                    <td>{c.phone || "—"}</td>
                    <td>{c.email || "—"}</td>
                    <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{c.taxNumber || "—"}</td>
                    <td style={{ textAlign: "center" }}>{formatRelativeDate(stats?.lastOrderDate ?? null)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{(stats?.totalRevenue ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</td>
                    <td>
                      <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "0.3rem 0.5rem" }}
                          onClick={() => handleOpenHistory(c)}
                          title="Satış Geçmişi"
                        >
                          <History size={13} />
                        </button>
                        {renderActionsMenu(c)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        maxWidth="560px"
        title={editingId ? "Müşteriyi Düzenle" : "Yeni Müşteri Ekle"}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={handleCloseModal} disabled={submitting}>İptal</button>
            <button type="submit" form="customer-form" className="btn btn-primary" disabled={submitting}>
              <UserPlus size={16} /> <span>{submitting ? "Kaydediliyor..." : editingId ? "Değişiklikleri Kaydet" : "Müşteriyi Kaydet"}</span>
            </button>
          </>
        }
      >
        <form id="customer-form" onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
              <div className="form-group">
                <label className="form-label">Ad Soyad *</label>
                <input className={`form-control ${errors.name ? "is-invalid" : ""}`} value={form.name}
                  onChange={e => { setForm({ ...form, name: e.target.value }); setErrors({ ...errors, name: null }); }}
                  placeholder="Ahmet Yılmaz" />
                {errors.name && <div className="invalid-feedback">{errors.name}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Firma Unvanı *</label>
                <input className={`form-control ${errors.company ? "is-invalid" : ""}`} value={form.company}
                  onChange={e => { setForm({ ...form, company: e.target.value }); setErrors({ ...errors, company: null }); }}
                  placeholder="Yılmaz Ltd. Şti." />
                {errors.company && <div className="invalid-feedback">{errors.company}</div>}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
              <div className="form-group">
                <label className="form-label">Telefon</label>
                <input className={`form-control ${errors.phone ? "is-invalid" : ""}`} value={form.phone}
                  onChange={e => { setForm({ ...form, phone: e.target.value }); setErrors({ ...errors, phone: null }); }}
                  placeholder="05xx xxx xx xx" />
                {errors.phone && <div className="invalid-feedback">{errors.phone}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">E-posta</label>
                <input className={`form-control ${errors.email ? "is-invalid" : ""}`} value={form.email}
                  onChange={e => { setForm({ ...form, email: e.target.value }); setErrors({ ...errors, email: null }); }}
                  placeholder="ornek@firma.com" />
                {errors.email && <div className="invalid-feedback">{errors.email}</div>}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
              <div className="form-group">
                <label className="form-label">Vergi Dairesi</label>
                <input className="form-control" value={form.taxOffice}
                  onChange={e => setForm({ ...form, taxOffice: e.target.value })}
                  placeholder="Kadıköy" />
              </div>
              <div className="form-group">
                <label className="form-label">Vergi Numarası</label>
                <input className={`form-control ${errors.taxNumber ? "is-invalid" : ""}`} value={form.taxNumber}
                  onChange={e => { setForm({ ...form, taxNumber: e.target.value }); setErrors({ ...errors, taxNumber: null }); }}
                  placeholder="1234567890" maxLength={10} />
                {errors.taxNumber && <div className="invalid-feedback">{errors.taxNumber}</div>}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Adres</label>
              <textarea className="form-control" rows={2} value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="Açık adres..." style={{ resize: "none" }} />
            </div>
          </div>
        </form>
      </Modal>

      {historyCustomer && (
        <>
          <div onClick={handleCloseHistory} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 199 }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            zIndex: 200, width: "min(720px, 96vw)", maxHeight: "88vh",
            display: "flex", flexDirection: "column", borderRadius: "var(--radius-lg)",
            backgroundColor: "var(--bg-primary)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
          }} className="animate-slide-up">

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-color)", flexShrink: 0 }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.2rem" }}>{historyCustomer.company}</h3>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{historyCustomer.name}</div>
              </div>
              <button onClick={handleCloseHistory} style={{ cursor: "pointer", color: "var(--text-secondary)", padding: "0.25rem" }} aria-label="Kapat">
                <X size={20} />
              </button>
            </div>

            {historyStats && !historyLoading && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", padding: "1rem 1.5rem", borderBottom: "1px solid var(--border-color)", flexShrink: 0 }}>
                <div style={{ textAlign: "center", padding: "0.75rem", backgroundColor: "var(--bg-secondary)", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--primary)" }}>{historyStats.totalCount}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Toplam Satış</div>
                </div>
                <div style={{ textAlign: "center", padding: "0.75rem", backgroundColor: "var(--bg-secondary)", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--success)" }}>{historyStats.approvedCount}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Onaylanan</div>
                </div>
                <div style={{ textAlign: "center", padding: "0.75rem", backgroundColor: "var(--bg-secondary)", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary)" }}>
                    {historyStats.totalRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Toplam Ciro</div>
                </div>
                <div style={{ textAlign: "center", padding: "0.75rem", backgroundColor: "var(--bg-secondary)", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-secondary)" }}>
                    {historyStats.totalTax.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Toplam KDV</div>
                </div>
              </div>
            )}

            <div style={{ overflowY: "auto", flex: 1, padding: "0 1.5rem 1.5rem" }}>
              {historyLoading ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>Yükleniyor...</div>
              ) : historySales.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                  <TrendingUp size={40} style={{ marginBottom: "0.75rem", opacity: 0.3 }} />
                  <div>Bu müşteriye ait satış kaydı bulunamadı.</div>
                </div>
              ) : (
                <div className="table-container" style={{ marginTop: "1rem" }}>
                  <table className="table" style={{ fontSize: "0.85rem" }}>
                    <thead>
                      <tr>
                        <th>Fiş No / Tarih</th>
                        <th>Satışçı</th>
                        <th>Ürünler</th>
                        <th style={{ textAlign: "right" }}>Net Tutar</th>
                        <th style={{ textAlign: "center" }}>Durum</th>
                        <th style={{ width: "50px", textAlign: "center" }}>PDF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historySales.map(sale => (
                        <tr key={sale.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{sale.receiptNo}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              {new Date(sale.date).toLocaleDateString('tr-TR')}
                            </div>
                          </td>
                          <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{sale.salespersonName}</td>
                          <td>
                            <div style={{ maxWidth: "200px" }}>
                              {(sale.items || []).slice(0, 2).map((item, i) => (
                                <div key={i} style={{ fontSize: "0.78rem", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {item.productName} × {item.quantity}
                                </div>
                              ))}
                              {(sale.items || []).length > 2 && (
                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                  +{sale.items.length - 2} ürün daha
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: sale.status === "approved" ? "var(--success)" : "var(--text-primary)" }}>
                            {(sale.netAmount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span className={`badge badge-${statusBadge(sale.status)}`} style={{ fontSize: "0.65rem" }}>
                              {statusLabel(sale.status)}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              className="btn btn-secondary btn-icon btn-sm"
                              onClick={() => generateInvoicePDF(sale)}
                              title="PDF İndir"
                              style={{ padding: "0.3rem" }}
                            >
                              <Download size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Customers;
