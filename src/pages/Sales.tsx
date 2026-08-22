import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getCustomers, getProducts, addSale, addCustomer, getSales, resubmitSale, getCompanyProfile } from "../services/db";
import { generateInvoicePDF } from "../utils/generateInvoicePDF";
import { computeSaleTotals, PAYMENT_METHOD_LABELS } from "../utils/salesMath";
import { formatCurrency, formatDate } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import BarcodeScanner from "../components/BarcodeScanner";
import EmptyState from "../components/EmptyState";
import type { Customer, Product, Sale, SaleItem, CompanyProfile, PaymentMethod } from "../types";
import {
  Plus,
  Minus,
  Trash2,
  Search,
  UserPlus,
  Printer,
  FileText,
  AlertCircle,
  ScanLine,
  RefreshCw,
  Edit3,
  Download,
  RotateCcw,
  CreditCard,
  ShoppingCart,
  Zap,
  Keyboard,
  PlusCircle
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("open_account");
  const [checkNumber, setCheckNumber] = useState("");
  const [paymentDueDate, setPaymentDueDate] = useState("");

  // Yeni Müşteri Modal States
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState<NewCustomerForm>({
    name: "", company: "", phone: "", email: "", taxOffice: "", taxNumber: "", address: ""
  });

  // Satış Başarı & Fiş Önizleme Modal States
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastCreatedSale, setLastCreatedSale] = useState<Sale | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Ürün Ekleme Form States & Refs
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [prodSearch, setProdSearch] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  // Hızlı Satış Rafı & Kısayol States & Refs
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showShelfAddModal, setShowShelfAddModal] = useState(false);
  const [shelfSearch, setShelfSearch] = useState("");
  const [shelfProductIds, setShelfProductIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`takip_pos_shelf_${user?.uid || "default"}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const prodSearchInputRef = useRef<HTMLInputElement>(null);
  const customerSelectRef = useRef<HTMLSelectElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

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

  // Global Klavye Kısayolları (F1, F2, F4, F8, F9, Ctrl+Enter, Esc)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // F1 -> Kısayol Yardım Modalı
      if (e.key === "F1") {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
        return;
      }

      // F2 -> Ürün / Barkod Arama Alanına Odaklan
      if (e.key === "F2") {
        e.preventDefault();
        prodSearchInputRef.current?.focus();
        prodSearchInputRef.current?.select();
        return;
      }

      // F4 -> Müşteri Seçimine Odaklan
      if (e.key === "F4") {
        e.preventDefault();
        customerSelectRef.current?.focus();
        return;
      }

      // F8 -> İskonto / İndirim Alanına Odaklan
      if (e.key === "F8") {
        e.preventDefault();
        discountInputRef.current?.focus();
        discountInputRef.current?.select();
        return;
      }

      // F9 veya Ctrl + Enter -> Satışı Onaya Gönder
      if (e.key === "F9" || (e.ctrlKey && e.key === "Enter")) {
        e.preventDefault();
        submitButtonRef.current?.click();
        return;
      }

      // Escape -> Modalları Kapat veya Aramayı Temizle
      if (e.key === "Escape") {
        if (showShelfAddModal) {
          setShowShelfAddModal(false);
        } else if (showShortcutsModal) {
          setShowShortcutsModal(false);
        } else if (showCustomerModal) {
          setShowCustomerModal(false);
        } else if (showReceiptModal) {
          setShowReceiptModal(false);
        } else if (showEditModal) {
          setShowEditModal(false);
        } else if (prodSearch) {
          setProdSearch("");
          setSelectedProductId("");
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [showShortcutsModal, showShelfAddModal, showCustomerModal, showReceiptModal, showEditModal, prodSearch]);

  // Modal Açıkken Scroll Kilitleme
  useEffect(() => {
    if (showCustomerModal || showReceiptModal || showEditModal || showShortcutsModal || showShelfAddModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showCustomerModal, showReceiptModal, showEditModal, showShortcutsModal, showShelfAddModal]);

  const handleOverlayClick = (_e: React.MouseEvent, _closeFn: (v: boolean) => void) => {
    // Form doldurulurken dış boşluğa kazara tıklanması durumunda modalın kapanması engellendi
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

      // Tekliften Satışa Dönüştürme Kontrolü
      const convertRaw = sessionStorage.getItem("takip_convert_proposal");
      if (convertRaw) {
        try {
          const prop = JSON.parse(convertRaw);
          sessionStorage.removeItem("takip_convert_proposal");

          if (prop.customerId) {
            setSelectedCustomerId(prop.customerId);
          }

          if (prop.items && Array.isArray(prop.items)) {
            const newCart: SaleItem[] = prop.items.map((item: any) => {
              const matched = prodData.find(
                (p) =>
                  p.id === item.productId ||
                  p.name.toLowerCase().trim() === (item.description || "").toLowerCase().trim()
              );
              return {
                productId: matched ? matched.id : item.productId || "serbest-" + Math.random().toString(36).substring(2, 7),
                productName: item.description || (matched ? matched.name : "Hizmet / Kalem"),
                productCode: matched ? matched.barcode || matched.code : "TEKLIF",
                quantity: item.quantity || 1,
                price: item.price || 0,
                costPrice: matched ? (matched as any).costPrice ?? 0 : 0,
                taxRate: item.taxRate ?? (matched ? matched.taxRate ?? 20 : 20),
                total: item.total || (item.quantity || 1) * (item.price || 0)
              };
            });
            setCart(newCart);
          }

          if (prop.discountAmount) setDiscountAmount(prop.discountAmount);
          if (prop.notes) setNotes(prop.notes);
          showToast(`${prop.proposalNo} numaralı teklif satış sepetine aktarıldı.`, "success");
        } catch (e) {
          console.error("Teklif aktarılırken hata:", e);
        }
      }
    } catch (err) {
      console.error("Satış verileri yüklenirken hata:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.role, user?.uid, showToast]);

  const handleRepeatSale = useCallback((sale: Sale) => {
    setSelectedCustomerId(sale.customerId);
    const validItems: SaleItem[] = [];
    let missingCount = 0;

    for (const item of sale.items || []) {
      const currentProd = products.find(p => p.id === item.productId);
      if (currentProd) {
        validItems.push({
          ...item,
          price: currentProd.price,
          taxRate: currentProd.taxRate ?? item.taxRate,
          total: currentProd.price * item.quantity
        });
      } else {
        missingCount++;
      }
    }

    setCart(validItems);
    setDiscountAmount(sale.discountAmount || 0);
    setNotes(sale.notes || "");

    window.scrollTo({ top: 0, behavior: "smooth" });

    if (missingCount > 0) {
      showToast(`Sipariş sepete aktarıldı (${missingCount} ürün stokta bulunmadığı için atlandı).`, "warning");
    } else {
      showToast(`"${sale.receiptNo}" numaralı satış sepetinize aktarıldı.`, "success");
    }
  }, [products, showToast]);

  const handleCustomerChange = useCallback((customerId: string) => {
    setSelectedCustomerId(customerId);
    const cust = customers.find(c => c.id === customerId);
    if (cust?.defaultDiscountRate && cust.defaultDiscountRate > 0) {
      const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
      const calcDiscount = subtotal > 0 ? (subtotal * cust.defaultDiscountRate) / 100 : 0;
      setDiscountAmount(Number(calcDiscount.toFixed(2)));
      showToast(`"${cust.company || cust.name}" için tanımlı %${cust.defaultDiscountRate} sabit iskonto uygulandı.`, "info");
    }
  }, [customers, cart, showToast]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (products.length === 0 || customers.length === 0) return;
    const templateStr = sessionStorage.getItem("repeat_sale_template");
    if (templateStr) {
      try {
        const sale = JSON.parse(templateStr) as Sale;
        sessionStorage.removeItem("repeat_sale_template");
        handleRepeatSale(sale);
      } catch {
        sessionStorage.removeItem("repeat_sale_template");
      }
    }

    const preselectedCustId = sessionStorage.getItem("preselected_customer_id");
    if (preselectedCustId) {
      sessionStorage.removeItem("preselected_customer_id");
      handleCustomerChange(preselectedCustId);
    }
  }, [products, customers, handleRepeatSale, handleCustomerChange]);

  // Hızlı Satış Rafına Ürün Ekle
  const handleAddProductToShelf = (productId: string) => {
    if (shelfProductIds.includes(productId)) return;
    const updated = [...shelfProductIds, productId];
    setShelfProductIds(updated);
    try {
      localStorage.setItem(`takip_pos_shelf_${user?.uid || "default"}`, JSON.stringify(updated));
    } catch (e) {
      console.error("Raf verisi kaydedilemedi:", e);
    }
    const prod = products.find(p => p.id === productId);
    showToast(`"${prod?.name || 'Ürün'}" hızlı satış rafına eklendi.`, "success");
  };

  // Hızlı Satış Rafından Ürün Kaldır (-)
  const handleRemoveProductFromShelf = (productId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = shelfProductIds.filter(id => id !== productId);
    setShelfProductIds(updated);
    try {
      localStorage.setItem(`takip_pos_shelf_${user?.uid || "default"}`, JSON.stringify(updated));
    } catch (e) {
      console.error("Raf verisi kaydedilemedi:", e);
    }
    const prod = products.find(p => p.id === productId);
    showToast(`"${prod?.name || 'Ürün'}" hızlı satış rafından kaldırıldı.`, "info");
  };

  // Hızlı Satış Rafındaki Ürünler (Başlangıçta tamamen boştur, kullanıcı ekledikçe dolar)
  const shelfProducts = useMemo(() => {
    return products.filter((p) => shelfProductIds.includes(p.id));
  }, [products, shelfProductIds]);

  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "1.5rem" }} className="grid-cols-2 animate-fade">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem", minHeight: "130px" }}>
            <div className="skeleton" style={{ width: "160px", height: "20px" }} />
            <div className="skeleton" style={{ width: "100%", height: "42px", borderRadius: "6px" }} />
          </div>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem", minHeight: "280px" }}>
            <div className="skeleton" style={{ width: "200px", height: "20px" }} />
            <div className="skeleton" style={{ width: "100%", height: "180px", borderRadius: "8px" }} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem", minHeight: "220px" }}>
            <div className="skeleton" style={{ width: "140px", height: "20px" }} />
            <div className="skeleton" style={{ width: "100%", height: "42px", borderRadius: "6px" }} />
            <div className="skeleton" style={{ width: "100%", height: "42px", borderRadius: "6px" }} />
          </div>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem", minHeight: "180px" }}>
            <div className="skeleton" style={{ width: "100%", height: "40px" }} />
            <div className="skeleton" style={{ width: "100%", height: "50px", borderRadius: "8px" }} />
          </div>
        </div>
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

  // Hızlı Ürün Butonuna Tıklandığında Sepete Ekle (+1)
  const handleQuickAddProduct = (prod: Product) => {
    if (prod.stock <= 0) {
      showToast(`"${prod.name}" ürününün stoğu tükenmiştir!`, "warning");
      return;
    }

    const existingIndex = cart.findIndex(item => item.productId === prod.id);
    const currentCartQty = existingIndex !== -1 ? cart[existingIndex].quantity : 0;

    if (currentCartQty + 1 > prod.stock) {
      showToast(`Stokta sadece ${prod.stock} adet var. Sepetinizde zaten ${currentCartQty} adet bulunuyor.`, "warning");
      return;
    }

    if (existingIndex !== -1) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += 1;
      updatedCart[existingIndex].total = updatedCart[existingIndex].quantity * prod.price;
      setCart(updatedCart);
    } else {
      setCart([
        ...cart,
        {
          productId: prod.id,
          productName: prod.name,
          productCode: prod.code,
          quantity: 1,
          price: prod.price,
          costPrice: (prod as any).costPrice ?? 0,
          taxRate: (prod as any).taxRate ?? 20,
          total: prod.price
        }
      ]);
    }

    showToast(`+1 "${prod.name}" sepete eklendi.`, "success");
  };

  // Sepeti Temizleme
  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm("Sepetteki tüm ürünleri boşaltmak istediğinize emin misiniz?")) {
      setCart([]);
      setDiscountAmount(0);
      showToast("Sepet temizlendi.", "info");
    }
  };

  const handleUpdateQuantity = (idx: number, delta: number) => {
    const item = cart[idx];
    if (!item) return;
    const prod = products.find(p => p.id === item.productId);
    const maxStock = prod ? prod.stock : 999999;
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
      handleRemoveFromSepet(idx);
      return;
    }

    if (newQty > maxStock) {
      showToast(`Stokta sadece ${maxStock} adet var.`, "warning");
      return;
    }

    const updatedCart = [...cart];
    updatedCart[idx].quantity = newQty;
    updatedCart[idx].total = newQty * item.price;
    setCart(updatedCart);
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
      showToast("Lütfen 1. Adımdan bir Müşteri / Firma seçin.", "warning");
      return;
    }
    if (cart.length === 0) {
      showToast("Sepetiniz boş! Lütfen sağ panelden sepete en az bir ürün ekleyin.", "warning");
      return;
    }

    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer) {
      showToast("Seçilen müşteri sistemde bulunamadı. Lütfen tekrar seçin.", "warning");
      return;
    }
    if (!user) {
      showToast("Oturum süresi dolmuş olabilir. Lütfen sayfayı yenileyin.", "error");
      return;
    }

    setSubmitting(true);

    const saleData = {
      salespersonId: user.uid,
      salespersonName: user.displayName,
      customerId: customer.id,
      customerName: customer.name,
      customerCompany: customer.company,
      items: cart,
      notes,
      paymentMethod,
      paymentDueDate: paymentMethod === "check" ? paymentDueDate : undefined,
      checkNumber: paymentMethod === "check" ? checkNumber : undefined,
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
      setPaymentMethod("open_account");
      setCheckNumber("");
      setPaymentDueDate("");

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
    const printElement = document.querySelector(".print-area") as HTMLElement;
    if (!printElement) {
      window.print();
      return;
    }

    // Capture canvas if any (for barcodes) before cloning
    const canvases = printElement.querySelectorAll("canvas");
    const canvasDataUrls: string[] = [];
    canvases.forEach(canvas => {
      try {
        canvasDataUrls.push(canvas.toDataURL());
      } catch {
        canvasDataUrls.push("");
      }
    });

    // Clone element
    const cloned = printElement.cloneNode(true) as HTMLElement;
    const clonedCanvases = cloned.querySelectorAll("canvas");
    clonedCanvases.forEach((canvas, index) => {
      if (canvasDataUrls[index]) {
        const img = document.createElement("img");
        img.src = canvasDataUrls[index];
        img.style.display = "block";
        img.style.margin = "0 auto";
        img.style.maxHeight = "40px";
        canvas.parentNode?.replaceChild(img, canvas);
      }
    });

    // Create or reuse hidden iframe
    let iframe = document.getElementById("receipt-print-frame") as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "receipt-print-frame";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Satış Fişi - ${lastCreatedSale?.receiptNo || ""}</title>
          <style>
            @page {
              size: auto;
              margin: 8mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 13px;
              color: #000000;
              background-color: #ffffff;
              padding: 10px;
            }
            .print-wrapper {
              max-width: 480px;
              margin: 0 auto;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            img {
              max-width: 100%;
            }
          </style>
        </head>
        <body>
          <div class="print-wrapper">
            ${cloned.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 250);
  };

  const filteredProducts = products.filter(p => {
    const search = (prodSearch || "").toLowerCase();
    const nameMatch = (p.name || "").toLowerCase().includes(search);
    const codeMatch = (p.code || "").toLowerCase().includes(search);
    const barcodeMatch = (p as any).barcode ? String((p as any).barcode).toLowerCase().includes(search) : false;
    return nameMatch || codeMatch || barcodeMatch;
  });

  if (!user) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }} className="animate-fade print-hidden">

      {/* --- HIZLI POS KLAVYE KISAYOLLARI BİLGİ ŞERİDİ --- */}
      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.6rem 1rem",
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-md)",
          flexWrap: "wrap",
          gap: "0.5rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: "0.3rem", marginRight: "0.35rem" }}>
            <Zap size={16} /> <span>HIZLI KASA POS</span>
          </span>

          <span
            className="shortcut-badge"
            onClick={() => {
              prodSearchInputRef.current?.focus();
              prodSearchInputRef.current?.select();
            }}
            title="Barkod veya Ürün Arama alanına odaklan (F2)"
          >
            <kbd>F2</kbd> <span>Ürün / Barkod Ara</span>
          </span>

          <span
            className="shortcut-badge"
            onClick={() => customerSelectRef.current?.focus()}
            title="Müşteri seçim alanına odaklan (F4)"
          >
            <kbd>F4</kbd> <span>Müşteri Seç</span>
          </span>

          <span
            className="shortcut-badge"
            onClick={() => {
              discountInputRef.current?.focus();
              discountInputRef.current?.select();
            }}
            title="İskonto / İndirim tutarı alanına odaklan (F8)"
          >
            <kbd>F8</kbd> <span>İskonto</span>
          </span>

          <span
            className="shortcut-badge"
            onClick={() => submitButtonRef.current?.click()}
            title="Satış kaydını onaya gönder (Ctrl+Enter / F9)"
          >
            <kbd>Ctrl+Enter</kbd> <span>Satışı Tamamla</span>
          </span>

          <span
            className="shortcut-badge"
            onClick={() => {
              setProdSearch("");
              setSelectedProductId("");
            }}
            title="Aramayı temizle veya pencereleri kapat (ESC)"
          >
            <kbd>ESC</kbd> <span>Temizle</span>
          </span>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShowShortcutsModal(true)}
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.55rem", gap: "0.35rem" }}
          title="Klavye Kısayolları Kılavuzunu Aç (F1)"
        >
          <Keyboard size={14} /> <span>Kısayollar [F1]</span>
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "1.5rem" }} className="grid-cols-2">

        {showScanner && (
          <BarcodeScanner
            onDetected={handleBarcodeDetected}
            onClose={() => setShowScanner(false)}
          />
        )}

        {/* SOL TARAF: Satış Formu ve Sepet */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

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
              <label className="form-label">Müşteri Seçin (Kısayol: F4)</label>
              <select
                ref={customerSelectRef}
                className="form-control"
                value={selectedCustomerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                required
              >
                <option value="">-- Firma veya Müşteri Seçin --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.company} ({c.name}) {c.defaultDiscountRate && c.defaultDiscountRate > 0 ? `[%${c.defaultDiscountRate} İskonto]` : ""}
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{cust.company}</div>
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                      {cust.defaultDiscountRate && cust.defaultDiscountRate > 0 ? (
                        <span className="badge badge-primary" style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                          %{cust.defaultDiscountRate} Sabit İskonto
                        </span>
                      ) : null}
                      {typeof cust.currentBalance === "number" && (
                        <span
                          className={`badge badge-${cust.currentBalance > 0 ? "danger" : cust.currentBalance < 0 ? "success" : "secondary"}`}
                          style={{ fontSize: "0.72rem", fontWeight: 700 }}
                        >
                          Cari Bakiye: {formatCurrency(cust.currentBalance)} {cust.currentBalance > 0 ? "(Borçlu)" : cust.currentBalance < 0 ? "(Alacaklı)" : "(Dengeli)"}
                        </span>
                      )}
                    </div>
                  </div>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600 }}>
              2. Satış Kalemleri (Sepet) {cart.length > 0 && <span className="badge badge-primary" style={{ fontSize: "0.75rem", marginLeft: "0.4rem" }}>{cart.length} Kalem</span>}
            </h3>
            {cart.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleClearCart}
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.55rem", color: "var(--danger)", gap: "0.3rem" }}
                title="Sepetteki tüm ürünleri boşalt"
              >
                <Trash2 size={13} /> <span>Sepeti Boşalt</span>
              </button>
            )}
          </div>

          <div className="table-container" style={{ flex: 1, minHeight: "200px" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th style={{ textAlign: "right" }}>B. Fiyat</th>
                  <th style={{ textAlign: "center", width: "120px" }}>Miktar</th>
                  <th style={{ textAlign: "center" }}>KDV (%)</th>
                  <th style={{ textAlign: "right" }}>Toplam</th>
                  <th style={{ width: "44px" }}></th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "2rem 1rem" }}>
                      <EmptyState
                        icon={ShoppingCart}
                        title="Sepetiniz Boş"
                        description="Sağ paneldeki ürün arama alanından veya barkod okutarak sepete ürün ekleyebilirsiniz."
                      />
                    </td>
                  </tr>
                ) : (
                  cart.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.productName}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{item.productCode}</div>
                      </td>
                      <td style={{ textAlign: "right" }}>{formatCurrency(item.price)}</td>
                      <td style={{ textAlign: "center" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            backgroundColor: "var(--bg-tertiary)",
                            padding: "2px 6px",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--border-color)"
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(idx, -1)}
                            style={{
                              width: "22px",
                              height: "22px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "3px",
                              border: "1px solid var(--border-color)",
                              background: "var(--bg-secondary)",
                              cursor: "pointer",
                              fontSize: "14px",
                              fontWeight: 700,
                              lineHeight: 1
                            }}
                            title="1 Azalt"
                          >
                            -
                          </button>
                          <span style={{ minWidth: "24px", textAlign: "center", fontWeight: 700, fontSize: "0.88rem" }}>
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(idx, +1)}
                            style={{
                              width: "22px",
                              height: "22px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "3px",
                              border: "1px solid var(--border-color)",
                              background: "var(--bg-secondary)",
                              cursor: "pointer",
                              fontSize: "14px",
                              fontWeight: 700,
                              lineHeight: 1
                            }}
                            title="1 Artır"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>%{item.taxRate}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--primary)" }}>{formatCurrency(item.total)}</td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromSepet(idx)}
                          style={{ color: "var(--danger)", cursor: "pointer", padding: "0.25rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                          title="Ürünü Sepetten Çıkar"
                        >
                          <Trash2 size={15} />
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Son Satışlarınız ({salesHistory.length})</h3>
            {salesHistory.length > 5 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAllHistory(!showAllHistory)}
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
              >
                {showAllHistory ? "Son 5 Kaydı Göster" : "Tümünü Göster"}
              </button>
            )}
          </div>

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
                  <th style={{ width: "130px", textAlign: "center" }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {salesHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "1.5rem 1rem" }}>
                      <EmptyState
                        icon={FileText}
                        title="Geçmiş Satış Kaydı Yok"
                        description="Oluşturduğunuz satışlar onaylandığında veya beklemeye alındığında burada listelenir."
                      />
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const sorted = getSortedHistory(salesHistory);
                    const displayed = showAllHistory ? sorted : sorted.slice(0, 5);
                    return displayed.map((sale) => (
                      <tr key={sale.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{sale.receiptNo}</div>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                            {formatDate(sale.date)}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sale.customerCompany}>
                            {sale.customerCompany}
                          </div>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>
                          {formatCurrency(sale.netAmount)}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className={`badge badge-${sale.status === 'approved' ? 'success' : sale.status === 'rejected' ? 'danger' : 'warning'}`} style={{ fontSize: "0.6rem", padding: "0.15rem 0.35rem" }}>
                            {sale.status === 'approved' ? 'Onaylandı' : sale.status === 'rejected' ? 'Reddedildi' : 'Bekliyor'}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "0.3rem", justifyContent: "center" }}>
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
                            <button
                              type="button"
                              className="btn btn-secondary btn-icon btn-sm"
                              onClick={() => handleRepeatSale(sale)}
                              title="Siparişi Tekrarla (Sepete Aktar)"
                              style={{ padding: "0.35rem" }}
                              aria-label="Siparişi Tekrarla"
                            >
                              <RotateCcw size={14} />
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
                    ));
                  })()
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* SAĞ TARAF: Hızlı Ürünler, Ürün Arama ve Satış Özeti */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="print-hidden">

        {/* ⚡ HIZLI SATIŞ RAFI */}
        <section className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Zap size={18} color="var(--primary)" />
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700 }}>Hızlı Satış Rafı</h3>
              {shelfProducts.length > 0 && (
                <span className="badge badge-primary" style={{ fontSize: "0.72rem" }}>
                  {shelfProducts.length} Ürün
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowShelfAddModal(true)}
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem", gap: "0.35rem" }}
              title="Hızlı satış rafına yeni ürün ekleyin"
            >
              <PlusCircle size={14} color="var(--primary)" /> <span>+ Hızlı Ürün Ekle</span>
            </button>
          </div>

          {/* Raf Butonları Izgarası */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(135px, 1fr))", gap: "0.5rem", minHeight: "85px", maxHeight: "220px", overflowY: "auto" }}>
            {shelfProducts.length === 0 ? (
              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: "1.5rem 1rem",
                  textAlign: "center",
                  backgroundColor: "var(--bg-tertiary)",
                  borderRadius: "var(--radius-sm)",
                  border: "1.5px dashed var(--border-color)",
                  fontSize: "0.85rem",
                  color: "var(--text-muted)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.6rem"
                }}
              >
                <span>Hızlı satış rafınız şu an boş. Sık sattığınız ürünleri ekleyerek tek tıkla sepete atabilirsiniz.</span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowShelfAddModal(true)}
                  style={{ fontSize: "0.78rem", padding: "0.35rem 0.8rem", gap: "0.35rem" }}
                >
                  <PlusCircle size={15} /> <span>+ Hızlı Ürün Ekle</span>
                </button>
              </div>
            ) : (
              <>
                {shelfProducts.map((p) => {
                  const inCart = cart.find((item) => item.productId === p.id);
                  const isOutOfStock = (p.stock ?? 0) <= 0;
                  return (
                    <div
                      key={p.id}
                      onClick={() => !isOutOfStock && handleQuickAddProduct(p)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        padding: "0.6rem 0.65rem",
                        backgroundColor: inCart ? "rgba(15, 82, 186, 0.09)" : "var(--bg-tertiary)",
                        border: inCart ? "1.5px solid var(--primary)" : "1px solid var(--border-color)",
                        borderRadius: "var(--radius-sm)",
                        cursor: isOutOfStock ? "not-allowed" : "pointer",
                        textAlign: "left",
                        opacity: isOutOfStock ? 0.55 : 1,
                        position: "relative",
                        minHeight: "78px",
                        transition: "all 0.12s ease",
                        userSelect: "none"
                      }}
                      title={isOutOfStock ? "Tükendi" : `${p.name} (+1 sepete ekle)`}
                    >
                      {/* Sepet Miktarı Rozeti */}
                      {inCart && (
                        <span
                          style={{
                            position: "absolute",
                            top: "4px",
                            left: "4px",
                            backgroundColor: "var(--primary)",
                            color: "#fff",
                            borderRadius: "50%",
                            width: "18px",
                            height: "18px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.65rem",
                            fontWeight: 800
                          }}
                        >
                          {inCart.quantity}
                        </span>
                      )}

                      {/* Sağ Üst: Raftan Kaldırma Butonu (-) */}
                      <button
                        type="button"
                        onClick={(e) => handleRemoveProductFromShelf(p.id, e)}
                        style={{
                          position: "absolute",
                          top: "4px",
                          right: "4px",
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          backgroundColor: "rgba(239, 68, 68, 0.12)",
                          color: "var(--danger)",
                          border: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          padding: 0,
                          fontSize: "0.85rem",
                          fontWeight: 900,
                          transition: "all 0.12s ease"
                        }}
                        title="Bu ürünü hızlı satış rafından kaldır (-)"
                        aria-label="Raftan kaldır"
                      >
                        <Minus size={13} strokeWidth={3} />
                      </button>

                      {/* Ürün İsmi */}
                      <div style={{
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        lineHeight: 1.2,
                        paddingTop: inCart ? "14px" : "0",
                        paddingRight: "22px"
                      }}>
                        {p.name}
                      </div>

                      {/* Fiyat ve Stok */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "0.35rem" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--primary)" }}>
                          {formatCurrency(p.price || 0)}
                        </span>
                        <span style={{ fontSize: "0.65rem", fontWeight: 600, color: isOutOfStock ? "var(--danger)" : "var(--text-muted)" }}>
                          {isOutOfStock ? "Tükendi" : `${p.stock ?? 0} Stk`}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Rafın Sonundaki "+ Ekle" Butonu */}
                <button
                  type="button"
                  onClick={() => setShowShelfAddModal(true)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.35rem",
                    padding: "0.6rem 0.65rem",
                    border: "1.5px dashed var(--border-color)",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "transparent",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    minHeight: "78px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    transition: "all 0.15s ease"
                  }}
                  title="Hızlı satış rafına yeni ürün ekleyin"
                >
                  <PlusCircle size={18} color="var(--primary)" />
                  <span>+ Ürün Ekle</span>
                </button>
              </>
            )}
          </div>
        </section>

        {/* Ürün Arama & Ekleme */}
        <section className="card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>Ürün Ara & Ekle (Kısayol: F2)</h3>

          <div className="form-group">
            <label className="form-label">Ürün Arama (İsim, Kod veya Barkod)</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                  <Search size={16} />
                </span>
                <input
                  ref={prodSearchInputRef}
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: "2.25rem" }}
                  placeholder="Ürün adı, barkod okutun veya Enter'a basın..."
                  value={prodSearch}
                  onChange={(e) => setProdSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (selectedProductId) {
                        handleAddToSepet();
                      } else if (filteredProducts.length === 1) {
                        handleQuickAddProduct(filteredProducts[0]);
                        setProdSearch("");
                      } else if (prodSearch.trim()) {
                        const exactMatch = products.find(p =>
                          p.code.toLowerCase() === prodSearch.trim().toLowerCase() ||
                          ((p as any).barcode && (p as any).barcode.toLowerCase() === prodSearch.trim().toLowerCase())
                        );
                        if (exactMatch) {
                          handleQuickAddProduct(exactMatch);
                          setProdSearch("");
                        }
                      }
                    }
                  }}
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
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <ScanLine size={18} />
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Ürün Listesinden Seçin</label>
            <select
              className="form-control"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              <option value="">-- Listeden Ürün Seçin --</option>
              {filteredProducts.map(p => (
                <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                  {p.name} ({p.code}) - {formatCurrency(p.price)} {p.stock <= 0 ? "[TÜKENDİ]" : `[Stok: ${p.stock} ${p.unit || 'Adet'}]`}
                </option>
              ))}
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
              <span style={{ fontWeight: 600 }}>{formatCurrency(totalBeforeTaxAndDiscount)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-secondary)" }}>Toplam KDV</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(taxAmount)}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "0.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-secondary)" }}>İndirim / İskonto (F8)</span>
                <input
                  ref={discountInputRef}
                  type="number"
                  min="0"
                  style={{ width: "110px", padding: "0.25rem 0.5rem", textAlign: "right" }}
                  className="form-control"
                  placeholder="0.00"
                  value={discountAmount || ""}
                  onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                />
              </div>
              {(() => {
                const cust = customers.find(c => c.id === selectedCustomerId);
                if (!cust?.defaultDiscountRate || cust.defaultDiscountRate <= 0) return null;
                return (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem", padding: "0.3rem 0.5rem", backgroundColor: "rgba(99, 102, 241, 0.08)", borderRadius: "var(--radius-sm)" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 600 }}>
                      🏷️ Müşteri İskontosu: %{cust.defaultDiscountRate}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: "0.15rem 0.45rem", fontSize: "0.7rem" }}
                      onClick={() => {
                        const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
                        const calc = (subtotal * (cust.defaultDiscountRate || 0)) / 100;
                        setDiscountAmount(Number(calc.toFixed(2)));
                      }}
                    >
                      Uygula
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>Net Toplam (Ödenecek)</span>
            <span style={{ fontWeight: 800, fontSize: "1.35rem", color: "var(--primary)" }}>
              {formatCurrency(netAmount)}
            </span>
          </div>

          {/* Ödeme Yöntemi */}
          <div className="form-group" style={{ marginBottom: "1rem" }}>
            <label className="form-label" style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <CreditCard size={15} /> Ödeme Şekli
            </label>
            <select
              className="form-control"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            >
              <option value="open_account">Açık Hesap (Cari / Veresiye)</option>
              <option value="cash">Nakit (Peşin)</option>
              <option value="credit_card">Kredi Kartı / POS (Peşin)</option>
              <option value="bank_transfer">Banka Havalesi / EFT</option>
              <option value="check">Çek / Senet</option>
            </select>
          </div>

          {paymentMethod === "check" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1rem" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: "0.75rem" }}>Çek / Senet No</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: "0.8rem", padding: "0.3rem 0.5rem" }}
                  placeholder="Çek No"
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: "0.75rem" }}>Vade Tarihi</label>
                <input
                  type="date"
                  className="form-control"
                  style={{ fontSize: "0.8rem", padding: "0.3rem 0.5rem" }}
                  value={paymentDueDate}
                  onChange={(e) => setPaymentDueDate(e.target.value)}
                />
              </div>
            </div>
          )}

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
            ref={submitButtonRef}
            type="button"
            className="btn btn-success"
            onClick={handleCreateSaleSubmit}
            style={{
              width: "100%",
              height: "48px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              opacity: (cart.length === 0 || !selectedCustomerId) ? 0.75 : 1,
              cursor: submitting ? "not-allowed" : "pointer"
            }}
            disabled={submitting}
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

      {/* 2 Sütunlu Izgara Kapanışı */}
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
        <div className="modal-overlay">
          <div className="modal-content animate-slide-up" style={{ maxWidth: "480px", backgroundColor: "#fff", color: "#000" }} role="dialog" aria-modal="true">
            <div className="modal-header print-hidden" style={{ borderBottom: "1px solid #eee", backgroundColor: "#f8fafc" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>Satış Fişi / PDF Çıktısı</h3>
              <button onClick={() => setShowReceiptModal(false)} style={{ cursor: "pointer", fontSize: "1.25rem", color: "#000" }} aria-label="Kapat">&times;</button>
            </div>

            <div className="modal-body print-area" style={{ padding: "2rem", fontSize: "0.85rem", color: "#000", fontFamily: "'Courier New', Courier, monospace" }}>

              <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                <img
                  src="/logo.svg"
                  alt="Özkon Yapı Logo"
                  style={{
                    height: "45px",
                    objectFit: "contain",
                    display: "block",
                    margin: "0 auto 0.75rem auto"
                  }}
                />
                <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, fontFamily: "sans-serif" }}>
                  {companyProfile?.companyName || "ÖZKON YAPI"}
                </h2>
                <div style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
                  {companyProfile?.address || "Merkez Mah. Sanayi Bulvarı No: 45 Sarıyer / İstanbul"}
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
                <div><strong>Ödeme Şekli:</strong> {PAYMENT_METHOD_LABELS[lastCreatedSale.paymentMethod || "open_account"]} {lastCreatedSale.checkNumber ? `(Çek No: ${lastCreatedSale.checkNumber})` : ""}</div>
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


      {/* --- REDDEDİLEN SATIŞ DÜZENLEME MODALI --- */}
      {showEditModal && editSale && (() => {
        // NOT: Aynı computeSaleTotals fonksiyonu burada da kullanılıyor;
        // eskiden burada KDV'yi tutarın İÇİNDEN çıkaran farklı bir formül
        // vardı (bkz. dosya başındaki not), bu da resubmitSale çağrısından
        // önce kullanıcıya YANLIŞ bir önizleme gösteriyordu.
        const { taxAmount: editTaxAmount, netAmount: editNetAmount } =
          computeSaleTotals(editCart, editDiscount);
        const filteredEditProducts = products.filter(p =>
          p.name.toLowerCase().includes(editProdSearch.toLowerCase()) ||
          p.code.toLowerCase().includes(editProdSearch.toLowerCase()) ||
          ((p as any).barcode && (p as any).barcode.toLowerCase().includes(editProdSearch.toLowerCase()))
        );
        return (
          <div className="modal-overlay">
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
                        <span>{formatCurrency(editTaxAmount)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                        <span>Net Toplam</span>
                        <span style={{ color: "var(--primary)", fontSize: "1rem" }}>{formatCurrency(editNetAmount)}</span>
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

      {/* --- KLAVYE KISAYOLLARI YARDIM MODALI (F1) --- */}
      {showShortcutsModal && (
        <div className="modal-overlay" onClick={() => setShowShortcutsModal(false)}>
          <div
            className="modal-content animate-slide-up"
            style={{ maxWidth: "520px" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Keyboard size={20} color="var(--primary)" />
                <span>Hızlı Kasa & Klavye Kısayolları</span>
              </h3>
              <button
                onClick={() => setShowShortcutsModal(false)}
                style={{ cursor: "pointer", fontSize: "1.25rem" }}
                aria-label="Kapat"
              >
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>
                Satış işlemlerini fareye dokunmadan, ışık hızında tamamlamak için aşağıdaki klavye kısayollarını kullanabilirsiniz:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0.8rem", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>Barkod / Ürün Arama Alanına Odaklan</div>
                  <kbd style={{ backgroundColor: "var(--bg-primary)", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--border-color)", fontWeight: 800, fontSize: "0.8rem" }}>F2</kbd>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0.8rem", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>Müşteri Seçim Alanına Odaklan</div>
                  <kbd style={{ backgroundColor: "var(--bg-primary)", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--border-color)", fontWeight: 800, fontSize: "0.8rem" }}>F4</kbd>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0.8rem", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>İskonto / İndirim Alanına Odaklan</div>
                  <kbd style={{ backgroundColor: "var(--bg-primary)", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--border-color)", fontWeight: 800, fontSize: "0.8rem" }}>F8</kbd>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0.8rem", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>Satışı Onaya Gönder & Tamamla</div>
                  <div style={{ display: "flex", gap: "0.3rem" }}>
                    <kbd style={{ backgroundColor: "var(--bg-primary)", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--border-color)", fontWeight: 800, fontSize: "0.8rem" }}>Ctrl + Enter</kbd>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>veya</span>
                    <kbd style={{ backgroundColor: "var(--bg-primary)", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--border-color)", fontWeight: 800, fontSize: "0.8rem" }}>F9</kbd>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0.8rem", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>Arama Sıfırla / Modalları Kapat</div>
                  <kbd style={{ backgroundColor: "var(--bg-primary)", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--border-color)", fontWeight: 800, fontSize: "0.8rem" }}>ESC</kbd>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0.8rem", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>Kısayol Kılavuzunu Aç / Kapat</div>
                  <kbd style={{ backgroundColor: "var(--bg-primary)", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--border-color)", fontWeight: 800, fontSize: "0.8rem" }}>F1</kbd>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0.8rem", backgroundColor: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>Aramada Barkod Okutulduğunda</div>
                  <span style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 700 }}>Otomatik Sepete Ekler</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowShortcutsModal(false)}
                style={{ width: "100%" }}
              >
                Anladım, Kapat (ESC)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- HIZLI SATIŞ RAFINA ÜRÜN EKLE MODALI --- */}
      {showShelfAddModal && (
        <div className="modal-overlay" onClick={() => setShowShelfAddModal(false)}>
          <div
            className="modal-content animate-slide-up"
            style={{ maxWidth: "620px", maxHeight: "85vh", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <PlusCircle size={20} color="var(--primary)" />
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Hızlı Satış Rafına Ürün Ekle</h3>
              </div>
              <button
                onClick={() => setShowShelfAddModal(false)}
                style={{ cursor: "pointer", fontSize: "1.25rem" }}
                aria-label="Kapat"
              >
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "1rem", overflowY: "auto" }}>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>
                Hızlı satış rafınızda yer almasını istediğiniz ürüne tıklayarak ekleyin:
              </p>

              {/* Arama Kutusu */}
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: "2.25rem" }}
                  placeholder="Rafa eklenecek ürün adı veya kodu ara..."
                  value={shelfSearch}
                  onChange={(e) => setShelfSearch(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Ürün Listesi */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "350px", overflowY: "auto", paddingRight: "2px" }}>
                {products
                  .filter((p) => {
                    const s = shelfSearch.toLowerCase();
                    return (
                      (p.name || "").toLowerCase().includes(s) ||
                      (p.code || "").toLowerCase().includes(s) ||
                      ((p as any).categoryName || "").toLowerCase().includes(s)
                    );
                  })
                  .map((p) => {
                    const isOnShelf = shelfProductIds.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (isOnShelf) {
                            handleRemoveProductFromShelf(p.id);
                          } else {
                            handleAddProductToShelf(p.id);
                          }
                        }}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.65rem 0.85rem",
                          backgroundColor: isOnShelf ? "rgba(15, 82, 186, 0.08)" : "var(--bg-tertiary)",
                          border: isOnShelf ? "1.5px solid var(--primary)" : "1px solid var(--border-color)",
                          borderRadius: "var(--radius-sm)",
                          cursor: "pointer",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-primary)" }}>{p.name}</div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              {p.code} • {p.stock ?? 0} {p.unit || "Adet"} Stok
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--primary)" }}>{formatCurrency(p.price || 0)}</div>
                          </div>
                          {isOnShelf ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.3rem",
                                padding: "0.25rem 0.6rem",
                                backgroundColor: "rgba(239, 68, 68, 0.12)",
                                color: "var(--danger)",
                                borderRadius: "var(--radius-sm)",
                                fontSize: "0.75rem",
                                fontWeight: 700
                              }}
                            >
                              <Minus size={12} strokeWidth={3} /> Rafta (Çıkar)
                            </span>
                          ) : (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.3rem",
                                padding: "0.25rem 0.6rem",
                                backgroundColor: "var(--primary)",
                                color: "#fff",
                                borderRadius: "var(--radius-sm)",
                                fontSize: "0.75rem",
                                fontWeight: 700
                              }}
                            >
                              <Plus size={12} strokeWidth={3} /> Rafa Ekle
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
                Rafta Toplam <strong>{shelfProductIds.length}</strong> ürün bulunuyor.
              </span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowShelfAddModal(false)}
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Sales;
