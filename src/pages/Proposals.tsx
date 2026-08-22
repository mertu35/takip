// Takip Sistemi - Teklif Mektubu & Çıktı Arşivi (Proposals)
import React, { useState, useEffect } from "react";
import {
  getProposals,
  addProposal,
  updateProposal,
  deleteProposal,
  getCustomers,
  getProducts,
  getCompanyProfile
} from "../services/db";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  FileText,
  Plus,
  Search,
  Download,
  Trash2,
  Edit,
  MessageCircle,
  Building,
  User,
  Phone,
  Calendar,
  Layers,
  Sparkles,
  CheckCircle2,
  ShoppingCart
} from "lucide-react";
import EmptyState from "../components/EmptyState";
import { SkeletonTable } from "../components/Skeleton";
import { generateProposalPDF } from "../utils/generateProposalPDF";
import { formatCurrency, formatDate } from "../utils/format";
import type { Proposal, ProposalItem, Customer, Product, CompanyProfile } from "../types";

const UNIT_OPTIONS = ["ADET", "TRB", "TON", "SEFER", "KG", "M2", "METRE", "KUTU", "PAKET", "SAAT"];

const DEFAULT_TERMS = `1. Fiyatlarımıza KDV dahil değildir.
2. Teklifimiz belirtilen geçerlilik tarihine kadar geçerlidir.
3. Nakliye ve boşaltma şartları teklif detayına göre belirlenmiştir.`;

const Proposals = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Arama Filtresi
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedProposalId, setSelectedProposalId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [proposalForm, setProposalForm] = useState<{
    customerId: string;
    customerName: string;
    customerCompany: string;
    customerPhone: string;
    customerAddress: string;
    date: string;
    validUntil: string;
    salespersonPhone: string;
    items: ProposalItem[];
    discountAmount: number;
    notes: string;
    termsAndConditions: string;
  }>({
    customerId: "",
    customerName: "",
    customerCompany: "",
    customerPhone: "",
    customerAddress: "",
    date: new Date().toISOString().split("T")[0],
    validUntil: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    salespersonPhone: "0543 834 87 68",
    items: [
      {
        id: "item-1",
        description: "",
        quantity: 1,
        unit: "ADET",
        price: 0,
        taxRate: 20,
        total: 0
      }
    ],
    discountAmount: 0,
    notes: "",
    termsAndConditions: DEFAULT_TERMS
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [propData, custData, prodData, profileData] = await Promise.all([
        getProposals(user?.role, user?.uid),
        getCustomers(),
        getProducts(),
        getCompanyProfile()
      ]);
      setProposals(propData);
      setCustomers(custData);
      setProducts(prodData);
      setCompanyProfile(profileData);
    } catch (err: any) {
      showToast("Teklif verileri yüklenirken hata: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Yeni Teklif Modalı Aç
  const handleOpenAddModal = () => {
    setModalMode("add");
    setSelectedProposalId("");
    setProposalForm({
      customerId: "",
      customerName: "",
      customerCompany: "",
      customerPhone: "",
      customerAddress: "",
      date: new Date().toISOString().split("T")[0],
      validUntil: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
      salespersonPhone: companyProfile?.phone || "0543 834 87 68",
      items: [
        {
          id: "item-" + Date.now(),
          description: "",
          quantity: 1,
          unit: "ADET",
          price: 0,
          taxRate: 20,
          total: 0
        }
      ],
      discountAmount: 0,
      notes: "",
      termsAndConditions: DEFAULT_TERMS
    });
    setShowModal(true);
  };

  // Teklif Düzenle Modalı Aç (Sadece Admin / Patron açabilir)
  const handleOpenEditModal = (prop: Proposal) => {
    if (user?.role === "sales") {
      showToast("Güvenlik Kısıtlaması: Teklif mektupları kaydedildikten sonra satış elemanları tarafından düzenlenemez. Yalnızca Yönetici (Patron) düzenleyebilir.", "warning");
      return;
    }
    setModalMode("edit");
    setSelectedProposalId(prop.id);
    setProposalForm({
      customerId: prop.customerId || "",
      customerName: prop.customerName,
      customerCompany: prop.customerCompany || "",
      customerPhone: prop.customerPhone || "",
      customerAddress: prop.customerAddress || "",
      date: prop.date,
      validUntil: prop.validUntil,
      salespersonPhone: prop.salespersonPhone || "",
      items: prop.items.map((i) => ({ ...i })),
      discountAmount: prop.discountAmount || 0,
      notes: prop.notes || "",
      termsAndConditions: prop.termsAndConditions || DEFAULT_TERMS
    });
    setShowModal(true);
  };

  // Müşteri Seçildiğinde
  const handleCustomerSelect = (customerId: string) => {
    if (!customerId) {
      setProposalForm((prev) => ({
        ...prev,
        customerId: "",
        customerName: "",
        customerCompany: "",
        customerPhone: "",
        customerAddress: ""
      }));
      return;
    }

    const cust = customers.find((c) => c.id === customerId);
    if (cust) {
      setProposalForm((prev) => ({
        ...prev,
        customerId: cust.id,
        customerName: cust.name,
        customerCompany: cust.company,
        customerPhone: cust.phone || "",
        customerAddress: cust.address || ""
      }));
    }
  };

  // Kalem Satırı Ekle
  const handleAddItem = () => {
    setProposalForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: "item-" + Date.now(),
          description: "",
          quantity: 1,
          unit: "ADET",
          price: 0,
          taxRate: 20,
          total: 0
        }
      ]
    }));
  };

  // Kalem Satırı Sil
  const handleRemoveItem = (idx: number) => {
    if (proposalForm.items.length <= 1) {
      showToast("Teklifte en az bir kalem bulunmalıdır.", "warning");
      return;
    }
    setProposalForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  // Kalem Değişikliği
  const handleItemChange = (idx: number, field: keyof ProposalItem, value: any) => {
    setProposalForm((prev) => {
      const updatedItems = [...prev.items];
      const item = { ...updatedItems[idx], [field]: value };

      if (field === "quantity" || field === "price") {
        const qty = field === "quantity" ? parseFloat(value) || 0 : item.quantity;
        const prc = field === "price" ? parseFloat(value) || 0 : item.price;
        item.total = qty * prc;
      }

      updatedItems[idx] = item;
      return { ...prev, items: updatedItems };
    });
  };

  // Stoktan Ürün Seçimi
  const handleSelectProductToItem = (idx: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    setProposalForm((prev) => {
      const updatedItems = [...prev.items];
      const qty = updatedItems[idx].quantity || 1;
      updatedItems[idx] = {
        ...updatedItems[idx],
        productId: prod.id,
        description: prod.name,
        unit: prod.unit || "ADET",
        price: prod.price,
        taxRate: prod.taxRate ?? 20,
        total: qty * prod.price
      };
      return { ...prev, items: updatedItems };
    });
  };

  // Hızlı Gün Butonları
  const handleSetValidityDays = (days: number) => {
    const d = new Date(proposalForm.date || Date.now());
    d.setDate(d.getDate() + days);
    setProposalForm((prev) => ({ ...prev, validUntil: d.toISOString().split("T")[0] }));
  };

  // Finansal Toplamlar
  const subtotal = proposalForm.items.reduce((acc, item) => acc + (item.quantity * item.price || 0), 0);
  const discount = Math.min(proposalForm.discountAmount || 0, subtotal);
  const taxAmount = proposalForm.items.reduce((acc, item) => {
    const itemTotal = item.quantity * item.price || 0;
    return acc + itemTotal * ((item.taxRate ?? 20) / 100);
  }, 0);
  const totalAmount = Math.max(0, subtotal - discount) + taxAmount;

  // Form Kaydet
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!proposalForm.customerName.trim() && !proposalForm.customerCompany.trim()) {
      showToast("Lütfen müşteri adını veya firma ünvanını girin.", "warning");
      return;
    }

    const validItems = proposalForm.items.filter((i) => i.description.trim() && i.quantity > 0);
    if (validItems.length === 0) {
      showToast("Lütfen en az bir ürün veya hizmet açıklaması girin.", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...proposalForm,
        salespersonId: user.uid,
        salespersonName: user.displayName || "Yetkili Satışçı",
        items: validItems,
        status: "sent" as const
      };

      if (modalMode === "add") {
        const created = await addProposal(payload, user.uid, user.displayName, user.role);
        showToast(`${created.proposalNo} numaralı teklif kaydedildi.`, "success");
        // Otomatik PDF üret
        generateProposalPDF(created, companyProfile);
      } else {
        const updated = await updateProposal(selectedProposalId, payload, user.uid, user.displayName, user.role);
        showToast("Teklif güncellendi.", "success");
        generateProposalPDF(updated, companyProfile);
      }

      setShowModal(false);
      fetchData();
    } catch (err: any) {
      showToast("Teklif kaydedilirken hata: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Teklif Sil
  const handleDeleteProposal = async (prop: Proposal) => {
    if (user?.role === "sales") {
      showToast("Güvenlik Kısıtlaması: Teklif mektupları satış elemanları tarafından silinemez.", "warning");
      return;
    }

    if (!window.confirm(`"${prop.proposalNo}" numaralı teklif mektubunu silmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      await deleteProposal(prop.id, user!.uid, user!.displayName, user!.role);
      showToast("Teklif silindi.", "success");
      fetchData();
    } catch (err: any) {
      showToast("Silinirken hata: " + err.message, "error");
    }
  };

  // WhatsApp Paylaşımı
  const handleShareWhatsApp = (prop: Proposal) => {
    const phoneClean = (prop.customerPhone || "").replace(/[^0-9]/g, "");
    const itemsList = prop.items
      .map((i, idx) => `${idx + 1}. ${i.description} (${i.quantity} ${i.unit}) - ${formatCurrency(i.price)}`)
      .join("\n");

    const message = `*ÖZKON YAPI İNŞAAT - TEKLİF MEKTUBU*
Sayın *${prop.customerCompany || prop.customerName}*,

${prop.proposalNo} numaralı teklif detaylarımız aşağıda bilgilerinize sunulmuştur:

*Teklif Tarihi:* ${formatDate(prop.date)}
*Son Geçerlilik:* ${formatDate(prop.validUntil)}

*Teklif Kalemleri:*
${itemsList}

*Genel Toplam:* ${formatCurrency(prop.totalAmount)}
*Yetkili:* ${prop.salespersonName} (${prop.salespersonPhone || ""})

İyi çalışmalar dileriz.`;

    const encoded = encodeURIComponent(message);
    const url = phoneClean ? `https://wa.me/90${phoneClean}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank");
  };

  // Arama Filtresi
  const filteredProposals = proposals.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.proposalNo.toLowerCase().includes(q) ||
      p.customerName.toLowerCase().includes(q) ||
      (p.customerCompany || "").toLowerCase().includes(q) ||
      p.salespersonName.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }} className="animate-fade">
      {/* Üst Başlık & Aksiyon Şeridi */}
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <FileText size={22} className="text-primary" />
              <span>Teklif Mektupları</span>
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0.25rem 0 0 0" }}>
              Müşterilere resmi inşaat ve malzeme teklifleri hazırlayın, PDF çıktısı alın ve geçmiş teklifleri arşivleyin.
            </p>
          </div>

          <button className="btn btn-primary" onClick={handleOpenAddModal} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Plus size={18} />
            <span>Yeni Teklif Hazırla</span>
          </button>
        </div>

        {/* Arama Alanı */}
        <div style={{ position: "relative", maxWidth: "400px" }}>
          <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
            <Search size={16} />
          </span>
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: "2.25rem" }}
            placeholder="Teklif No veya Müşteri Ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </section>

      {/* Teklif Listesi Tablosu */}
      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "1.5rem" }}>
            <SkeletonTable rows={6} columns={6} />
          </div>
        ) : filteredProposals.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Henüz teklif mektubu bulunmuyor"
            description="Müşterinize inşaat, demir, çimento veya nakliye kalemlerini içeren ilk teklifinizi hazırlayın."
            actionText="+ Yeni Teklif Hazırla"
            onAction={handleOpenAddModal}
          />
        ) : (
          <div className="table-container" style={{ border: "none" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Teklif No</th>
                  <th>Müşteri / Firma</th>
                  <th>Teklif Tarihi</th>
                  <th>Son Geçerlilik</th>
                  <th style={{ textAlign: "right" }}>Tutar</th>
                  <th>Yetkili Satışçı</th>
                  <th style={{ textAlign: "right", width: "160px" }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredProposals.map((prop) => (
                  <tr key={prop.id}>
                    <td style={{ fontWeight: 700, color: "var(--primary)" }}>{prop.proposalNo}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{prop.customerCompany || prop.customerName}</div>
                      {prop.customerCompany && prop.customerName && (
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>İlgili: {prop.customerName}</div>
                      )}
                    </td>
                    <td>{formatDate(prop.date)}</td>
                    <td>{formatDate(prop.validUntil)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, fontSize: "0.95rem" }}>
                      {formatCurrency(prop.totalAmount)}
                    </td>
                    <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{prop.salespersonName}</td>
                    <td>
                      <div style={{ display: "flex", gap: "0.35rem", justifyContent: "flex-end" }}>
                        {/* PDF İndir */}
                        <button
                          type="button"
                          className="btn btn-secondary btn-icon btn-sm"
                          onClick={() => generateProposalPDF(prop, companyProfile)}
                          title="Özkon Antetli Teklif PDF İndir"
                          aria-label="PDF İndir"
                        >
                          <Download size={15} />
                        </button>

                        {/* WhatsApp Paylaş */}
                        <button
                          type="button"
                          className="btn btn-secondary btn-icon btn-sm"
                          style={{ color: "#25D366" }}
                          onClick={() => handleShareWhatsApp(prop)}
                          title="WhatsApp ile Gönder"
                          aria-label="WhatsApp"
                        >
                          <MessageCircle size={15} />
                        </button>

                        {/* Düzenle (Sadece Yönetici / Patron) */}
                        {(user?.role === "admin" || user?.role === "sysadmin") && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon btn-sm"
                            onClick={() => handleOpenEditModal(prop)}
                            title="Yönetici: Teklifi Düzenle"
                            aria-label="Düzenle"
                          >
                            <Edit size={15} />
                          </button>
                        )}

                        {/* Sil (Sadece Yönetici / Patron) */}
                        {(user?.role === "admin" || user?.role === "sysadmin") && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon btn-sm"
                            style={{ color: "var(--danger)" }}
                            onClick={() => handleDeleteProposal(prop)}
                            title="Yönetici: Teklifi Sil"
                            aria-label="Sil"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- FERAH VE TAM EKRANA UYGUN TEKLİF HAZIRLAMA MODALI --- */}
      {showModal && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            backgroundColor: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem"
          }}
        >
          <div
            className="modal-content animate-slide-up"
            style={{
              width: "96vw",
              maxWidth: "1050px",
              maxHeight: "94vh",
              display: "flex",
              flexDirection: "column",
              backgroundColor: "var(--bg-secondary)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-xl)",
              overflow: "hidden"
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "1rem 1.5rem",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "var(--bg-tertiary)"
              }}
            >
              <div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <FileText size={18} className="text-primary" />
                  <span>{modalMode === "add" ? "Yeni Teklif Mektubu Hazırla" : "Teklif Mektubunu Düzenle"}</span>
                </h3>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Özkon Yapı antetli resmi A4 teklif çıktısı için bilgileri doldurun.
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ cursor: "pointer", fontSize: "1.4rem", background: "none", border: "none", color: "var(--text-muted)" }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "auto" }}>
              <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                
                {/* 1. Kısım: Müşteri & Tarihler (Kompakt 2 Sütun) */}
                <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "1rem" }} className="grid-cols-2">
                  
                  {/* Sol: Müşteri Bilgileri */}
                  <div className="card" style={{ padding: "0.85rem 1rem", backgroundColor: "var(--bg-tertiary)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <User size={14} />
                      <span>Müşteri Bilgileri</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.7rem", marginBottom: "0.2rem" }}>Kayıtlı Müşteri Seç</label>
                        <select
                          className="form-control"
                          value={proposalForm.customerId}
                          onChange={(e) => handleCustomerSelect(e.target.value)}
                          style={{ fontSize: "0.8rem", padding: "0.3rem 0.5rem" }}
                        >
                          <option value="">-- Serbest Müşteri Girişi --</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.company} ({c.name})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.7rem", marginBottom: "0.2rem" }}>Firma / Ünvan *</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Örn: Recep İnşaat"
                          value={proposalForm.customerCompany}
                          onChange={(e) => setProposalForm({ ...proposalForm, customerCompany: e.target.value })}
                          required
                          style={{ fontSize: "0.8rem", padding: "0.3rem 0.5rem" }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.7rem", marginBottom: "0.2rem" }}>İlgili Kişi</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Örn: Recep Bey"
                          value={proposalForm.customerName}
                          onChange={(e) => setProposalForm({ ...proposalForm, customerName: e.target.value })}
                          style={{ fontSize: "0.8rem", padding: "0.3rem 0.5rem" }}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.7rem", marginBottom: "0.2rem" }}>Telefon</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="0543..."
                          value={proposalForm.customerPhone}
                          onChange={(e) => setProposalForm({ ...proposalForm, customerPhone: e.target.value })}
                          style={{ fontSize: "0.8rem", padding: "0.3rem 0.5rem" }}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.7rem", marginBottom: "0.2rem" }}>Şantiye / Adres</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Karaman..."
                          value={proposalForm.customerAddress}
                          onChange={(e) => setProposalForm({ ...proposalForm, customerAddress: e.target.value })}
                          style={{ fontSize: "0.8rem", padding: "0.3rem 0.5rem" }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sağ: Tarih & Yetkili */}
                  <div className="card" style={{ padding: "0.85rem 1rem", backgroundColor: "var(--bg-tertiary)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <Calendar size={14} />
                      <span>Tarih & Yetkili Bilgileri</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.7rem", marginBottom: "0.2rem" }}>Teklif Tarihi</label>
                        <input
                          type="date"
                          className="form-control"
                          value={proposalForm.date}
                          onChange={(e) => setProposalForm({ ...proposalForm, date: e.target.value })}
                          required
                          style={{ fontSize: "0.8rem", padding: "0.3rem 0.5rem" }}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <label className="form-label" style={{ fontSize: "0.7rem", marginBottom: "0.2rem" }}>Son Geçerlilik</label>
                          <div style={{ display: "flex", gap: "0.2rem" }}>
                            <button type="button" className="btn btn-secondary btn-sm" style={{ padding: "0.05rem 0.25rem", fontSize: "0.65rem" }} onClick={() => handleSetValidityDays(7)}>+7G</button>
                            <button type="button" className="btn btn-secondary btn-sm" style={{ padding: "0.05rem 0.25rem", fontSize: "0.65rem" }} onClick={() => handleSetValidityDays(15)}>+15G</button>
                            <button type="button" className="btn btn-secondary btn-sm" style={{ padding: "0.05rem 0.25rem", fontSize: "0.65rem" }} onClick={() => handleSetValidityDays(30)}>+30G</button>
                          </div>
                        </div>
                        <input
                          type="date"
                          className="form-control"
                          value={proposalForm.validUntil}
                          onChange={(e) => setProposalForm({ ...proposalForm, validUntil: e.target.value })}
                          required
                          style={{ fontSize: "0.8rem", padding: "0.3rem 0.5rem" }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.7rem", marginBottom: "0.2rem" }}>Yetkili Satışçı</label>
                        <input
                          type="text"
                          className="form-control"
                          value={user?.displayName || "Abdullah Mete"}
                          readOnly
                          disabled
                          style={{ fontSize: "0.8rem", padding: "0.3rem 0.5rem", backgroundColor: "var(--bg-secondary)" }}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.7rem", marginBottom: "0.2rem" }}>Yetkili İletişim Tel</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="0543..."
                          value={proposalForm.salespersonPhone}
                          onChange={(e) => setProposalForm({ ...proposalForm, salespersonPhone: e.target.value })}
                          style={{ fontSize: "0.8rem", padding: "0.3rem 0.5rem" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Kısım: Kalemler Tablosu */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <Layers size={15} className="text-primary" />
                      <span>Teklif Kalemleri (Ürün / Malzeme / Nakliye)</span>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleAddItem}
                      style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.3rem" }}
                    >
                      <Plus size={13} />
                      <span>+ Satır Ekle</span>
                    </button>
                  </div>

                  <div className="table-container" style={{ border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", maxHeight: "240px", overflowY: "auto" }}>
                    <table className="table" style={{ fontSize: "0.8rem", margin: 0 }}>
                      <thead style={{ backgroundColor: "var(--bg-tertiary)", position: "sticky", top: 0, zIndex: 1 }}>
                        <tr>
                          <th style={{ width: "30px", textAlign: "center" }}>#</th>
                          <th style={{ width: "170px" }}>Stoktan Seç</th>
                          <th style={{ minWidth: "200px" }}>Ürün / Hizmet Açıklaması *</th>
                          <th style={{ width: "85px", textAlign: "center" }}>Miktar *</th>
                          <th style={{ width: "90px" }}>Birim</th>
                          <th style={{ width: "110px", textAlign: "right" }}>B. Fiyat (₺) *</th>
                          <th style={{ width: "110px", textAlign: "right" }}>Toplam (₺)</th>
                          <th style={{ width: "35px" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {proposalForm.items.map((item, idx) => (
                          <tr key={item.id || idx}>
                            <td style={{ textAlign: "center", fontWeight: 600, color: "var(--text-muted)" }}>{idx + 1}</td>
                            <td>
                              <select
                                className="form-control"
                                style={{ fontSize: "0.75rem", padding: "0.2rem 0.4rem" }}
                                value={item.productId || ""}
                                onChange={(e) => handleSelectProductToItem(idx, e.target.value)}
                              >
                                <option value="">-- Serbest Giriş --</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.price} ₺)
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Örn: 20 LİK BİMS veya NAKLİYE"
                                value={item.description}
                                onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                                required
                                style={{ fontSize: "0.8rem", padding: "0.2rem 0.4rem" }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="any"
                                min="0.01"
                                className="form-control"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                                required
                                style={{ fontSize: "0.8rem", textAlign: "center", padding: "0.2rem 0.3rem" }}
                              />
                            </td>
                            <td>
                              <select
                                className="form-control"
                                value={item.unit || "ADET"}
                                onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                                style={{ fontSize: "0.75rem", padding: "0.2rem 0.3rem" }}
                              >
                                {UNIT_OPTIONS.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                className="form-control"
                                value={item.price}
                                onChange={(e) => handleItemChange(idx, "price", e.target.value)}
                                required
                                style={{ fontSize: "0.8rem", textAlign: "right", padding: "0.2rem 0.4rem" }}
                              />
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 700, fontSize: "0.85rem" }}>
                              {formatCurrency(item.total || item.quantity * item.price)}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                style={{ color: "var(--danger)", background: "none", border: "none", cursor: "pointer", padding: "0.2rem" }}
                                title="Satırı Sil"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. Kısım: Notlar ve Finansal Özet */}
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "1rem" }} className="grid-cols-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.2rem" }}>
                      Notlar & Satış Şartları (PDF Altında Gözükür)
                    </label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={proposalForm.termsAndConditions}
                      onChange={(e) => setProposalForm({ ...proposalForm, termsAndConditions: e.target.value })}
                      style={{ fontSize: "0.75rem", resize: "vertical" }}
                      placeholder="Teslimat yeri, nakliye durumu, ödeme şartları..."
                    />
                  </div>

                  <div className="card" style={{ padding: "0.75rem 1rem", backgroundColor: "var(--bg-tertiary)", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Ara Toplam:</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(subtotal)}</span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem" }}>
                      <span style={{ color: "var(--text-secondary)" }}>İskonto / İndirim:</span>
                      <input
                        type="number"
                        min="0"
                        className="form-control"
                        style={{ width: "90px", padding: "0.15rem 0.35rem", textAlign: "right", fontSize: "0.8rem" }}
                        value={proposalForm.discountAmount}
                        onChange={(e) => setProposalForm({ ...proposalForm, discountAmount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Hesaplanan KDV (%20):</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(taxAmount)}</span>
                    </div>

                    <div style={{ borderTop: "2px solid var(--border-color)", paddingTop: "0.4rem", marginTop: "0.2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 800, fontSize: "0.9rem" }}>GENEL TOPLAM:</span>
                      <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--primary)" }}>
                        {formatCurrency(totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: "0.85rem 1.5rem",
                  borderTop: "1px solid var(--border-color)",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                  backgroundColor: "var(--bg-tertiary)"
                }}
              >
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  İptal
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Download size={16} />
                  <span>{submitting ? "Kaydediliyor..." : modalMode === "add" ? "Teklifi Kaydet & PDF İndir" : "Teklifi Güncelle & PDF İndir"}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
};

export default Proposals;
