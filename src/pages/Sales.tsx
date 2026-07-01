// Takip Sistemi - Satışçı Modülü (Sales)
import React, { useState, useEffect, useRef, useCallback } from "react";
import { getCustomers, getProducts, addSale, addCustomer, getSales, resubmitSale, getCompanyProfile } from "../services/db";
import { generateInvoicePDF } from "../utils/generateInvoicePDF";
import { computeSaleTotals } from "../utils/salesMath";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import BarcodeScanner from "../components/BarcodeScanner";
import type { Customer, Product, Sale, SaleItem, CompanyProfile } from "../types";
import {
  Plus,
  Trash2,
  Search,
  UserPlus,
  Printer,
  FileText,
  AlertCircle,
  ScanLine,
  RefreshCw,
  Edit3,
  Download
} from "lucide-react";

// Çevrimdışı ve Güvenli HTML5 Canvas Tabanlı Code 39 Barkod Bileşeni
const Barcode = ({ text }: { text: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!text || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // CODE39 patterns
    const patterns: Record<string, string> = {
      '0': 'NnNwWnWnN', '1': 'WnNwNnNnW', '2': 'NnWwNnNnW', '3': 'WnWwNnNnN',
      '4': 'NnNwWnNnW', '5': 'WnNwWnNnN', '6': 'NnWwWnNnN', '7': 'NnNwNnWnW',
      '8': 'WnNwNnWnN', '9': 'NnWwNnWnN', 'A': 'WnNnNwNnW', 'B': 'NnWnNwNnW',
      'C': 'WnWnNwNnN', 'D': 'NnNnWwNnW', 'E': 'WnNnWwNnN', 'F': 'NnWnWwNnN',
      'G': 'NnNnNwWnW', 'H': 'WnNnNwWnN', 'I': 'NnWnNwWnN', 'J': 'NnNnWwWnN',
      'K': 'WnNnNnNwW', 'L': 'NnWnNnNwW', 'M': 'WnWnNnNwN', 'N': 'NnNnWnNwW',
      'O': 'WnNnWnNwN', 'P': 'NnWnWnNwN', 'Q': 'NnNnNnWwW', 'R': 'WnNnNnWwN',
      'S': 'NnWnNnWwN', 'T': 'NnNnWnWwN', 'U': 'WwNnNnNnW', 'V': 'NwWnNnNnW',
      'W': 'WwWnNnNnN', 'X': 'NwNnWnNnW', 'Y': 'WwNnWnNnN', 'Z': 'NwWnWnNnN',
      '-': 'NwNnNnWnW', ' ': 'NwWnNnWnN', '*': 'NnWnNwWnN'
    };

    const formattedText = `*${text.toUpperCase()}*`;

    let totalWidth = 0;
    for (const char of formattedText) {
      const pattern = patterns[char] || patterns[' '];
      for (const sym of pattern) {
        if (sym === 'N' || sym === 'n') totalWidth += 1;
        else totalWidth += 3;
      }
      totalWidth += 1;
    }

    const scale = 2;
    canvas.width = totalWidth * scale;
    canvas.height = 50 * scale;
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = '50px';

    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, totalWidth, 50);

    let x = 0;
    for (const char of formattedText) {
      const pattern = patterns[char] || patterns[' '];
      for (let i = 0; i < pattern.length; i++) {
        const sym = pattern[i];
        const isBar = (sym === 'N' || sym === 'W');
        const width = (sym === 'N' || sym === 'n') ? 1 : 3;

        if (isBar) {
          ctx.fillStyle = "#000000";
          ctx.fillRect(x, 0, width, 38);
        }
        x += width;
      }
      x += 1;
    }

    ctx.fillStyle = "#000000";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, totalWidth / 2, 47);
  }, [text]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        margin: "0 auto"
      }}
    />
  );
};

type NewCustomerForm = Omit<Customer, "id" | "createdAt">;

const Sales = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Database States
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

  // Sorting and Validation States
  const [sortField, setSortField] = useState<keyof Sale>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // Form States
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [notes, setNotes] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);

  // Yeni Müşteri Modal States
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState<NewCustomerForm>({
    name: "", company: "", phone: "", email: "", taxOffice: "", taxNumber: "", address: ""
  });

  // Satış Başarı & Fiş Önizleme Modal States
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastCreatedSale, setLastCreatedSale] = useState<Sale | null>(null);

  // Ürün Ekleme Form States
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [prodSearch, setProdSearch] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  // Reddedilen Satış Düzenleme Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [editCart, setEditCart] = useState<SaleItem[]>([]);
  const [editNotes, setEditNotes] = useState("");
  const [editDiscount, setEditDiscount] = useState(0);
  const [editProdSearch, setEditProdSearch] = useState("");
  const [editSelectedProductId, setEditSelectedProductId] = useState("");
  const [editQuantity, setEditQuantity] = useState(1);
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    if (!showCustomerModal && !showReceiptModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowCustomerModal(false);
        setShowReceiptModal(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [showCustomerModal, showReceiptModal]);

  const handleOverlayClick = (e: React.MouseEvent, closeFn: (v: boolean) => void) => {
    if ((e.target as HTMLElement).className === "modal-overlay") {
      closeFn(false);
    }
  };

  const handleSort = (field: keyof Sale) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortedHistory = (history: Sale[]) => {
    return [...history].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal ?? "").toLowerCase();
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal, 'tr')
          : bVal.localeCompare(aVal, 'tr');
      } else {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }
    });
  };

  const fetchInitialData = useCallback(async () => {
    try {
      const [custData, prodData, salesData, profileData] = await Promise.all([
        getCustomers(),
        getProducts(),
        getSales(user?.role, user?.uid),
        getCompanyProfile()
      ]);
      setCustomers(custData);
      setProducts(prodData);
      setSalesHistory(salesData);
      setCompanyProfile(profileData);
    } catch (err) {
      console.error("Satış verileri yüklenirken hata:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.role, user?.uid]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh", color: "var(--text-secondary)" }}>
        Yükleniyor...
      </div>
    );
  }

  // --- SEPET İŞLEMLERİ ---
  const handleAddToSepet = () => {
    if (!selectedProductId) return;
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    if (prod.stock <= 0) {
      showToast("Bu ürünün stoğu tükenmiştir!", "warning");
      return;
    }

    const qty = quantity;
    if (isNaN(qty) || qty <= 0) return;

    const existingIndex = cart.findIndex(item => item.productId === prod.id);
    const currentCartQty = existingIndex !== -1 ? cart[existingIndex].quantity : 0;

    if (currentCartQty + qty > prod.stock) {
      showToast(`Stokta sadece ${prod.stock} adet var. Sepetinizde zaten ${currentCartQty} adet bulunuyor.`, "warning");
      return;
    }

    if (existingIndex !== -1) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += qty;
      updatedCart[existingIndex].total = updatedCart[existingIndex].quantity * prod.price;
      setCart(updatedCart);
    } else {
      setCart([
        ...cart,
        {
          productId: prod.id,
          productName: prod.name,
          productCode: prod.code,
          quantity: qty,
          price: prod.price,
          costPrice: (prod as any).costPrice ?? 0,
          taxRate: (prod as any).taxRate ?? 20,
          total: qty * prod.price
        }
      ]);
    }

    setSelectedProductId("");
    setQuantity(1);
    setProdSearch("");
  };

  const handleRemoveFromSepet = (idx: number) => {
    setCart(cart.filter((_, i) => i !== idx));
  };

  const handleBarcodeDetected = (code: string) => {
    setShowScanner(false);
    const prod = products.find(p => (p as any).barcode === code || p.code === code);
    if (prod) {
      setSelectedProductId(prod.id);
      setProdSearch(prod.name);
      showToast(`"${prod.name}" ürünü bulundu.`, "success");
    } else {
      setProdSearch(code);
      showToast(`"${code}" barkoduna sahip ürün bulunamadı. Kod arama alanına yazıldı.`, "warning");
    }
  };

  // --- REDDEDİLEN SATIŞ DÜZENLEME ---
  const handleOpenEditModal = (sale: Sale) => {
    setEditSale(sale);
    setEditCart(sale.items.map(i => ({ ...i })));
    setEditNotes(sale.notes || "");
    setEditDiscount(sale.discountAmount || 0);
    setEditProdSearch("");
    setEditSelectedProductId("");
    setEditQuantity(1);
    setShowEditModal(true);
  };

  const handleEditAddToCart = () => {
    const prod = products.find(p => p.id === editSelectedProductId);
    if (!prod) return;
    const qty = editQuantity;
    if (isNaN(qty) || qty <= 0) return;
    const existingIndex = editCart.findIndex(i => i.productId === prod.id);
    const currentQty = existingIndex !== -1 ? editCart[existingIndex].quantity : 0;
    if (currentQty + qty > prod.stock) {
      showToast(`Stokta sadece ${prod.stock} adet var.`, "warning");
      return;
    }
    if (existingIndex !== -1) {
      const updated = [...editCart];
      updated[existingIndex].quantity += qty;
      updated[existingIndex].total = updated[existingIndex].quantity * prod.price;
      setEditCart(updated);
    } else {
      setEditCart([...editCart, {
        productId: prod.id,
        productName: prod.name,
        productCode: prod.code,
        quantity: qty,
        price: prod.price,
        taxRate: (prod as any).taxRate ?? 20,
        total: qty * prod.price
      }]);
    }
    setEditSelectedProductId("");
    setEditQuantity(1);
    setEditProdSearch("");
  };

  const handleEditRemoveFromCart = (idx: number) => {
    setEditCart(editCart.filter((_, i) => i !== idx));
  };

  const handleResubmit = async () => {
    if (!editSale) return;
    if (editCart.length === 0) {
      showToast("Sepet boş olamaz.", "warning");
      return;
    }
    setEditSubmitting(true);
    try {
      await resubmitSale(editSale.id, editCart, editNotes, editDiscount, user!.uid, user!.displayName, user!.role);
      showToast(`${editSale.receiptNo} numaralı satış tekrar muhasebe onayına gönderildi.`, "success");
      setShowEditModal(false);
      fetchInitialData();
    } catch (err: any) {
      showToast("Hata: " + err.message, "error");
    } finally {
      setEditSubmitting(false);
    }
  };

  // --- FİNANSAL TOPLAMLAR ---
  // NOT: Bu hesaplama artık utils/salesMath.ts#computeSaleTotals üzerinden
  // yapılıyor; böylece burada gösterilen önizleme, salesRepository'nin
  // gerçekte kaydedeceği tutarlarla HER ZAMAN aynı formülü kullanır.
  // (Bkz. proje incelemesi: eskiden bu ekranda ve "reddedilen satışı
  // düzenle" modalında -aşağıda- birbirinden farklı KDV formülleri
  // kullanılıyordu.)
  const discount = discountAmount || 0;
  const { totalAmount, taxAmount, netAmount } = computeSaleTotals(cart, discount);
  const totalBeforeTaxAndDiscount = totalAmount;

  // --- SATIŞ KAYDI OLUŞTURMA ---
  const handleCreateSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!selectedCustomerId) {
      showToast("Lütfen bir müşteri seçin.", "warning");
      return;
    }
    if (cart.length === 0) {
      showToast("Lütfen sepete en az bir ürün ekleyin.", "warning");
      return;
    }

    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer || !user) return;

    setSubmitting(true);

    const saleData = {
      salespersonId: user.uid,
      salespersonName: user.displayName,
      customerId: customer.id,
      customerName: customer.name,
      customerCompany: customer.company,
      items: cart,
      notes,
      discountAmount: discount
    };

    try {
      const createdSale = await addSale(saleData, user.uid, user.displayName, user.role);
      setLastCreatedSale(createdSale);
      setShowReceiptModal(true);

      setSelectedCustomerId("");
      setCart([]);
      setNotes("");
      setDiscountAmount(0);

      fetchInitialData();
      showToast("Satış kaydı başarıyla oluşturuldu.", "success");
    } catch (error: any) {
      showToast("Satış kaydı oluşturulurken bir hata meydana geldi: " + error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // --- YENİ MÜŞTERİ KAYDI ---
  const handleAddNewCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!newCustomer.name.trim()) {
      newErrors.name = "Müşteri adı boş bırakılamaz.";
    }
    if (!newCustomer.company.trim()) {
      newErrors.company = "Firma unvanı boş bırakılamaz.";
    }

    if (newCustomer.phone && !/^\d{10,11}$/.test(newCustomer.phone.replace(/\s+/g, ""))) {
      newErrors.phone = "Telefon 10 veya 11 haneli rakam olmalıdır.";
    }

    if (newCustomer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(newCustomer.email)) {
      newErrors.email = "Geçersiz e-posta formatı.";
    }

    if (newCustomer.taxNumber && !/^\d{10}$/.test(newCustomer.taxNumber)) {
      newErrors.taxNumber = "Vergi numarası 10 haneli rakam olmalıdır.";
    }

    if (submitting) return;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showToast("Lütfen form alanlarındaki hataları düzeltin.", "warning");
      return;
    }

    setSubmitting(true);

    try {
      const created = await addCustomer(newCustomer, user!.uid, user!.displayName, user!.role);
      showToast("Yeni müşteri başarıyla eklendi.", "success");
      const updatedCustomers = await getCustomers();
      setCustomers(updatedCustomers);
      setSelectedCustomerId(created.id);

      setShowCustomerModal(false);
      setErrors({});
      setNewCustomer({
        name: "", company: "", phone: "", email: "", taxOffice: "", taxNumber: "", address: ""
      });
    } catch (err: any) {
      showToast("Müşteri eklenirken hata: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(prodSearch.toLowerCase()) ||
    p.code.toLowerCase().includes(prodSearch.toLowerCase()) ||
    ((p as any).barcode && (p as any).barcode.toLowerCase().includes(prodSearch.toLowerCase()))
  );

  if (!user) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "1.5rem" }} className="grid-cols-2 animate-fade">

      {showScanner && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* SOL TARAF: Satış Formu ve Sepet */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="print-hidden">

        {/* Adım 1: Müşteri Seçimi */}
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600 }}>1. Müşteri Bilgileri</h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowCustomerModal(true)}
              style={{ padding: "0.35rem 0.65rem" }}
            >
              <UserPlus size={16} />
              <span>Yeni Müşteri</span>
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">Müşteri Seçin</label>
            <select
              className="form-control"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              required
            >
              <option value="">-- Firma veya Müşteri Seçin --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.company} ({c.name})
                </option>
              ))}
            </select>
          </div>

          {selectedCustomerId && (
            (() => {
              const cust = customers.find(c => c.id === selectedCustomerId);
              if (!cust) return null;
              return (
                <div style={{
                  marginTop: "1rem",
                  padding: "0.85rem 1rem",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--border-color)",
                  fontSize: "0.85rem"
                }}>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{cust.company}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem", color: "var(--text-secondary)" }}>
                    <div><strong>Yetkili:</strong> {cust.name}</div>
                    <div><strong>Telefon:</strong> {cust.phone || "-"}</div>
                    <div><strong>Vergi Dairesi:</strong> {cust.taxOffice || "-"}</div>
                    <div><strong>Vergi No:</strong> {cust.taxNumber || "-"}</div>
                  </div>
                  <div style={{ marginTop: "0.5rem", color: "var(--text-secondary)" }}><strong>Adres:</strong> {cust.address || "-"}</div>
                </div>
              );
            })()
          )}
        </section>

        {/* Adım 2: Sepet Listesi */}
        <section className="card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>2. Satış Kalemleri (Sepet)</h3>

          <div className="table-container" style={{ flex: 1, minHeight: "200px" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th style={{ textAlign: "right" }}>B. Fiyat</th>
                  <th style={{ textAlign: "center" }}>Miktar</th>
                  <th style={{ textAlign: "center" }}>KDV (%)</th>
                  <th style={{ textAlign: "right" }}>Toplam</th>
                  <th style={{ width: "50px" }}></th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem" }}>
                      Sepetiniz boş. Sağ panelden ürün arayıp ekleyin.
                    </td>
                  </tr>
                ) : (
                  cart.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.productName}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{item.productCode}</div>
                      </td>
                      <td style={{ textAlign: "right" }}>{item.price.toFixed(2)} ₺</td>
                      <td style={{ textAlign: "center", fontWeight: 600 }}>{item.quantity}</td>
                      <td style={{ textAlign: "center" }}>%{item.taxRate}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{item.total.toFixed(2)} ₺</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromSepet(idx)}
                          style={{ color: "var(--danger)", cursor: "pointer" }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Geçmiş Satışlar ve Fiş Tekrar Yazdırma */}
        <section className="card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>Geçmiş Satışlarım & Fiş Yazdırma</h3>
          <div className="table-container" style={{ maxHeight: "250px", overflowY: "auto" }}>
            <table className="table" style={{ fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th onClick={() => handleSort("receiptNo")} style={{ cursor: "pointer" }}>
                    Fiş No / Tarih {sortField === "receiptNo" ? (sortOrder === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th onClick={() => handleSort("customerCompany")} style={{ cursor: "pointer" }}>
                    Müşteri / Firma {sortField === "customerCompany" ? (sortOrder === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th onClick={() => handleSort("netAmount")} style={{ textAlign: "right", cursor: "pointer" }}>
                    Tutar {sortField === "netAmount" ? (sortOrder === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th style={{ textAlign: "center" }}>Durum</th>
                  <th style={{ width: "120px", textAlign: "center" }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {salesHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                      Henüz geçmiş satış kaydınız bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  getSortedHistory(salesHistory).map((sale) => (
                    <tr key={sale.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{sale.receiptNo}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                          {new Date(sale.date).toLocaleDateString('tr-TR')}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sale.customerCompany}>
                          {sale.customerCompany}
                        </div>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {sale.netAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`badge badge-${sale.status === 'approved' ? 'success' : sale.status === 'rejected' ? 'danger' : 'warning'}`} style={{ fontSize: "0.6rem", padding: "0.15rem 0.35rem" }}>
                          {sale.status === 'approved' ? 'Onaylandı' : sale.status === 'rejected' ? 'Reddedildi' : 'Bekliyor'}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "0.35rem", justifyContent: "center" }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon btn-sm"
                            onClick={() => {
                              setLastCreatedSale(sale);
                              setShowReceiptModal(true);
                            }}
                            title="Bilgi Fişini Yazdır"
                            style={{ padding: "0.35rem" }}
                            aria-label="Bilgi Fişini Yazdır"
                          >
                            <Printer size={14} />
                          </button>
                          {sale.status === "rejected" && (
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => handleOpenEditModal(sale)}
                              title="Düzenle & Tekrar Gönder"
                              style={{ padding: "0.35rem 0.5rem", backgroundColor: "var(--warning-light)", color: "var(--warning-hover)", border: "1px solid var(--warning-hover)" }}
                              aria-label="Düzenle ve Tekrar Gönder"
                            >
                              <Edit3 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* SAĞ TARAF: Ürün Arama, Ekleme ve Satış Onay Özeti */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="print-hidden">

        {/* Ürün Arama & Ekleme */}
        <section className="card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>Ürün Ekle</h3>

          <div className="form-group">
            <label className="form-label">Ürün Arama (Kod, İsim veya Barkod)</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: "2.25rem" }}
                  placeholder="Örn: Monitör veya barkod numarası..."
                  value={prodSearch}
                  onChange={(e) => setProdSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                title="Kamera ile barkod okut"
                style={{
                  padding: "0 0.85rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--primary)",
                  cursor: "pointer",
                  display: "flex", alignItems: "center"
                }}
              >
                <ScanLine size={20} />
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Ürün Listesi</label>
            <select
              className="form-control"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              <option value="">-- Ürün Seçin --</option>
              {filteredProducts.map(p => {
                const isKritik = p.stock <= p.criticalStock;
                return (
                  <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                    {p.name} (Kod: {p.code} | Stok: {p.stock} {p.unit}) {isKritik ? "⚠️" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {selectedProductId && (
            (() => {
              const prod = products.find(p => p.id === selectedProductId);
              if (!prod) return null;
              const isKritik = prod.stock <= prod.criticalStock;
              return (
                <div style={{
                  margin: "1rem 0",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: isKritik ? "var(--warning-light)" : "var(--primary-light)",
                  color: isKritik ? "var(--warning-hover)" : "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.85rem",
                  fontWeight: 500
                }}>
                  {isKritik ? (
                    <>
                      <AlertCircle size={18} />
                      <span>Bu ürünün stoğu kritik seviyede! (Kalan: {prod.stock})</span>
                    </>
                  ) : (
                    <span>Stok durumu: Güvenli (Kalan: {prod.stock} adet)</span>
                  )}
                </div>
              );
            })()
          )}

          <div className="form-group">
            <label className="form-label">Miktar</label>
            <input
              type="number"
              min="1"
              className="form-control"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAddToSepet}
            style={{ width: "100%", marginTop: "0.5rem" }}
            disabled={!selectedProductId}
          >
            <Plus size={18} />
            <span>Sepete Ekle</span>
          </button>
        </section>

        {/* Satış Özeti ve Tamamlama */}
        <section className="card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>Satış Özeti</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.95rem", borderBottom: "1px dashed var(--border-color)", paddingBottom: "1rem", marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-secondary)" }}>Ara Toplam (KDV Hariç)</span>
              <span style={{ fontWeight: 600 }}>{totalBeforeTaxAndDiscount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-secondary)" }}>Toplam KDV</span>
              <span style={{ fontWeight: 600 }}>{taxAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "0.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-secondary)" }}>İndirim / İskonto</span>
                <input
                  type="number"
                  min="0"
                  style={{ width: "110px", padding: "0.25rem 0.5rem", textAlign: "right" }}
                  className="form-control"
                  placeholder="0.00"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>Net Toplam (Ödenecek)</span>
            <span style={{ fontWeight: 800, fontSize: "1.35rem", color: "var(--primary)" }}>
              {netAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Sipariş Notları</label>
            <textarea
              className="form-control"
              rows={2}
              maxLength={500}
              placeholder="Fatura, teslimat vb. notlar..."
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              style={{ resize: "none" }}
            />
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "right" }}>{notes.length}/500</div>
          </div>

          <button
            type="button"
            className="btn btn-success"
            onClick={handleCreateSaleSubmit}
            style={{
              width: "100%",
              height: "48px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem"
            }}
            disabled={cart.length === 0 || !selectedCustomerId || submitting}
          >
            {submitting ? (
              <>
                <div className="spinner-loader" style={{
                  width: "18px",
                  height: "18px",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#fff",
                  borderRadius: "50%",
                  animation: "spin 0.8s infinite linear"
                }}></div>
                <span>Gönderiliyor...</span>
              </>
            ) : (
              <>
                <FileText size={18} />
                <span>Satış Kaydını Gönder</span>
              </>
            )}
          </button>

          <div style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.75rem" }}>
            * Bu işlem "Muhasebe Onayı Bekliyor" durumunda kaydedilecektir.
          </div>
        </section>

      </div>

      {/* --- MÜŞTERİ EKLEME MODALI --- */}
      {showCustomerModal && (
        <div className="modal-overlay" onClick={(e) => handleOverlayClick(e, setShowCustomerModal)}>
          <div className="modal-content animate-slide-up" style={{ maxWidth: "550px" }} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Yeni Müşteri Ekle</h3>
              <button onClick={() => setShowCustomerModal(false)} style={{ cursor: "pointer", fontSize: "1.25rem" }} aria-label="Kapat">&times;</button>
            </div>
            <form onSubmit={handleAddNewCustomerSubmit}>
              <div className="modal-body">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label className="form-label">Müşteri (Ad Soyad)</label>
                    <input
                      type="text"
                      className={`form-control ${errors.name ? "is-invalid" : ""}`}
                      value={newCustomer.name}
                      onChange={(e) => {
                        setNewCustomer({ ...newCustomer, name: e.target.value });
                        if (errors.name) setErrors({ ...errors, name: null });
                      }}
                      placeholder="Ahmet Yılmaz"
                      required
                    />
                    {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Firma Unvanı</label>
                    <input
                      type="text"
                      className={`form-control ${errors.company ? "is-invalid" : ""}`}
                      value={newCustomer.company}
                      onChange={(e) => {
                        setNewCustomer({ ...newCustomer, company: e.target.value });
                        if (errors.company) setErrors({ ...errors, company: null });
                      }}
                      placeholder="Yılmaz Ticaret Ltd. Şti."
                      required
                    />
                    {errors.company && <div className="invalid-feedback">{errors.company}</div>}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label className="form-label">Telefon</label>
                    <input
                      type="text"
                      className={`form-control ${errors.phone ? "is-invalid" : ""}`}
                      value={newCustomer.phone}
                      onChange={(e) => {
                        setNewCustomer({ ...newCustomer, phone: e.target.value });
                        if (errors.phone) setErrors({ ...errors, phone: null });
                      }}
                      placeholder="0532..."
                    />
                    {errors.phone && <div className="invalid-feedback">{errors.phone}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">E-Posta</label>
                    <input
                      type="email"
                      className={`form-control ${errors.email ? "is-invalid" : ""}`}
                      value={newCustomer.email}
                      onChange={(e) => {
                        setNewCustomer({ ...newCustomer, email: e.target.value });
                        if (errors.email) setErrors({ ...errors, email: null });
                      }}
                      placeholder="eposta@firma.com"
                    />
                    {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label className="form-label">Vergi Dairesi</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newCustomer.taxOffice}
                      onChange={(e) => setNewCustomer({ ...newCustomer, taxOffice: e.target.value })}
                      placeholder="Maslak"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vergi Numarası</label>
                    <input
                      type="text"
                      className={`form-control ${errors.taxNumber ? "is-invalid" : ""}`}
                      value={newCustomer.taxNumber}
                      onChange={(e) => {
                        setNewCustomer({ ...newCustomer, taxNumber: e.target.value });
                        if (errors.taxNumber) setErrors({ ...errors, taxNumber: null });
                      }}
                      placeholder="10 Haneli No"
                    />
                    {errors.taxNumber && <div className="invalid-feedback">{errors.taxNumber}</div>}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Açık Adres</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    placeholder="Mahalle, Cadde, No..."
                    style={{ resize: "none" }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCustomerModal(false)} disabled={submitting}>İptal</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? "Kaydediliyor..." : "Kaydet"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- SATIŞ FİŞİ VE YAZDIRMA (PDF) MODALI --- */}
      {showReceiptModal && lastCreatedSale && (
        <div className="modal-overlay" onClick={(e) => handleOverlayClick(e, setShowReceiptModal)}>
          <div className="modal-content animate-slide-up" style={{ maxWidth: "480px", backgroundColor: "#fff", color: "#000" }} role="dialog" aria-modal="true">
            <div className="modal-header print-hidden" style={{ borderBottom: "1px solid #eee", backgroundColor: "#f8fafc" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>Satış Fişi / PDF Çıktısı</h3>
              <button onClick={() => setShowReceiptModal(false)} style={{ cursor: "pointer", fontSize: "1.25rem", color: "#000" }} aria-label="Kapat">&times;</button>
            </div>

            <div className="modal-body print-area" style={{ padding: "2rem", fontSize: "0.85rem", color: "#000", fontFamily: "'Courier New', Courier, monospace" }}>

              <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                <img
                  src="/logo.png"
                  alt="Özkon Çelik Logo"
                  style={{
                    height: "45px",
                    objectFit: "contain",
                    display: "block",
                    margin: "0 auto 0.75rem auto"
                  }}
                />
                <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, fontFamily: "sans-serif" }}>
                  {companyProfile?.companyName || "ÖZKON ÇELİK"}
                </h2>
                <div style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
                  {companyProfile?.address || "Merkez Mah. Çelik Sanayi Bulvarı No: 45 Sarıyer / İstanbul"}
                </div>
                <div style={{ fontSize: "0.75rem" }}>
                  {companyProfile?.phone ? `Tel: ${companyProfile.phone}` : ""}
                  {companyProfile?.fax ? ` | Faks: ${companyProfile.fax}` : ""}
                </div>
                <div style={{ fontSize: "0.75rem" }}>
                  Vergi Dairesi: {companyProfile?.taxOffice || "Maslak"} | Vergi No: {companyProfile?.taxNumber || "6540987654"}
                </div>
                <div style={{ margin: "0.5rem 0", borderBottom: "1px dashed #000" }}></div>
                <h4 style={{ margin: 0, fontWeight: 700 }}>SATIS FİSİ (PROFORMA)</h4>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "1rem" }}>
                <div><strong>Fiş No:</strong> {lastCreatedSale.receiptNo}</div>
                <div><strong>Tarih:</strong> {new Date(lastCreatedSale.createdAt || lastCreatedSale.date).toLocaleString('tr-TR')}</div>
                <div><strong>Satış Temsilcisi:</strong> {lastCreatedSale.salespersonName}</div>
                <div><strong>Durum:</strong> {lastCreatedSale.status === "approved" ? "Onaylandı" : lastCreatedSale.status === "rejected" ? "Reddedildi" : "Muhasebe Onayı Bekliyor"}</div>
                {lastCreatedSale.status !== "pending_accounting" && lastCreatedSale.processedAt && (
                  <div><strong>İşlem Zamanı:</strong> {new Date(lastCreatedSale.processedAt).toLocaleString('tr-TR')} {lastCreatedSale.processedBy && `- ${lastCreatedSale.processedBy}`}</div>
                )}
              </div>

              <div style={{ borderBottom: "1px dashed #000", marginBottom: "1rem" }}></div>

              <div style={{ marginBottom: "1rem" }}>
                <strong>MÜŞTERİ BİLGİLERİ:</strong>
                <div>{lastCreatedSale.customerCompany}</div>
                <div>Yetkili: {lastCreatedSale.customerName}</div>
              </div>

              <div style={{ borderBottom: "1px dashed #000", marginBottom: "1.5rem" }}></div>

              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1.5rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #000", textAlign: "left" }}>
                    <th style={{ paddingBottom: "0.5rem" }}>Ürün Adı</th>
                    <th style={{ paddingBottom: "0.5rem", textAlign: "center" }}>Adet</th>
                    <th style={{ paddingBottom: "0.5rem", textAlign: "right" }}>Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {lastCreatedSale.items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ paddingTop: "0.5rem", paddingBottom: "0.5rem" }}>
                        {item.productName}
                        <div style={{ fontSize: "0.75rem", color: "#666" }}>{item.productCode}</div>
                      </td>
                      <td style={{ paddingTop: "0.5rem", paddingBottom: "0.5rem", textAlign: "center" }}>{item.quantity}</td>
                      <td style={{ paddingTop: "0.5rem", paddingBottom: "0.5rem", textAlign: "right" }}>{item.total.toFixed(2)} ₺</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ borderBottom: "1px dashed #000", marginBottom: "1rem" }}></div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", alignItems: "flex-end" }}>
                <div>Ara Toplam (KDV Hariç): {lastCreatedSale.totalAmount.toFixed(2)} ₺</div>
                <div>Toplam KDV: {lastCreatedSale.taxAmount.toFixed(2)} ₺</div>
                {lastCreatedSale.discountAmount > 0 && (
                  <div>İskonto: -{lastCreatedSale.discountAmount.toFixed(2)} ₺</div>
                )}
                <div style={{ fontSize: "1.1rem", fontWeight: "bold", marginTop: "0.5rem" }}>
                  GENEL TOPLAM: {lastCreatedSale.netAmount.toFixed(2)} ₺
                </div>
              </div>

              <div style={{ borderBottom: "1px dashed #000", margin: "1.5rem 0 1rem 0" }}></div>

              <div style={{ textAlign: "center", fontSize: "0.75rem" }}>
                <div>Bu belge proforma fiş niteliğindedir.</div>
                <div>Sistem onayından sonra resmiyet kazanacaktır.</div>
                <div style={{ marginTop: "0.5rem", fontWeight: "bold" }}>Bizi tercih ettiğiniz için teşekkür ederiz.</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1.5rem", fontSize: "0.8rem", textAlign: "center" }}>
                <div>
                  <div><strong>Teslim Eden</strong></div>
                  <div style={{ height: "40px" }}></div>
                  <div style={{ borderTop: "1px solid #000", width: "80%", margin: "0 auto" }}>İmza</div>
                </div>
                <div>
                  <div><strong>Teslim Alan</strong></div>
                  <div style={{ height: "40px" }}></div>
                  <div style={{ borderTop: "1px solid #000", width: "80%", margin: "0 auto" }}>İmza</div>
                </div>
              </div>

              <div style={{ textAlign: "center", marginTop: "1.25rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <Barcode text={lastCreatedSale.receiptNo} />
              </div>

            </div>

            <div className="modal-footer print-hidden" style={{ borderTop: "1px solid #eee", backgroundColor: "#f8fafc", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowReceiptModal(false)}
              >
                Kapat
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handlePrintReceipt}
                title="Tarayıcı yazdırma ekranını aç"
              >
                <Printer size={16} />
                <span>Yazdır</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => generateInvoicePDF(lastCreatedSale, companyProfile)}
                title="PDF olarak indir"
              >
                <Download size={16} />
                <span>PDF İndir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Yazdırma Modu CSS'i */}
      <style>{`
        @media print {
          html, body {
            height: auto !important;
            overflow: visible !important;
            background-color: #ffffff !important;
          }

          body * {
            visibility: hidden;
          }

          .print-area, .print-area * {
            visibility: visible;
          }

          .print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 10px !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>

      {/* --- REDDEDİLEN SATIŞ DÜZENLEME MODALI --- */}
      {showEditModal && editSale && (() => {
        // NOT: Aynı computeSaleTotals fonksiyonu burada da kullanılıyor;
        // eskiden burada KDV'yi tutarın İÇİNDEN çıkaran farklı bir formül
        // vardı (bkz. dosya başındaki not), bu da resubmitSale çağrısından
        // önce kullanıcıya YANLIŞ bir önizleme gösteriyordu.
        const { totalAmount: editTotalAmount, taxAmount: editTaxAmount, netAmount: editNetAmount } =
          computeSaleTotals(editCart, editDiscount);
        const filteredEditProducts = products.filter(p =>
          p.name.toLowerCase().includes(editProdSearch.toLowerCase()) ||
          p.code.toLowerCase().includes(editProdSearch.toLowerCase()) ||
          ((p as any).barcode && (p as any).barcode.toLowerCase().includes(editProdSearch.toLowerCase()))
        );
        return (
          <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowEditModal(false); }}>
            <div className="modal-content animate-slide-up" style={{ maxWidth: "680px", maxHeight: "90vh", overflowY: "auto" }} role="dialog" aria-modal="true">
              <div className="modal-header">
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Edit3 size={18} /> {editSale.receiptNo} — Satışı Düzenle & Tekrar Gönder
                </h3>
                <button onClick={() => setShowEditModal(false)} style={{ cursor: "pointer", fontSize: "1.25rem" }} aria-label="Kapat">&times;</button>
              </div>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                <div style={{ padding: "0.75rem 1rem", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem" }}>
                  <span style={{ color: "var(--text-muted)" }}>Müşteri: </span>
                  <strong>{editSale.customerCompany} ({editSale.customerName})</strong>
                </div>

                <div>
                  <h4 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.75rem" }}>Sepet</h4>
                  <div className="table-container">
                    <table className="table" style={{ fontSize: "0.85rem" }}>
                      <thead>
                        <tr>
                          <th>Ürün</th>
                          <th style={{ textAlign: "right" }}>B. Fiyat</th>
                          <th style={{ textAlign: "center" }}>Miktar</th>
                          <th style={{ textAlign: "right" }}>Toplam</th>
                          <th style={{ width: "40px" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {editCart.length === 0 ? (
                          <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>Sepet boş</td></tr>
                        ) : (
                          editCart.map((item, idx) => (
                            <tr key={idx}>
                              <td>
                                <div style={{ fontWeight: 600 }}>{item.productName}</div>
                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{item.productCode}</div>
                              </td>
                              <td style={{ textAlign: "right" }}>{item.price.toFixed(2)} ₺</td>
                              <td style={{ textAlign: "center" }}>
                                <input
                                  type="number" min="1"
                                  className="form-control"
                                  style={{ width: "65px", padding: "0.2rem 0.4rem", textAlign: "center" }}
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const qty = Math.max(1, parseInt(e.target.value) || 1);
                                    const updated = [...editCart];
                                    updated[idx] = { ...updated[idx], quantity: qty, total: qty * updated[idx].price };
                                    setEditCart(updated);
                                  }}
                                />
                              </td>
                              <td style={{ textAlign: "right", fontWeight: 600 }}>{item.total.toFixed(2)} ₺</td>
                              <td>
                                <button type="button" onClick={() => handleEditRemoveFromCart(idx)} style={{ color: "var(--danger)", cursor: "pointer" }}>
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div className="form-group" style={{ flex: 2, margin: 0 }}>
                    <label className="form-label" style={{ fontSize: "0.8rem" }}>Ürün Ara & Ekle</label>
                    <input
                      className="form-control"
                      placeholder="İsim veya kod..."
                      value={editProdSearch}
                      onChange={e => setEditProdSearch(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 2, margin: 0 }}>
                    <label className="form-label" style={{ fontSize: "0.8rem" }}>Ürün</label>
                    <select className="form-control" value={editSelectedProductId} onChange={e => setEditSelectedProductId(e.target.value)}>
                      <option value="">-- Seç --</option>
                      {filteredEditProducts.map(p => (
                        <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                          {p.name} (Stok: {p.stock})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ width: "80px", margin: 0 }}>
                    <label className="form-label" style={{ fontSize: "0.8rem" }}>Miktar</label>
                    <input type="number" min="1" className="form-control" value={editQuantity}
                      onChange={e => setEditQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleEditAddToCart} disabled={!editSelectedProductId} style={{ marginBottom: "1px" }}>
                    <Plus size={16} />
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label className="form-label">Sipariş Notları</label>
                    <textarea className="form-control" rows={2} value={editNotes}
                      onChange={e => setEditNotes(e.target.value.slice(0, 500))} style={{ resize: "none" }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">İndirim (₺)</label>
                    <input type="number" min="0" className="form-control" value={editDiscount}
                      onChange={e => setEditDiscount(Math.max(0, parseFloat(e.target.value) || 0))} />
                    <div style={{ marginTop: "0.75rem", fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Toplam KDV</span>
                        <span>{editTaxAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                        <span>Net Toplam</span>
                        <span style={{ color: "var(--primary)", fontSize: "1rem" }}>{editNetAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>İptal</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleResubmit}
                  disabled={editSubmitting || editCart.length === 0}
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                >
                  <RefreshCw size={16} />
                  <span>{editSubmitting ? "Gönderiliyor..." : "Tekrar Muhasebe Onayına Gönder"}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default Sales;
