import React, { useState, useEffect, useCallback } from "react";
import { getCustomers, addCustomer, getSalesByCustomer } from "../services/db";
import { generateInvoicePDF } from "../utils/generateInvoicePDF";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { UserPlus, Search, Phone, Mail, Building2, Hash, History, TrendingUp, X, MapPin, Download } from "lucide-react";
import type { Customer, Sale } from "../types";

type CustomerForm = Omit<Customer, "id" | "createdAt">;

const emptyForm: CustomerForm = {
  name: "", company: "", phone: "", email: "",
  taxOffice: "", taxNumber: "", address: ""
};

const statusLabel = (s: string) => s === "approved" ? "Onaylandı" : s === "rejected" ? "Reddedildi" : "Bekliyor";
const statusBadge = (s: string) => s === "approved" ? "success" : s === "rejected" ? "danger" : "warning";

const Customers = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [submitting, setSubmitting] = useState(false);

  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [historySales, setHistorySales] = useState<Sale[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch (e) {
      showToast("Müşteriler yüklenemedi.", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone && c.phone.includes(searchQuery)) ||
    (c.taxNumber && c.taxNumber.includes(searchQuery))
  );

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      await addCustomer(form, user!.uid, user!.displayName, user!.role);
      showToast("Müşteri başarıyla eklendi.", "success");
      setForm(emptyForm);
      setErrors({});
      setShowModal(false);
      fetchCustomers();
    } catch (err: any) {
      showToast("Müşteri eklenemedi: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenHistory = async (customer: Customer) => {
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade">

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Müşteri Listesi</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Toplam {customers.length} müşteri kayıtlı
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setErrors({}); setShowModal(true); }}>
          <UserPlus size={18} /> <span>Yeni Müşteri</span>
        </button>
      </div>

      <div style={{ position: "relative", maxWidth: "420px" }}>
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

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
          {searchQuery ? "Aramanızla eşleşen müşteri bulunamadı." : "Henüz müşteri kaydı yok. Yeni müşteri ekleyebilirsiniz."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
          {filtered.map(c => (
            <div key={c.id} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>{c.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--primary)", fontSize: "0.85rem", fontWeight: 600 }}>
                <Building2 size={14} /> {c.company}
              </div>
              {c.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                  <Phone size={14} /> {c.phone}
                </div>
              )}
              {c.email && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                  <Mail size={14} /> {c.email}
                </div>
              )}
              {c.taxNumber && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                  <Hash size={14} /> VN: {c.taxNumber} {c.taxOffice && `/ ${c.taxOffice} V.D.`}
                </div>
              )}
              {c.address && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.8rem", color: "var(--text-muted)", borderTop: "1px solid var(--border-color)", paddingTop: "0.5rem", marginTop: "0.25rem" }}>
                  <MapPin size={13} style={{ marginTop: "1px", flexShrink: 0 }} /> {c.address}
                </div>
              )}
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
          ))}
        </div>
      )}

      {showModal && (
        <>
          <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 199 }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            zIndex: 200, width: "min(520px, 95vw)", maxHeight: "90vh", overflowY: "auto"
          }} className="card animate-slide-up">
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.25rem" }}>Yeni Müşteri Ekle</h3>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
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
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>İptal</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <UserPlus size={16} /> <span>{submitting ? "Kaydediliyor..." : "Müşteriyi Kaydet"}</span>
                </button>
              </div>
            </form>
          </div>
        </>
      )}

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
