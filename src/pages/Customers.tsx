import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  getSales,
  getSalesByCustomer,
  getPaymentsByCustomer,
  addPayment,
  getCompanyProfile
} from "../services/db";
import { generateInvoicePDF } from "../utils/generateInvoicePDF";
import { generatePaymentPDF } from "../utils/generatePaymentPDF";
import { generateStatementPDF } from "../utils/generateStatementPDF";
import { PAYMENT_METHOD_LABELS } from "../utils/salesMath";
import { formatCurrency, formatDate } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Modal from "../components/Modal";
import EmptyState from "../components/EmptyState";
import {
  UserPlus,
  Search,
  Phone,
  Mail,
  Building2,
  Hash,
  History,
  Download,
  MoreVertical,
  Edit,
  Trash2,
  LayoutGrid,
  List,
  Percent,
  RotateCcw,
  Wallet,
  Receipt,
  FileSpreadsheet,
  FileText,
  CreditCard,
  Banknote,
  Calendar,
  User,
  MapPin,
  ShoppingCart,
  Info
} from "lucide-react";
import * as XLSX from "xlsx";
import type { Customer, Sale, Payment, PaymentMethod, CompanyProfile } from "../types";

type CustomerForm = Omit<Customer, "id" | "createdAt">;
type SortKey = "name" | "revenue" | "recent" | "balance";
type ViewMode = "grid" | "list";
type CustomerDetailTab = "info" | "sales" | "statement";

interface CustomerStats {
  lastOrderDate: string | null;
  totalRevenue: number;
  orderCount: number;
}

interface PaymentFormData {
  amount: number;
  paymentMethod: PaymentMethod;
  date: string;
  notes: string;
  checkNumber: string;
  dueDate: string;
}

const emptyForm: CustomerForm = {
  name: "",
  company: "",
  phone: "",
  email: "",
  taxOffice: "",
  taxNumber: "",
  address: "",
  defaultDiscountRate: 0,
  currentBalance: 0
};

const emptyPaymentForm: PaymentFormData = {
  amount: 0,
  paymentMethod: "cash",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
  checkNumber: "",
  dueDate: ""
};

const statusLabel = (s: string) => (s === "approved" ? "Onaylandı" : s === "rejected" ? "Reddedildi" : "Bekliyor");
const statusBadge = (s: string) => (s === "approved" ? "success" : s === "rejected" ? "danger" : "warning");

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
  return new Date(dateStr).toLocaleDateString("tr-TR");
};

const Customers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Müşteri Ekle / Düzenle Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [submitting, setSubmitting] = useState(false);

  // Müşteri Detay & Ekstre Modal
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [historyTab, setHistoryTab] = useState<CustomerDetailTab>("info");
  const [historySales, setHistorySales] = useState<Sale[]>([]);
  const [historyPayments, setHistoryPayments] = useState<Payment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [statementStartDate, setStatementStartDate] = useState("");
  const [statementEndDate, setStatementEndDate] = useState("");

  // Tahsilat Ekle Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentFormData>(emptyPaymentForm);
  const [paymentErrors, setPaymentErrors] = useState<Record<string, string | null>>({});
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [lastCreatedPayment, setLastCreatedPayment] = useState<Payment | null>(null);

  const fetchCustomers = useCallback(async () => {
    try {
      const [customerData, salesData, profile] = await Promise.all([
        getCustomers(),
        user ? getSales(user.role, user.uid) : Promise.resolve([] as Sale[]),
        getCompanyProfile().catch(() => null)
      ]);
      setCustomers(customerData);
      setSales(salesData);
      setCompanyProfile(profile);
    } catch {
      showToast("Müşteriler yüklenemedi.", "error");
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Her müşteri için satış istatistikleri
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

  const filtered = customers.filter(
    (c) =>
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
      if (sortBy === "balance") {
        return (b.currentBalance || 0) - (a.currentBalance || 0);
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
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) e.email = "Geçersiz e-posta formatı.";
    if (form.taxNumber && !/^\d{10}$/.test(form.taxNumber)) e.taxNumber = "Vergi numarası 10 haneli olmalıdır.";
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
      name: c.name,
      company: c.company,
      phone: c.phone || "",
      email: c.email || "",
      taxOffice: c.taxOffice || "",
      taxNumber: c.taxNumber || "",
      address: c.address || "",
      defaultDiscountRate: c.defaultDiscountRate || 0,
      currentBalance: c.currentBalance || 0
    });
    setErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleRepeatSale = (sale: Sale) => {
    sessionStorage.setItem("repeat_sale_template", JSON.stringify(sale));
    showToast(`"${sale.receiptNo}" numaralı satış yeni sipariş sepetine aktarılıyor...`, "info");
    navigate("/sales");
  };

  const handleStartNewSale = (c: Customer) => {
    sessionStorage.setItem("preselected_customer_id", c.id);
    showToast(`"${c.company || c.name}" seçilerek satış ekranına yönlendiriliyorsunuz...`, "info");
    navigate("/sales");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
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
        if (historyCustomer && historyCustomer.id === c.id) {
          handleCloseHistory();
        }
        fetchCustomers();
      } catch (err: any) {
        showToast("Müşteri silinirken hata: " + err.message, "error");
      }
    }
  };

  // --- TAHSİLAT EKLE İŞLEMLERİ ---
  const handleOpenPayment = (customer: Customer) => {
    setOpenMenuId(null);
    setPaymentCustomer(customer);
    setPaymentForm({
      ...emptyPaymentForm,
      date: new Date().toISOString().slice(0, 10)
    });
    setPaymentErrors({});
    setLastCreatedPayment(null);
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomer || !user) return;

    const errs: Record<string, string> = {};
    if (!paymentForm.amount || paymentForm.amount <= 0) {
      errs.amount = "Lütfen geçerli bir tahsilat tutarı girin.";
    }
    if (paymentForm.paymentMethod === "check" && !paymentForm.checkNumber.trim()) {
      errs.checkNumber = "Çek/Senet numarası zorunludur.";
    }

    if (Object.keys(errs).length > 0) {
      setPaymentErrors(errs);
      return;
    }

    setPaymentSubmitting(true);
    try {
      const paymentData = {
        customerId: paymentCustomer.id,
        customerName: paymentCustomer.name,
        customerCompany: paymentCustomer.company,
        amount: paymentForm.amount,
        paymentMethod: paymentForm.paymentMethod,
        date: paymentForm.date ? new Date(paymentForm.date).toISOString() : new Date().toISOString(),
        notes: paymentForm.notes,
        checkNumber: paymentForm.checkNumber,
        dueDate: paymentForm.dueDate
      };

      const created = await addPayment(paymentData, user.uid, user.displayName, user.role);
      setLastCreatedPayment(created);
      showToast(`${formatCurrency(created.amount)} tahsilat kaydedildi (${created.receiptNo}).`, "success");

      fetchCustomers();

      // Eğer ekstre/detay modalı açıksa onun da ödemelerini yenile
      if (historyCustomer && historyCustomer.id === paymentCustomer.id) {
        const pList = await getPaymentsByCustomer(historyCustomer.id);
        setHistoryPayments(pList);
        // Müşteri güncel bakiyesini yenile
        const updatedCusts = await getCustomers();
        const updated = updatedCusts.find((c) => c.id === historyCustomer.id);
        if (updated) setHistoryCustomer(updated);
      }
    } catch (err: any) {
      showToast("Tahsilat kaydedilirken hata: " + err.message, "error");
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // --- MÜŞTERİ GEÇMİŞİ & CARİ EKSTRE ---
  const handleOpenHistory = async (customer: Customer, initialTab: CustomerDetailTab = "info") => {
    setOpenMenuId(null);
    setHistoryCustomer(customer);
    setHistoryTab(initialTab);
    setHistorySales([]);
    setHistoryPayments([]);
    setHistoryLoading(true);
    setStatementStartDate("");
    setStatementEndDate("");
    try {
      const [salesData, paymentsData] = await Promise.all([
        getSalesByCustomer(customer.id, user?.role, user?.uid),
        getPaymentsByCustomer(customer.id)
      ]);
      setHistorySales(salesData);
      setHistoryPayments(paymentsData);
    } catch (err: any) {
      showToast("Geçmiş hareketler yüklenemedi: " + err.message, "error");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCloseHistory = () => {
    setHistoryCustomer(null);
    setHistorySales([]);
    setHistoryPayments([]);
  };

  // Cari Ekstre Hareketlerini Hesaplama (Kronolojik - Eskiden Yeniye)
  const statementEvents = useMemo(() => {
    if (!historyCustomer) return [];

    const approvedSales = historySales.filter((s) => s.status === "approved");
    const events: {
      id: string;
      date: string;
      receiptNo: string;
      type: "sale" | "payment";
      description: string;
      debit: number;
      credit: number;
      rawObj: Sale | Payment;
    }[] = [];

    for (const s of approvedSales) {
      events.push({
        id: s.id,
        date: s.date,
        receiptNo: s.receiptNo,
        type: "sale",
        description: s.paymentMethod ? PAYMENT_METHOD_LABELS[s.paymentMethod] || "Satış" : "Satış Faturası",
        debit: s.netAmount || 0,
        credit: 0,
        rawObj: s
      });
    }

    for (const p of historyPayments) {
      events.push({
        id: p.id,
        date: p.date,
        receiptNo: p.receiptNo,
        type: "payment",
        description: `Tahsilat (${PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}) ${p.notes ? ` - ${p.notes}` : ""}`,
        debit: 0,
        credit: p.amount || 0,
        rawObj: p
      });
    }

    // Tarihe göre sırala (Eskiden yeniye)
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Tarih filtreleri uygula
    const filteredEvents = events.filter((ev) => {
      const d = new Date(ev.date);
      if (statementStartDate && d < new Date(`${statementStartDate}T00:00:00`)) return false;
      if (statementEndDate && d > new Date(`${statementEndDate}T23:59:59`)) return false;
      return true;
    });

    let running = 0;
    return filteredEvents.map((ev) => {
      running += ev.debit - ev.credit;
      return {
        ...ev,
        runningBalance: running
      };
    });
  }, [historyCustomer, historySales, historyPayments, statementStartDate, statementEndDate]);

  const statementTotals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    for (const ev of statementEvents) {
      totalDebit += ev.debit;
      totalCredit += ev.credit;
    }
    const finalBalance = totalDebit - totalCredit;
    return { totalDebit, totalCredit, finalBalance };
  }, [statementEvents]);

  // Excel'e Ekstre İndirme
  const handleExportStatementExcel = () => {
    if (!historyCustomer) return;
    const dataRows = statementEvents.map((ev) => ({
      "Tarih": formatDate(ev.date),
      "Belge No": ev.receiptNo,
      "İşlem": ev.type === "sale" ? "Satış" : "Tahsilat",
      "Açıklama / Yöntem": ev.description,
      "Borç (TL)": ev.debit > 0 ? ev.debit : 0,
      "Alacak (TL)": ev.credit > 0 ? ev.credit : 0,
      "Bakiye (TL)": ev.runningBalance
    }));

    // Özet Satırı Ekle
    dataRows.push({
      "Tarih": "GENEL TOPLAM",
      "Belge No": "",
      "İşlem": "",
      "Açıklama / Yöntem": "",
      "Borç (TL)": statementTotals.totalDebit,
      "Alacak (TL)": statementTotals.totalCredit,
      "Bakiye (TL)": statementTotals.finalBalance
    });

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cari Ekstre");
    XLSX.writeFile(workbook, `Cari_Ekstre_${historyCustomer.company || historyCustomer.name}.xlsx`);
    showToast("Cari ekstre Excel olarak indirildi.", "success");
  };

  const historyStats = historyCustomer
    ? (() => {
        const approved = historySales.filter((s) => s.status === "approved");
        const totalRevenue = approved.reduce((s, sale) => s + (sale.netAmount || 0), 0);
        const totalTax = approved.reduce((s, sale) => s + (sale.taxAmount || 0), 0);
        return { totalRevenue, totalTax, approvedCount: approved.length, totalCount: historySales.length };
      })()
    : null;

  const renderActionsMenu = (c: Customer) => (
    <div style={{ position: "relative", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpenMenuId(openMenuId === c.id ? null : c.id);
        }}
        aria-label="Diğer işlemler"
        style={{
          cursor: "pointer",
          color: "var(--text-secondary)",
          padding: "0.35rem",
          borderRadius: "var(--radius-sm)",
          display: "flex",
          alignItems: "center"
        }}
      >
        <MoreVertical size={16} />
      </button>
      {openMenuId === c.id && (
        <>
          <div
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenuId(null);
            }}
            style={{ position: "fixed", inset: 0, zIndex: 199, background: "transparent" }}
          />
          <div
            className="card animate-slide-up"
            style={{
              position: "absolute",
              right: 0,
              top: "100%",
              marginTop: "0.25rem",
              zIndex: 200,
              padding: "0.35rem",
              minWidth: "175px",
              boxShadow: "var(--shadow-lg)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => handleStartNewSale(c)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.55rem 0.65rem",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.85rem",
                cursor: "pointer",
                color: "var(--primary)",
                fontWeight: 600
              }}
            >
              <ShoppingCart size={15} /> Satış Yap
            </button>
            <button
              type="button"
              onClick={() => handleOpenPayment(c)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.55rem 0.65rem",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.85rem",
                cursor: "pointer",
                color: "var(--success)",
                fontWeight: 600
              }}
            >
              <Wallet size={15} /> Tahsilat Al
            </button>
            <button
              type="button"
              onClick={() => handleOpenHistory(c, "statement")}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.55rem 0.65rem",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.85rem",
                cursor: "pointer"
              }}
            >
              <FileText size={15} /> Cari Ekstre
            </button>
            <button
              type="button"
              onClick={() => handleOpenEdit(c)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.55rem 0.65rem",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.85rem",
                cursor: "pointer"
              }}
            >
              <Edit size={15} /> Düzenle
            </button>
            <button
              type="button"
              onClick={() => handleDelete(c)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.55rem 0.65rem",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.85rem",
                cursor: "pointer",
                color: "var(--danger)"
              }}
            >
              <Trash2 size={15} /> Sil
            </button>
          </div>
        </>
      )}
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade">
        <section className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="skeleton" style={{ width: "160px", height: "24px" }} />
          <div className="skeleton" style={{ width: "140px", height: "36px" }} />
        </section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.25rem" }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "1.25rem" }}>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <div className="skeleton" style={{ width: "42px", height: "42px", borderRadius: "50%" }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <div className="skeleton" style={{ width: "70%", height: "16px" }} />
                  <div className="skeleton" style={{ width: "50%", height: "14px" }} />
                </div>
              </div>
              <div className="skeleton" style={{ width: "100%", height: "14px" }} />
              <div className="skeleton" style={{ width: "80%", height: "14px" }} />
              <div className="skeleton" style={{ width: "100%", height: "40px", borderRadius: "6px" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade">
      {/* Üst Başlık & Aksiyon */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Müşteri & Cari Hesap Yönetimi</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Toplam {customers.length} müşteri kayıtlı — Detaylar için müşteri kartına tıklayabilirsiniz
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <UserPlus size={18} /> <span>Yeni Müşteri</span>
        </button>
      </div>

      {/* Arama, Sıralama & Görünüm Seçici */}
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
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="form-control"
          style={{ width: "190px" }}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
        >
          <option value="name">İsme göre</option>
          <option value="balance">Borç Bakiyesine göre</option>
          <option value="revenue">Ciroya göre</option>
          <option value="recent">Son işleme göre</option>
        </select>

        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            aria-label="Kart görünümü"
            style={{
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-color)",
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
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-color)",
              backgroundColor: viewMode === "list" ? "var(--bg-tertiary)" : "transparent",
              color: viewMode === "list" ? "var(--primary)" : "var(--text-secondary)"
            }}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* MÜŞTERİ LİSTESİ (KART & TABLO) */}
      {sortedCustomers.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
          {searchQuery ? "Aramanızla eşleşen müşteri bulunamadı." : "Henüz müşteri kaydı yok. Yeni müşteri ekleyebilirsiniz."}
        </div>
      ) : viewMode === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.25rem" }}>
          {sortedCustomers.map((c) => {
            const stats = customerStats[c.id];
            const balance = c.currentBalance || 0;
            return (
              <div
                key={c.id}
                className="card"
                onClick={() => handleOpenHistory(c, "info")}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                  padding: "1.25rem",
                  cursor: "pointer",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.boxShadow = "var(--shadow-md)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-color)";
                  e.currentTarget.style.boxShadow = "none";
                }}
                title="Müşteri profilini, siparişlerini ve cari dökümünü görmek için tıklayın"
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "50%",
                      flexShrink: 0,
                      backgroundColor: "var(--primary-light)",
                      color: "var(--primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: "0.9rem"
                    }}
                  >
                    {getInitials(c.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>{c.name}</div>
                      {c.defaultDiscountRate && c.defaultDiscountRate > 0 ? (
                        <span className="badge badge-primary" style={{ fontSize: "0.72rem", fontWeight: 700, padding: "2px 8px" }}>
                          %{c.defaultDiscountRate} İskonto
                        </span>
                      ) : null}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        color: "var(--primary)",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        marginTop: "0.15rem"
                      }}
                    >
                      <Building2 size={14} style={{ flexShrink: 0 }} />{" "}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.company}</span>
                    </div>
                  </div>
                  {renderActionsMenu(c)}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.85rem" }}>
                  {c.phone && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)" }}>
                      <Phone size={14} /> {c.phone}
                    </div>
                  )}
                  {c.email && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        color: "var(--text-secondary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                    >
                      <Mail size={14} /> {c.email}
                    </div>
                  )}
                  {c.taxNumber && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                      <Hash size={14} /> VN: {c.taxNumber} {c.taxOffice && `/ ${c.taxOffice} V.D.`}
                    </div>
                  )}
                </div>

                {/* Cari Bakiye & Toplam Ciro Kutucukları */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                  <div
                    style={{
                      backgroundColor: balance > 0 ? "rgba(239, 68, 68, 0.08)" : balance < 0 ? "rgba(16, 185, 129, 0.08)" : "var(--bg-tertiary)",
                      border: `1px solid ${balance > 0 ? "rgba(239, 68, 68, 0.2)" : balance < 0 ? "rgba(16, 185, 129, 0.2)" : "var(--border-color)"}`,
                      borderRadius: "var(--radius-sm)",
                      padding: "0.55rem 0.75rem"
                    }}
                  >
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>Cari Bakiye</div>
                    <div
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 800,
                        color: balance > 0 ? "var(--danger)" : balance < 0 ? "var(--success)" : "var(--text-primary)",
                        marginTop: "0.15rem"
                      }}
                    >
                      {formatCurrency(balance)}
                      <span style={{ fontSize: "0.7rem", fontWeight: 500, marginLeft: "0.25rem" }}>
                        {balance > 0 ? "(Borçlu)" : balance < 0 ? "(Alacaklı)" : ""}
                      </span>
                    </div>
                  </div>

                  <div style={{ backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", padding: "0.55rem 0.75rem", border: "1px solid var(--border-color)" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>Toplam Ciro</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--primary)", marginTop: "0.15rem" }}>
                      {formatCurrency(stats?.totalRevenue ?? 0)}
                    </div>
                  </div>
                </div>

                {/* Hızlı Aksiyonlar */}
                <div
                  style={{ display: "flex", gap: "0.6rem", borderTop: "1px solid var(--border-color)", paddingTop: "0.75rem", marginTop: "0.2rem" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1, fontSize: "0.82rem", gap: "0.3rem", padding: "0.4rem 0.6rem" }}
                    onClick={() => handleOpenHistory(c, "info")}
                  >
                    <Info size={14} /> <span>Detay / Profil</span>
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1, fontSize: "0.82rem", gap: "0.3rem", padding: "0.4rem 0.6rem" }}
                    onClick={() => handleOpenPayment(c)}
                  >
                    <Wallet size={14} /> <span>Tahsilat Al</span>
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
                <th>Müşteri / Firma</th>
                <th>Telefon</th>
                <th>Sabit İskonto</th>
                <th style={{ textAlign: "right" }}>Cari Bakiye</th>
                <th style={{ textAlign: "right" }}>Toplam Ciro</th>
                <th style={{ textAlign: "center" }}>Son Sipariş</th>
                <th style={{ width: "160px", textAlign: "center" }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {sortedCustomers.map((c) => {
                const stats = customerStats[c.id];
                const balance = c.currentBalance || 0;
                return (
                  <tr
                    key={c.id}
                    onClick={() => handleOpenHistory(c, "info")}
                    style={{ cursor: "pointer" }}
                    title="Müşteri profilini görmek için tıklayın"
                  >
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            flexShrink: 0,
                            backgroundColor: "var(--primary-light)",
                            color: "var(--primary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: "0.75rem"
                          }}
                        >
                          {getInitials(c.name)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>{c.name}</div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--primary)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: "220px"
                            }}
                          >
                            {c.company}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{c.phone || "—"}</td>
                    <td>
                      {c.defaultDiscountRate && c.defaultDiscountRate > 0 ? (
                        <span className="badge badge-primary" style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                          %{c.defaultDiscountRate}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 800 }}>
                      <span
                        className={`badge badge-${balance > 0 ? "danger" : balance < 0 ? "success" : "secondary"}`}
                        style={{ fontSize: "0.75rem" }}
                      >
                        {formatCurrency(balance)} {balance > 0 ? "(Borç)" : balance < 0 ? "(Alacak)" : ""}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "var(--primary)" }}>
                      {formatCurrency(stats?.totalRevenue ?? 0)}
                    </td>
                    <td style={{ textAlign: "center" }}>{formatRelativeDate(stats?.lastOrderDate ?? null)}</td>
                    <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", justifyContent: "center" }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "0.25rem 0.45rem", fontSize: "0.75rem", gap: "0.2rem" }}
                          onClick={() => handleOpenPayment(c)}
                          title="Tahsilat Al"
                        >
                          <Wallet size={12} />
                          <span>Tahsilat</span>
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "0.25rem 0.45rem", fontSize: "0.75rem", gap: "0.2rem" }}
                          onClick={() => handleOpenHistory(c, "info")}
                          title="Profil & Detay"
                        >
                          <Info size={12} />
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

      {/* MÜŞTERİ EKLE / DÜZENLE MODALI */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        maxWidth="620px"
        title={editingId ? "Müşteri Bilgilerini Düzenle" : "Yeni Müşteri Ekle"}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={handleCloseModal} disabled={submitting}>
              İptal
            </button>
            <button type="submit" form="customer-form" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Kaydediliyor..." : editingId ? "Güncelle" : "Kaydet"}
            </button>
          </>
        }
      >
        <form id="customer-form" onSubmit={handleSubmit} className="modal-body">
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
              <div className="form-group">
                <label className="form-label">Yetkili Adı Soyadı *</label>
                <input
                  className={`form-control ${errors.name ? "is-invalid" : ""}`}
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    setErrors({ ...errors, name: null });
                  }}
                  placeholder="Ahmet Yılmaz"
                />
                {errors.name && <div className="invalid-feedback">{errors.name}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Firma Unvanı *</label>
                <input
                  className={`form-control ${errors.company ? "is-invalid" : ""}`}
                  value={form.company}
                  onChange={(e) => {
                    setForm({ ...form, company: e.target.value });
                    setErrors({ ...errors, company: null });
                  }}
                  placeholder="Yılmaz Ltd. Şti."
                />
                {errors.company && <div className="invalid-feedback">{errors.company}</div>}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
              <div className="form-group">
                <label className="form-label">Telefon</label>
                <input
                  className={`form-control ${errors.phone ? "is-invalid" : ""}`}
                  value={form.phone}
                  onChange={(e) => {
                    setForm({ ...form, phone: e.target.value });
                    setErrors({ ...errors, phone: null });
                  }}
                  placeholder="05xx xxx xx xx"
                />
                {errors.phone && <div className="invalid-feedback">{errors.phone}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">E-posta</label>
                <input
                  className={`form-control ${errors.email ? "is-invalid" : ""}`}
                  value={form.email}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value });
                    setErrors({ ...errors, email: null });
                  }}
                  placeholder="ornek@firma.com"
                />
                {errors.email && <div className="invalid-feedback">{errors.email}</div>}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
              <div className="form-group">
                <label className="form-label">Vergi Dairesi</label>
                <input
                  className="form-control"
                  value={form.taxOffice}
                  onChange={(e) => setForm({ ...form, taxOffice: e.target.value })}
                  placeholder="Maslak"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Vergi Numarası</label>
                <input
                  className={`form-control ${errors.taxNumber ? "is-invalid" : ""}`}
                  value={form.taxNumber}
                  onChange={(e) => {
                    setForm({ ...form, taxNumber: e.target.value });
                    setErrors({ ...errors, taxNumber: null });
                  }}
                  placeholder="1234567890"
                  maxLength={10}
                />
                {errors.taxNumber && <div className="invalid-feedback">{errors.taxNumber}</div>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <Percent size={14} color="var(--primary)" />
                <span>Sabit Müşteri İskonto Oranı (%)</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                className="form-control"
                value={form.defaultDiscountRate || ""}
                onChange={(e) =>
                  setForm({ ...form, defaultDiscountRate: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })
                }
                placeholder="Örn: 10 (Satışta sepete otomatik %10 indirim uygulanır)"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Adres</label>
              <textarea
                className="form-control"
                rows={2}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Açık adres..."
                style={{ resize: "none" }}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* TAHSİLAT EKLE MODALI (FERAH & GENİŞ TASARIM - 640px) */}
      {showPaymentModal && paymentCustomer && (
        <Modal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          maxWidth="640px"
          title={`Tahsilat Girişi [${paymentCustomer.company || paymentCustomer.name}]`}
          footer={
            <>
              {lastCreatedPayment ? (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowPaymentModal(false);
                      setLastCreatedPayment(null);
                    }}
                  >
                    Kapat
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => generatePaymentPDF(lastCreatedPayment, companyProfile)}
                  >
                    <Download size={14} /> <span>Makbuz PDF İndir</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowPaymentModal(false)}
                    disabled={paymentSubmitting}
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    form="payment-form"
                    className="btn btn-success"
                    disabled={paymentSubmitting}
                    style={{ gap: "0.4rem", padding: "0.55rem 1.25rem", fontSize: "0.92rem", fontWeight: 700 }}
                  >
                    <Wallet size={16} />
                    <span>{paymentSubmitting ? "Kaydediliyor..." : "Tahsilatı Onayla"}</span>
                  </button>
                </>
              )}
            </>
          }
        >
          <div className="modal-body">
            {lastCreatedPayment ? (
              <div style={{ textAlign: "center", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.25rem", alignItems: "center" }}>
                <div style={{ width: "60px", height: "60px", borderRadius: "50%", backgroundColor: "rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--success)" }}>
                  <Receipt size={32} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)" }}>Tahsilat Başarıyla Kaydedildi!</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "0.35rem" }}>
                    Makbuz No: <strong style={{ color: "var(--primary)" }}>{lastCreatedPayment.receiptNo}</strong> | Tutar: <strong style={{ color: "var(--success)" }}>{formatCurrency(lastCreatedPayment.amount)}</strong>
                  </p>
                </div>
                <div style={{ padding: "1rem 1.25rem", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-md)", fontSize: "0.9rem", width: "100%", textAlign: "left", display: "flex", flexDirection: "column", gap: "0.4rem", border: "1px solid var(--border-color)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Müşteri:</span>
                    <strong>{paymentCustomer.company}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Ödeme Şekli:</span>
                    <span className="badge badge-primary">{PAYMENT_METHOD_LABELS[lastCreatedPayment.paymentMethod]}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>İşlem Tarihi:</span>
                    <span>{formatDate(lastCreatedPayment.date)}</span>
                  </div>
                  {lastCreatedPayment.notes && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Açıklama:</span>
                      <span>{lastCreatedPayment.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <form id="payment-form" onSubmit={handlePaymentSubmit}>
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  {/* Ferah Müşteri Bilgi & Güncel Bakiye Banner'ı */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "1rem 1.25rem",
                      backgroundColor: (paymentCustomer.currentBalance || 0) > 0 ? "rgba(239, 68, 68, 0.08)" : "var(--bg-tertiary)",
                      border: `1px solid ${(paymentCustomer.currentBalance || 0) > 0 ? "rgba(239, 68, 68, 0.25)" : "var(--border-color)"}`,
                      borderRadius: "var(--radius-md)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "50%",
                          backgroundColor: "var(--primary-light)",
                          color: "var(--primary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: "0.9rem"
                        }}
                      >
                        {getInitials(paymentCustomer.name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-primary)" }}>{paymentCustomer.company}</div>
                        <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>Yetkili: {paymentCustomer.name}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>Mevcut Cari Borç</div>
                      <div
                        style={{
                          fontSize: "1.2rem",
                          fontWeight: 900,
                          color: (paymentCustomer.currentBalance || 0) > 0 ? "var(--danger)" : "var(--success)"
                        }}
                      >
                        {formatCurrency(paymentCustomer.currentBalance || 0)}
                      </div>
                    </div>
                  </div>

                  {/* Tutar & Ödeme Şekli (Ferah & Yüksek Inputlar) */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: 700, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <Banknote size={16} color="var(--primary)" /> Tahsilat Tutarı (TL) *
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          style={{ height: "46px", fontSize: "1.15rem", fontWeight: 700, paddingLeft: "1rem" }}
                          className={`form-control ${paymentErrors.amount ? "is-invalid" : ""}`}
                          value={paymentForm.amount || ""}
                          onChange={(e) => {
                            setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 });
                            setPaymentErrors({ ...paymentErrors, amount: null });
                          }}
                          placeholder="0.00"
                          autoFocus
                        />
                      </div>
                      {paymentErrors.amount && <div className="invalid-feedback">{paymentErrors.amount}</div>}
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: 700, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <CreditCard size={16} color="var(--primary)" /> Ödeme Şekli
                      </label>
                      <select
                        className="form-control"
                        style={{ height: "46px", fontSize: "0.95rem", fontWeight: 500 }}
                        value={paymentForm.paymentMethod}
                        onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value as PaymentMethod })}
                      >
                        <option value="cash">Nakit (Kasa Girişi)</option>
                        <option value="credit_card">Kredi Kartı / POS</option>
                        <option value="bank_transfer">Banka Havalesi / EFT</option>
                        <option value="check">Çek / Senet</option>
                      </select>
                    </div>
                  </div>

                  {/* Çek Bilgileri (Çek seçilirse) */}
                  {paymentForm.paymentMethod === "check" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", padding: "1rem", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }} className="animate-slide-up">
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.82rem", fontWeight: 600 }}>Çek / Senet No *</label>
                        <input
                          type="text"
                          style={{ height: "42px" }}
                          className={`form-control ${paymentErrors.checkNumber ? "is-invalid" : ""}`}
                          value={paymentForm.checkNumber}
                          onChange={(e) => setPaymentForm({ ...paymentForm, checkNumber: e.target.value })}
                          placeholder="Örn: CK-88992"
                        />
                        {paymentErrors.checkNumber && <div className="invalid-feedback">{paymentErrors.checkNumber}</div>}
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.82rem", fontWeight: 600 }}>Vade Tarihi</label>
                        <input
                          type="date"
                          style={{ height: "42px" }}
                          className="form-control"
                          value={paymentForm.dueDate}
                          onChange={(e) => setPaymentForm({ ...paymentForm, dueDate: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Tarih */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <Calendar size={15} /> İşlem Tarihi
                    </label>
                    <input
                      type="date"
                      style={{ height: "42px" }}
                      className="form-control"
                      value={paymentForm.date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                    />
                  </div>

                  {/* Notlar */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: "0.85rem" }}>Tahsilat Notu / Açıklama</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      placeholder="Dekont no, banka veya tahsilat detayları..."
                      style={{ resize: "none", fontSize: "0.88rem" }}
                    />
                  </div>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}

      {/* MÜŞTERİ DETAY, GEÇMİŞ SATIŞLAR & CARİ HESAP EKSTRESİ MODALI (880px) */}
      {historyCustomer && (
        <Modal
          isOpen={!!historyCustomer}
          onClose={handleCloseHistory}
          maxWidth="880px"
          title={
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    backgroundColor: "var(--primary-light)",
                    color: "var(--primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: "0.85rem"
                  }}
                >
                  {getInitials(historyCustomer.name)}
                </div>
                <div>
                  <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>{historyCustomer.company}</span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-secondary)", marginLeft: "0.5rem" }}>
                    ({historyCustomer.name})
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span
                  className={`badge badge-${(historyCustomer.currentBalance || 0) > 0 ? "danger" : (historyCustomer.currentBalance || 0) < 0 ? "success" : "secondary"}`}
                  style={{ fontSize: "0.85rem", fontWeight: 800, padding: "4px 10px" }}
                >
                  Bakiye: {formatCurrency(historyCustomer.currentBalance || 0)}
                </span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", gap: "0.35rem" }}
                  onClick={() => handleOpenPayment(historyCustomer)}
                >
                  <Wallet size={14} /> <span>Tahsilat Ekle</span>
                </button>
              </div>
            </div>
          }
        >
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Sekme Başlıkları */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className={`btn ${historyTab === "info" ? "btn-primary" : "btn-secondary"}`}
                style={{ borderRadius: "var(--radius-sm) var(--radius-sm) 0 0", borderBottom: "none", fontSize: "0.88rem", gap: "0.4rem", padding: "0.5rem 1rem" }}
                onClick={() => setHistoryTab("info")}
              >
                <User size={15} /> <span>Müşteri Bilgileri & Profil</span>
              </button>
              <button
                type="button"
                className={`btn ${historyTab === "sales" ? "btn-primary" : "btn-secondary"}`}
                style={{ borderRadius: "var(--radius-sm) var(--radius-sm) 0 0", borderBottom: "none", fontSize: "0.88rem", gap: "0.4rem", padding: "0.5rem 1rem" }}
                onClick={() => setHistoryTab("sales")}
              >
                <History size={15} /> <span>Sipariş Geçmişi ({historySales.length})</span>
              </button>
              <button
                type="button"
                className={`btn ${historyTab === "statement" ? "btn-primary" : "btn-secondary"}`}
                style={{ borderRadius: "var(--radius-sm) var(--radius-sm) 0 0", borderBottom: "none", fontSize: "0.88rem", gap: "0.4rem", padding: "0.5rem 1rem" }}
                onClick={() => setHistoryTab("statement")}
              >
                <FileText size={15} /> <span>Cari Hesap Ekstresi (Döküm)</span>
              </button>
            </div>

            {historyLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem 0" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.85rem" }}>
                  <div className="skeleton" style={{ height: "90px", borderRadius: "8px" }} />
                  <div className="skeleton" style={{ height: "90px", borderRadius: "8px" }} />
                  <div className="skeleton" style={{ height: "90px", borderRadius: "8px" }} />
                </div>
                <div className="skeleton" style={{ height: "180px", borderRadius: "8px" }} />
              </div>
            ) : historyTab === "info" ? (
              /* --- SEKME 0: MÜŞTERİ BİLGİLERİ & PROFİL --- */
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {/* Finansal & Aktivite Özet Kartları */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.85rem" }}>
                  <div
                    style={{
                      padding: "1rem",
                      backgroundColor: (historyCustomer.currentBalance || 0) > 0 ? "rgba(239, 68, 68, 0.08)" : (historyCustomer.currentBalance || 0) < 0 ? "rgba(16, 185, 129, 0.08)" : "var(--bg-tertiary)",
                      border: `1px solid ${(historyCustomer.currentBalance || 0) > 0 ? "rgba(239, 68, 68, 0.25)" : (historyCustomer.currentBalance || 0) < 0 ? "rgba(16, 185, 129, 0.25)" : "var(--border-color)"}`,
                      borderRadius: "var(--radius-md)"
                    }}
                  >
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Cari Borç / Bakiye</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 800, color: (historyCustomer.currentBalance || 0) > 0 ? "var(--danger)" : (historyCustomer.currentBalance || 0) < 0 ? "var(--success)" : "var(--text-primary)", marginTop: "0.25rem" }}>
                      {formatCurrency(historyCustomer.currentBalance || 0)}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                      {(historyCustomer.currentBalance || 0) > 0 ? "Ödeme bekleniyor" : (historyCustomer.currentBalance || 0) < 0 ? "Alacaklı bakiye" : "Bakiye sıfır"}
                    </div>
                  </div>

                  <div style={{ padding: "1rem", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Toplam Alışveriş Cirosu</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--primary)", marginTop: "0.25rem" }}>
                      {formatCurrency(historyStats?.totalRevenue ?? 0)}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                      {historyStats?.approvedCount ?? 0} onaylı satış fişi
                    </div>
                  </div>

                  <div style={{ padding: "1rem", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Son Sipariş Tarihi</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.35rem" }}>
                      {formatRelativeDate(customerStats[historyCustomer.id]?.lastOrderDate ?? null)}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                      {customerStats[historyCustomer.id]?.lastOrderDate ? formatDate(customerStats[historyCustomer.id].lastOrderDate!) : "Kayıtlı satış yok"}
                    </div>
                  </div>
                </div>

                {/* Detaylı Müşteri & İletişim Bilgi Kutusu */}
                <div style={{ padding: "1.25rem", backgroundColor: "var(--bg-secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.75rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Building2 size={18} color="var(--primary)" />
                      <span>Firma & İletişim Detayları</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.8rem", gap: "0.35rem" }}
                      onClick={() => {
                        handleCloseHistory();
                        handleOpenEdit(historyCustomer);
                      }}
                    >
                      <Edit size={13} /> <span>Bilgileri Düzenle</span>
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", fontSize: "0.88rem" }}>
                    <div>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 600 }}>Yetkili Kişi</div>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)", marginTop: "0.2rem" }}>{historyCustomer.name}</div>
                    </div>

                    <div>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 600 }}>Firma Unvanı</div>
                      <div style={{ fontWeight: 600, color: "var(--primary)", marginTop: "0.2rem" }}>{historyCustomer.company}</div>
                    </div>

                    <div>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 600 }}>Telefon Numarası</div>
                      <div style={{ marginTop: "0.2rem" }}>
                        {historyCustomer.phone ? (
                          <a href={`tel:${historyCustomer.phone}`} style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                            <Phone size={14} /> {historyCustomer.phone}
                          </a>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>Tanımlı değil</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 600 }}>E-Posta Adresi</div>
                      <div style={{ marginTop: "0.2rem" }}>
                        {historyCustomer.email ? (
                          <a href={`mailto:${historyCustomer.email}`} style={{ color: "var(--primary)", fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                            <Mail size={14} /> {historyCustomer.email}
                          </a>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>Tanımlı değil</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 600 }}>Vergi Dairesi / No</div>
                      <div style={{ marginTop: "0.2rem", fontWeight: 600 }}>
                        {historyCustomer.taxNumber ? (
                          <span>{historyCustomer.taxNumber} {historyCustomer.taxOffice ? `(${historyCustomer.taxOffice} V.D.)` : ""}</span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>Tanımlı değil</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 600 }}>Sabit Müşteri İskontosu</div>
                      <div style={{ marginTop: "0.2rem" }}>
                        {historyCustomer.defaultDiscountRate && historyCustomer.defaultDiscountRate > 0 ? (
                          <span className="badge badge-primary" style={{ fontSize: "0.78rem", fontWeight: 700 }}>
                            %{historyCustomer.defaultDiscountRate} Sepet İskontosu
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>Sabit iskonto yok</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {historyCustomer.address && (
                    <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "0.75rem" }}>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <MapPin size={14} /> Açık Adres
                      </div>
                      <div style={{ color: "var(--text-primary)", fontSize: "0.85rem", marginTop: "0.25rem", lineHeight: 1.4 }}>
                        {historyCustomer.address}
                      </div>
                    </div>
                  )}
                </div>

                {/* Hızlı Eylem Butonları */}
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1, minWidth: "180px", gap: "0.4rem", padding: "0.6rem 1rem", fontSize: "0.9rem" }}
                    onClick={() => handleStartNewSale(historyCustomer)}
                  >
                    <ShoppingCart size={16} /> <span>Bu Müşteriye Satış Yap</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-success"
                    style={{ flex: 1, minWidth: "180px", gap: "0.4rem", padding: "0.6rem 1rem", fontSize: "0.9rem" }}
                    onClick={() => handleOpenPayment(historyCustomer)}
                  >
                    <Wallet size={16} /> <span>Tahsilat Girişi Al</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1, minWidth: "180px", gap: "0.4rem", padding: "0.6rem 1rem", fontSize: "0.9rem" }}
                    onClick={() => setHistoryTab("statement")}
                  >
                    <FileText size={16} /> <span>Cari Ekstreye Git</span>
                  </button>
                </div>
              </div>
            ) : historyTab === "sales" ? (
              /* --- SEKME 1: SİPARİŞ GEÇMİŞİ --- */
              <div>
                {historyStats && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.85rem", marginBottom: "1.25rem" }}>
                    <div style={{ textAlign: "center", padding: "0.75rem", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)" }}>
                      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--primary)" }}>{historyStats.totalCount}</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Toplam Satış</div>
                    </div>
                    <div style={{ textAlign: "center", padding: "0.75rem", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)" }}>
                      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--success)" }}>{historyStats.approvedCount}</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Onaylanan</div>
                    </div>
                    <div style={{ textAlign: "center", padding: "0.75rem", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)" }}>
                      <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary)" }}>
                        {formatCurrency(historyStats.totalRevenue)}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Toplam Ciro</div>
                    </div>
                  </div>
                )}

                {historySales.length === 0 ? (
                  <EmptyState
                    icon={History}
                    title="Satış Kaydı Bulunamadı"
                    description="Bu müşteriye ait henüz tamamlanmış veya bekleyen satış kaydı bulunmamaktadır."
                  />
                ) : (
                  <div className="table-container">
                    <table className="table" style={{ fontSize: "0.85rem" }}>
                      <thead>
                        <tr>
                          <th>Fiş No / Tarih</th>
                          <th>Ödeme Şekli</th>
                          <th>Satışçı</th>
                          <th style={{ textAlign: "right" }}>Net Tutar</th>
                          <th style={{ textAlign: "center" }}>Durum</th>
                          <th style={{ width: "130px", textAlign: "center" }}>İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historySales.map((sale) => (
                          <tr key={sale.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{sale.receiptNo}</div>
                              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                {formatDate(sale.date)}
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-secondary" style={{ fontSize: "0.72rem" }}>
                                {PAYMENT_METHOD_LABELS[sale.paymentMethod || "open_account"]}
                              </span>
                            </td>
                            <td style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>{sale.salespersonName}</td>
                            <td style={{ textAlign: "right", fontWeight: 700, color: sale.status === "approved" ? "var(--success)" : "var(--text-primary)" }}>
                              {formatCurrency(sale.netAmount)}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <span className={`badge badge-${statusBadge(sale.status)}`} style={{ fontSize: "0.7rem" }}>
                                {statusLabel(sale.status)}
                              </span>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
                                <button
                                  className="btn btn-secondary btn-icon btn-sm"
                                  onClick={() => generateInvoicePDF(sale, companyProfile)}
                                  title="PDF İndir"
                                  style={{ padding: "0.35rem" }}
                                >
                                  <Download size={14} />
                                </button>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleRepeatSale(sale)}
                                  title="Bu Satışı Tekrarla / Sepete Aktar"
                                  style={{ padding: "0.3rem 0.55rem", fontSize: "0.75rem", gap: "0.25rem" }}
                                >
                                  <RotateCcw size={12} />
                                  <span>Tekrarla</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              /* --- SEKME 2: CARİ HESAP EKSTRESİ --- */
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {/* Tarih Filtresi & Dışa Aktar Çubuğu */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", padding: "0.85rem", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Başlangıç:</span>
                      <input
                        type="date"
                        className="form-control"
                        style={{ width: "140px", padding: "0.25rem 0.45rem", fontSize: "0.8rem" }}
                        value={statementStartDate}
                        onChange={(e) => setStatementStartDate(e.target.value)}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Bitiş:</span>
                      <input
                        type="date"
                        className="form-control"
                        style={{ width: "140px", padding: "0.25rem 0.45rem", fontSize: "0.8rem" }}
                        value={statementEndDate}
                        onChange={(e) => setStatementEndDate(e.target.value)}
                      />
                    </div>
                    {(statementStartDate || statementEndDate) && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                        onClick={() => {
                          setStatementStartDate("");
                          setStatementEndDate("");
                        }}
                      >
                        Temizle
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.8rem", gap: "0.3rem" }}
                      onClick={handleExportStatementExcel}
                    >
                      <FileSpreadsheet size={14} /> <span>Excel İndir</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: "0.8rem", gap: "0.3rem" }}
                      onClick={() =>
                        generateStatementPDF(
                          historyCustomer,
                          historySales,
                          historyPayments,
                          companyProfile,
                          statementStartDate,
                          statementEndDate
                        )
                      }
                    >
                      <Download size={14} /> <span>Ekstre PDF</span>
                    </button>
                  </div>
                </div>

                {/* Ekstre Tablosu */}
                {statementEvents.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="Cari Hareket Bulunamadı"
                    description="Seçilen tarih aralığında onaylı satış veya tahsilat hareketi bulunmamaktadır."
                  />
                ) : (
                  <div className="table-container">
                    <table className="table" style={{ fontSize: "0.82rem" }}>
                      <thead>
                        <tr>
                          <th>Tarih</th>
                          <th>Belge No</th>
                          <th>İşlem</th>
                          <th>Açıklama</th>
                          <th style={{ textAlign: "right" }}>Borç (Satış)</th>
                          <th style={{ textAlign: "right" }}>Alacak (Tahsilat)</th>
                          <th style={{ textAlign: "right" }}>Bakiye</th>
                          <th style={{ width: "40px" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {statementEvents.map((ev) => {
                          const isSale = ev.type === "sale";
                          return (
                            <tr key={ev.id}>
                              <td>{formatDate(ev.date)}</td>
                              <td style={{ fontWeight: 600 }}>{ev.receiptNo}</td>
                              <td>
                                <span
                                  className={`badge badge-${isSale ? "primary" : "success"}`}
                                  style={{ fontSize: "0.7rem" }}
                                >
                                  {isSale ? "Satış" : "Tahsilat"}
                                </span>
                              </td>
                              <td style={{ color: "var(--text-secondary)", maxWidth: "220px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {ev.description}
                              </td>
                              <td style={{ textAlign: "right", fontWeight: 600, color: ev.debit > 0 ? "var(--danger)" : "var(--text-muted)" }}>
                                {ev.debit > 0 ? formatCurrency(ev.debit) : "—"}
                              </td>
                              <td style={{ textAlign: "right", fontWeight: 600, color: ev.credit > 0 ? "var(--success)" : "var(--text-muted)" }}>
                                {ev.credit > 0 ? formatCurrency(ev.credit) : "—"}
                              </td>
                              <td style={{ textAlign: "right", fontWeight: 800, color: ev.runningBalance > 0 ? "var(--danger)" : ev.runningBalance < 0 ? "var(--success)" : "var(--text-primary)" }}>
                                {formatCurrency(ev.runningBalance)}
                              </td>
                              <td style={{ textAlign: "center" }}>
                                {!isSale && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-icon btn-sm"
                                    style={{ padding: "0.25rem" }}
                                    title="Makbuz İndir"
                                    onClick={() => generatePaymentPDF(ev.rawObj as Payment, companyProfile)}
                                  >
                                    <Receipt size={13} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Ekstre Özet Kartı */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div
                    style={{
                      width: "320px",
                      padding: "1rem 1.25rem",
                      backgroundColor: "var(--bg-tertiary)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-color)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.4rem",
                      fontSize: "0.88rem"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Toplam Borç (Satışlar):</span>
                      <strong style={{ color: "var(--danger)" }}>{formatCurrency(statementTotals.totalDebit)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Toplam Alacak (Tahsilat):</span>
                      <strong style={{ color: "var(--success)" }}>{formatCurrency(statementTotals.totalCredit)}</strong>
                    </div>
                    <div style={{ borderTop: "1px solid var(--border-color)", marginTop: "0.35rem", paddingTop: "0.45rem", display: "flex", justifyContent: "space-between", fontSize: "0.98rem" }}>
                      <span style={{ fontWeight: 700 }}>Dönem Sonu Net Bakiye:</span>
                      <strong style={{ color: statementTotals.finalBalance > 0 ? "var(--danger)" : statementTotals.finalBalance < 0 ? "var(--success)" : "var(--text-primary)" }}>
                        {formatCurrency(statementTotals.finalBalance)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Customers;
