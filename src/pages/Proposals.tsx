// Takip Sistemi - Teklif Mektubu Yönetimi (Proposals)
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getProposals,
  addProposal,
  updateProposal,
  updateProposalStatus,
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
  Printer,
  Trash2,
  Edit,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Send,
  MessageCircle,
  Building,
  User,
  Phone,
  Calendar,
  Layers,
  ChevronRight,
  ArrowRight,
  ShoppingCart,
  Sparkles,
  DollarSign
} from "lucide-react";
import EmptyState from "../components/EmptyState";
import { SkeletonTable } from "../components/Skeleton";
import { generateProposalPDF } from "../utils/generateProposalPDF";
import { formatCurrency, formatDate } from "../utils/format";
import type { Proposal, ProposalItem, ProposalStatus, Customer, Product, CompanyProfile } from "../types";

const UNIT_OPTIONS = ["ADET", "TRB", "TON", "SEFER", "KG", "M2", "METRE", "KUTU", "PAKET", "SAAT"];

const STATUS_LABELS: Record<ProposalStatus, { label: string; badge: string; icon: any }> = {
  draft: { label: "Taslak", badge: "badge-secondary", icon: Clock },
  sent: { label: "Gönderildi", badge: "badge-primary", icon: Send },
  accepted: { label: "Kabul Edildi", badge: "badge-success", icon: CheckCircle2 },
  rejected: { label: "Reddedildi", badge: "badge-danger", icon: XCircle },
  expired: { label: "Süresi Doldu", badge: "badge-warning", icon: AlertTriangle }
};

const DEFAULT_TERMS = `1. Fiyatlarımıza KDV dahil değildir.
2. Teklifimiz belirtilen geçerlilik tarihine kadar geçerlidir.
3. Nakliye ve boşaltma şartları teklif kapsamındadır.
4. Ödeme vadeli satışlarda teslimat öncesi mutabakat sağlanmalıdır.`;

const Proposals = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Filtreler
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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
    status: ProposalStatus;
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
    termsAndConditions: DEFAULT_TERMS,
    status: "sent"
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
      termsAndConditions: DEFAULT_TERMS,
      status: "sent"
    });
    setShowModal(true);
  };

  // Teklif Düzenle Modalı Aç
  const handleOpenEditModal = (prop: Proposal) => {
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
      termsAndConditions: prop.termsAndConditions || DEFAULT_TERMS,
      status: prop.status
    });
    setShowModal(true);
  };

  // Müşteri Seçimi Değiştiğinde
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

  // Kalem Güncelle
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

  // Stoktan Ürün Seçip Satıra Doldur
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

  // Geçerlilik Süresi Hızlı Butonları (7, 15, 30 Gün)
  const handleSetValidityDays = (days: number) => {
    const d = new Date(proposalForm.date || Date.now());
    d.setDate(d.getDate() + days);
    setProposalForm((prev) => ({ ...prev, validUntil: d.toISOString().split("T")[0] }));
  };

  // Finansal Toplam Hesaplama
  const subtotal = proposalForm.items.reduce((acc, item) => acc + (item.quantity * item.price || 0), 0);
  const discount = Math.min(proposalForm.discountAmount || 0, subtotal);
  const taxAmount = proposalForm.items.reduce((acc, item) => {
    const itemTotal = item.quantity * item.price || 0;
    return acc + itemTotal * ((item.taxRate ?? 20) / 100);
  }, 0);
  const totalAmount = Math.max(0, subtotal - discount) + taxAmount;

  // Form Gönderimi (Kaydet)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!proposalForm.customerName.trim() && !proposalForm.customerCompany.trim()) {
      showToast("Lütfen müşteri adını veya firma ünvanını girin.", "warning");
      return;
    }

    const validItems = proposalForm.items.filter((i) => i.description.trim() && i.quantity > 0);
    if (validItems.length === 0) {
      showToast("Lütfen en az bir ürün veya hizmet açıklaması ve miktarı girin.", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...proposalForm,
        salespersonId: user.uid,
        salespersonName: user.displayName || "Yetkili Satışçı",
        items: validItems
      };

      if (modalMode === "add") {
        const created = await addProposal(payload, user.uid, user.displayName, user.role);
        showToast(`${created.proposalNo} numaralı teklif mektubu oluşturuldu.`, "success");
      } else {
        await updateProposal(selectedProposalId, payload, user.uid, user.displayName, user.role);
        showToast("Teklif mektubu güncellendi.", "success");
      }

      setShowModal(false);
      fetchData();
    } catch (err: any) {
      showToast("Teklif kaydedilirken hata: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Teklif Silme
  const handleDeleteProposal = async (prop: Proposal) => {
    if (!window.confirm(`"${prop.proposalNo}" numaralı teklif mektubunu silmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      await deleteProposal(prop.id, user!.uid, user!.displayName, user!.role);
      showToast("Teklif mektubu silindi.", "success");
      fetchData();
    } catch (err: any) {
      showToast("Silinirken hata: " + err.message, "error");
    }
  };

  // Teklifi Satışa Dönüştür (Satış Ekranına Aktar)
  const handleConvertToSale = async (prop: Proposal) => {
    if (!window.confirm(`"${prop.proposalNo}" numaralı teklif kabul edildi olarak işaretlensin ve Satış Terminaline aktarılsın mı?`)) {
      return;
    }

    try {
      await updateProposalStatus(prop.id, "accepted", user!.uid, user!.displayName, user!.role);
      showToast("Teklif kabul edildi olarak işaretlendi. Satış ekranına yönlendiriliyorsunuz...", "success");

      // Satış ekranında sepeti teklif kalemleriyle doldurabilmek için session state'e yaz
      sessionStorage.setItem(
        "takip_convert_proposal",
        JSON.stringify({
          proposalNo: prop.proposalNo,
          customerId: prop.customerId,
          customerCompany: prop.customerCompany || prop.customerName,
          items: prop.items,
          discountAmount: prop.discountAmount,
          notes: `[Teklif No: ${prop.proposalNo}] ` + (prop.notes || "")
        })
      );

      navigate("/sales");
    } catch (err: any) {
      showToast("İşlem hatası: " + err.message, "error");
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

Detaylı bilgi ve onay için bize ulaşabilirsiniz.`;

    const encoded = encodeURIComponent(message);
    const url = phoneClean ? `https://wa.me/90${phoneClean}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank");
  };

  // Filtreleme
  const filteredProposals = proposals.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.proposalNo.toLowerCase().includes(q) ||
      p.customerName.toLowerCase().includes(q) ||
      (p.customerCompany || "").toLowerCase().includes(q) ||
      p.salespersonName.toLowerCase().includes(q);

    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade">
      {/* Üst Başlık & Aksiyon Şeridi */}
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <FileText size={22} className="text-primary" />
              <span>Teklif Mektubu Yönetimi</span>
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0.25rem 0 0 0" }}>
              Müşterilere resmi inşaat ve malzeme teklifleri hazırlayın, PDF çıktısı alın ve kabul edilenleri satışa aktarın.
            </p>
          </div>

          <button className="btn btn-primary" onClick={handleOpenAddModal} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Plus size={18} />
            <span>Yeni Teklif Hazırla</span>
          </button>
        </div>

        {/* Arama ve Durum Filtreleri */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "240px" }}>
            <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
              <Search size={16} />
            </span>
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: "2.25rem" }}
              placeholder="Teklif No, Müşteri veya Yetkili ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`btn btn-sm ${statusFilter === "all" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setStatusFilter("all")}
            >
              Tümü ({proposals.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${statusFilter === "sent" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setStatusFilter("sent")}
            >
              Gönderildi
            </button>
            <button
              type="button"
              className={`btn btn-sm ${statusFilter === "accepted" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setStatusFilter("accepted")}
            >
              Kabul Edildi
            </button>
            <button
              type="button"
              className={`btn btn-sm ${statusFilter === "draft" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setStatusFilter("draft")}
            >
              Taslak
            </button>
          </div>
        </div>
      </section>

      {/* Teklif Listesi Tablosu */}
      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "1.5rem" }}>
            <SkeletonTable rows={6} columns={7} />
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
                  <th>Geçerlilik</th>
                  <th style={{ textAlign: "right" }}>Tutar</th>
                  <th style={{ textAlign: "center" }}>Durum</th>
                  <th>Yetkili</th>
                  <th style={{ textAlign: "right", width: "220px" }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredProposals.map((prop) => {
                  const statusConf = STATUS_LABELS[prop.status] || STATUS_LABELS.sent;
                  const isExpired = new Date(prop.validUntil) < new Date() && prop.status === "sent";

                  return (
                    <tr key={prop.id}>
                      <td style={{ fontWeight: 700, color: "var(--primary)" }}>{prop.proposalNo}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{prop.customerCompany || prop.customerName}</div>
                        {prop.customerCompany && prop.customerName && (
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Yetkili: {prop.customerName}</div>
                        )}
                      </td>
                      <td>{formatDate(prop.date)}</td>
                      <td>
                        <div style={{ fontSize: "0.85rem", color: isExpired ? "var(--danger)" : "inherit", fontWeight: isExpired ? 700 : 400 }}>
                          {formatDate(prop.validUntil)}
                          {isExpired && <span style={{ fontSize: "0.7rem", marginLeft: "0.3rem" }}>(Doldu)</span>}
                        </div>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, fontSize: "0.95rem" }}>
                        {formatCurrency(prop.totalAmount)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`badge ${statusConf.badge}`} style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}>
                          {statusConf.label}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{prop.salespersonName}</td>
                      <td>
                        <div style={{ display: "flex", gap: "0.35rem", justifyContent: "flex-end" }}>
                          {/* PDF İndir */}
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon btn-sm"
                            onClick={() => generateProposalPDF(prop, companyProfile)}
                            title="Özkon Antetli A4 Teklif PDF İndir"
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
                            title="Müşteriye WhatsApp ile Gönder"
                            aria-label="WhatsApp"
                          >
                            <MessageCircle size={15} />
                          </button>

                          {/* Satışa Dönüştür */}
                          {prop.status !== "accepted" && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-icon btn-sm"
                              style={{ color: "var(--success)" }}
                              onClick={() => handleConvertToSale(prop)}
                              title="Teklifi Kabul Et & Satış Terminaline Aktar"
                              aria-label="Satışa Dönüştür"
                            >
                              <ShoppingCart size={15} />
                            </button>
                          )}

                          {/* Düzenle */}
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon btn-sm"
                            onClick={() => handleOpenEditModal(prop)}
                            title="Teklifi Düzenle"
                            aria-label="Düzenle"
                          >
                            <Edit size={15} />
                          </button>

                          {/* Sil */}
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon btn-sm"
                            style={{ color: "var(--danger)" }}
                            onClick={() => handleDeleteProposal(prop)}
                            title="Teklifi Sil"
                            aria-label="Sil"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- YENİ TEKLİF / TEKLİF DÜZENLEME MODALI --- */}
      {showModal && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, zIndex: 1000, backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div className="modal-content animate-slide-up" style={{ maxWidth: "850px", width: "100%", maxHeight: "92vh", display: "flex", flexDirection: "column", backgroundColor: "var(--bg-secondary)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-xl)" }}>
            
            {/* Modal Header */}
            <div className="modal-header" style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                  {modalMode === "add" ? "Yeni Teklif Mektubu Hazırla" : "Teklif Mektubunu Düzenle"}
                </h3>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Özkon Yapı antetli, inşaat/malzeme ve nakliye kalemli teklif mektubu
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ cursor: "pointer", fontSize: "1.5rem", background: "none", border: "none", color: "var(--text-muted)" }}>&times;</button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "auto" }}>
              <div className="modal-body" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                
                {/* 1. Kısım: Müşteri Bilgileri & Tarihler */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }} className="grid-cols-2">
                  
                  {/* Sol: Müşteri */}
                  <div className="card" style={{ padding: "1rem", backgroundColor: "var(--bg-tertiary)", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <User size={15} />
                      <span>Müşteri Bilgileri</span>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Kayıtlı Müşteri Seçin</label>
                      <select
                        className="form-control"
                        value={proposalForm.customerId}
                        onChange={(e) => handleCustomerSelect(e.target.value)}
                        style={{ fontSize: "0.85rem" }}
                      >
                        <option value="">-- Yeni / Serbest Müşteri --</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.company} ({c.name})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.75rem" }}>Firma / Ünvan *</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Örn: Recep İnşaat"
                          value={proposalForm.customerCompany}
                          onChange={(e) => setProposalForm({ ...proposalForm, customerCompany: e.target.value })}
                          required
                          style={{ fontSize: "0.85rem" }}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.75rem" }}>İlgili Kişi</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Örn: Recep Bey"
                          value={proposalForm.customerName}
                          onChange={(e) => setProposalForm({ ...proposalForm, customerName: e.target.value })}
                          style={{ fontSize: "0.85rem" }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.75rem" }}>Telefon</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="0543..."
                          value={proposalForm.customerPhone}
                          onChange={(e) => setProposalForm({ ...proposalForm, customerPhone: e.target.value })}
                          style={{ fontSize: "0.85rem" }}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.75rem" }}>Şantiye / Adres</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Karaman Merkez..."
                          value={proposalForm.customerAddress}
                          onChange={(e) => setProposalForm({ ...proposalForm, customerAddress: e.target.value })}
                          style={{ fontSize: "0.85rem" }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sağ: Teklif Meta Bilgileri */}
                  <div className="card" style={{ padding: "1rem", backgroundColor: "var(--bg-tertiary)", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <Calendar size={15} />
                      <span>Tarih & Yetkili Bilgileri</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.75rem" }}>Teklif Tarihi</label>
                        <input
                          type="date"
                          className="form-control"
                          value={proposalForm.date}
                          onChange={(e) => setProposalForm({ ...proposalForm, date: e.target.value })}
                          required
                          style={{ fontSize: "0.85rem" }}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.75rem" }}>Son Geçerlilik</label>
                        <input
                          type="date"
                          className="form-control"
                          value={proposalForm.validUntil}
                          onChange={(e) => setProposalForm({ ...proposalForm, validUntil: e.target.value })}
                          required
                          style={{ fontSize: "0.85rem" }}
                        />
                      </div>
                    </div>

                    {/* Hızlı Gün Butonları */}
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Hızlı Geçerlilik:</span>
                      <button type="button" className="btn btn-secondary btn-sm" style={{ padding: "0.15rem 0.4rem", fontSize: "0.7rem" }} onClick={() => handleSetValidityDays(7)}>
                        +7 Gün
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" style={{ padding: "0.15rem 0.4rem", fontSize: "0.7rem" }} onClick={() => handleSetValidityDays(15)}>
                        +15 Gün
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" style={{ padding: "0.15rem 0.4rem", fontSize: "0.7rem" }} onClick={() => handleSetValidityDays(30)}>
                        +30 Gün
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.2rem" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.75rem" }}>Yetkili Satışçı</label>
                        <input
                          type="text"
                          className="form-control"
                          value={user.displayName || "Abdullah Mete"}
                          readOnly
                          disabled
                          style={{ fontSize: "0.85rem", backgroundColor: "var(--bg-secondary)" }}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.75rem" }}>Yetkili İletişim Tel</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="0543 834 87 68"
                          value={proposalForm.salespersonPhone}
                          onChange={(e) => setProposalForm({ ...proposalForm, salespersonPhone: e.target.value })}
                          style={{ fontSize: "0.85rem" }}
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Teklif Durumu</label>
                      <select
                        className="form-control"
                        value={proposalForm.status}
                        onChange={(e) => setProposalForm({ ...proposalForm, status: e.target.value as ProposalStatus })}
                        style={{ fontSize: "0.85rem" }}
                      >
                        <option value="sent">Gönderildi</option>
                        <option value="draft">Taslak</option>
                        <option value="accepted">Kabul Edildi</option>
                        <option value="rejected">Reddedildi</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Kısım: Kalemler Tablosu */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <Layers size={16} className="text-primary" />
                      <span>Ürün / Hizmet Kalemleri</span>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleAddItem}
                      style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.3rem" }}
                    >
                      <Plus size={14} />
                      <span>+ Kalem Satırı Ekle</span>
                    </button>
                  </div>

                  <div className="table-container" style={{ border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)" }}>
                    <table className="table" style={{ fontSize: "0.85rem" }}>
                      <thead style={{ backgroundColor: "var(--bg-tertiary)" }}>
                        <tr>
                          <th style={{ width: "35px", textAlign: "center" }}>#</th>
                          <th style={{ minWidth: "160px" }}>Stoktan Seç (Opsiyonel)</th>
                          <th style={{ minWidth: "200px" }}>Ürün / Hizmet Açıklaması *</th>
                          <th style={{ width: "90px", textAlign: "center" }}>Miktar *</th>
                          <th style={{ width: "95px" }}>Birim</th>
                          <th style={{ width: "115px", textAlign: "right" }}>B. Fiyat (₺) *</th>
                          <th style={{ width: "115px", textAlign: "right" }}>Toplam (₺)</th>
                          <th style={{ width: "40px" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {proposalForm.items.map((item, idx) => (
                          <tr key={item.id || idx}>
                            <td style={{ textAlign: "center", fontWeight: 600, color: "var(--text-muted)" }}>{idx + 1}</td>
                            <td>
                              <select
                                className="form-control"
                                style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }}
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
                                placeholder="Örn: 20 LİK BİMS 11 PALET veya NAKLİYE"
                                value={item.description}
                                onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                                required
                                style={{ fontSize: "0.85rem", padding: "0.25rem 0.5rem" }}
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
                                style={{ fontSize: "0.85rem", textAlign: "center", padding: "0.25rem 0.4rem" }}
                              />
                            </td>
                            <td>
                              <select
                                className="form-control"
                                value={item.unit || "ADET"}
                                onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                                style={{ fontSize: "0.8rem", padding: "0.25rem 0.4rem" }}
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
                                style={{ fontSize: "0.85rem", textAlign: "right", padding: "0.25rem 0.5rem" }}
                              />
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 700 }}>
                              {formatCurrency(item.total || item.quantity * item.price)}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                style={{ color: "var(--danger)", background: "none", border: "none", cursor: "pointer", padding: "0.25rem" }}
                                title="Satırı Sil"
                              >
                                <Trash2 size={15} />
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
                  {/* Sol: Notlar & Şartlar */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                      Notlar & Satış Şartları (PDF Altında Gözükür)
                    </label>
                    <textarea
                      className="form-control"
                      rows={4}
                      value={proposalForm.termsAndConditions}
                      onChange={(e) => setProposalForm({ ...proposalForm, termsAndConditions: e.target.value })}
                      style={{ fontSize: "0.8rem", resize: "vertical" }}
                      placeholder="Teslimat yeri, nakliye durumu, ödeme şartları..."
                    />
                  </div>

                  {/* Sağ: Finansal Özet Kartı */}
                  <div className="card" style={{ padding: "1rem", backgroundColor: "var(--bg-tertiary)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Ara Toplam:</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(subtotal)}</span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem" }}>
                      <span style={{ color: "var(--text-secondary)" }}>İskonto / İndirim:</span>
                      <input
                        type="number"
                        min="0"
                        className="form-control"
                        style={{ width: "100px", padding: "0.2rem 0.4rem", textAlign: "right", fontSize: "0.85rem" }}
                        value={proposalForm.discountAmount}
                        onChange={(e) => setProposalForm({ ...proposalForm, discountAmount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Hesaplanan KDV (%20):</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(taxAmount)}</span>
                    </div>

                    <div style={{ borderTop: "2px solid var(--border-color)", paddingTop: "0.5rem", marginTop: "0.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 800, fontSize: "1rem" }}>GENEL TOPLAM:</span>
                      <span style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--primary)" }}>
                        {formatCurrency(totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="modal-footer" style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  İptal
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <CheckCircle2 size={16} />
                  <span>{submitting ? "Kaydediliyor..." : modalMode === "add" ? "Teklifi Oluştur & Kaydet" : "Teklifi Güncelle"}</span>
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
