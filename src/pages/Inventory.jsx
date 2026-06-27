// Takip Sistemi - Ürün ve Stok Yönetimi (Inventory)
import React, { useState, useEffect } from "react";
import { 
  getProducts, 
  getCategories, 
  addProduct, 
  updateProduct, 
  deleteProduct, 
  addCategory 
} from "../services/db";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import * as XLSX from "xlsx";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  AlertTriangle,
  FolderPlus,
  Download,
  Upload,
  FileSpreadsheet
} from "lucide-react";

const Inventory = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  // Data States
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sorting and Validation States
  const [sortField, setSortField] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [errors, setErrors] = useState({});

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [filterCriticalOnly, setFilterCriticalOnly] = useState(false);

  // Modals States
  const [showProductModal, setShowProductModal] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // "add" | "edit"
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productForm, setProductForm] = useState({
    code: "", name: "", categoryId: "", price: 0, stock: 0, criticalStock: 5, unit: "Adet"
  });

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });

  // Excel Import States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    fetchInventoryData();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowProductModal(false);
        setShowCategoryModal(false);
      }
    };
    if (showProductModal || showCategoryModal) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [showProductModal, showCategoryModal]);

  const handleOverlayClick = (e, closeFn) => {
    if (e.target.className === "modal-overlay") {
      closeFn(false);
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

  const fetchInventoryData = async () => {
    try {
      const [prodData, catData] = await Promise.all([
        getProducts(),
        getCategories()
      ]);
      setProducts(prodData);
      setCategories(catData);
    } catch (err) {
      console.error("Stok verileri yüklenirken hata:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade">
        <section className="card" style={{ height: "80px" }}>
          <div className="skeleton-row" style={{ width: "20%" }} />
        </section>
        <section className="card">
          <div className="skeleton-loader-container">
            <div className="skeleton-row title" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        </section>
      </div>
    );
  }

  // --- ÜRÜN CRUD İŞLEMLERİ ---
  const handleOpenAddProduct = () => {
    setModalMode("add");
    setProductForm({
      code: "",
      name: "",
      categoryId: categories[0]?.id || "",
      price: 0,
      costPrice: 0,
      taxRate: 20,
      barcode: "",
      stock: 0,
      criticalStock: 5,
      unit: "Adet"
    });
    setErrors({});
    setShowProductModal(true);
  };

  const handleOpenEditProduct = (prod) => {
    setModalMode("edit");
    setSelectedProductId(prod.id);
    setProductForm({
      code: prod.code,
      name: prod.name,
      categoryId: prod.categoryId,
      price: prod.price,
      costPrice: prod.costPrice ?? 0,
      taxRate: prod.taxRate ?? 20,
      barcode: prod.barcode || "",
      stock: prod.stock,
      criticalStock: prod.criticalStock,
      unit: prod.unit || "Adet"
    });
    setErrors({});
    setShowProductModal(true);
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    
    // Validasyon
    const newErrors = {};
    if (!productForm.code.trim()) {
      newErrors.code = "Ürün kodu boş bırakılamaz.";
    } else if (productForm.code.trim().length < 3) {
      newErrors.code = "Ürün kodu en az 3 karakter olmalıdır.";
    }
    
    if (!productForm.name.trim()) {
      newErrors.name = "Ürün adı boş bırakılamaz.";
    }
    
    if (parseFloat(productForm.price) < 0) {
      newErrors.price = "Birim fiyat negatif olamaz.";
    }
    
    if (parseInt(productForm.stock) < 0) {
      newErrors.stock = "Mevcut stok miktarı negatif olamaz.";
    }
    
    if (parseInt(productForm.criticalStock) < 0) {
      newErrors.criticalStock = "Kritik limit negatif olamaz.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showToast("Lütfen form alanlarındaki hataları düzeltin.", "warning");
      return;
    }

    // Kategori ismini bul
    const cat = categories.find(c => c.id === productForm.categoryId);
    const categoryName = cat ? cat.name : "Kategorisiz";

    const payload = {
      ...productForm,
      price: parseFloat(productForm.price) || 0,
      costPrice: parseFloat(productForm.costPrice) || 0,
      taxRate: parseInt(productForm.taxRate, 10) || 20,
      stock: parseInt(productForm.stock, 10) || 0,
      criticalStock: parseInt(productForm.criticalStock, 10) || 0,
      categoryName
    };

    try {
      if (modalMode === "add") {
        await addProduct(payload, user.uid, user.displayName, user.role);
        showToast("Ürün başarıyla eklendi.", "success");
      } else {
        await updateProduct(selectedProductId, payload, user.uid, user.displayName, user.role);
        showToast("Ürün başarıyla güncellendi.", "success");
      }
      setShowProductModal(false);
      fetchInventoryData();
    } catch (err) {
      showToast("İşlem gerçekleştirilirken hata: " + err.message, "error");
    }
  };

  const handleDeleteProduct = async (prodId, prodName) => {
    if (window.confirm(`"${prodName}" ürününü silmek istediğinize emin misiniz?`)) {
      try {
        await deleteProduct(prodId, user.uid, user.displayName, user.role);
        showToast("Ürün başarıyla silindi.", "success");
        fetchInventoryData();
      } catch (err) {
        showToast("Silinirken hata oluştu: " + err.message, "error");
      }
    }
  };

  // --- KATEGORİ EKLEME ---
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    if (!categoryForm.name) {
      showToast("Kategori adı zorunludur!", "warning");
      return;
    }

    try {
      await addCategory(categoryForm, user.uid, user.displayName, user.role);
      showToast("Yeni Kategori başarıyla oluşturuldu.", "success");
      setShowCategoryModal(false);
      setCategoryForm({ name: "", description: "" });
      fetchInventoryData();
    } catch (err) {
      showToast("Kategori ekleme hatası: " + err.message, "error");
    }
  };

  // --- EXCEL ŞABLONU İNDİR ---
  const handleDownloadTemplate = () => {
    const headers = [
      ["Ürün Kodu*", "Ürün Adı*", "Kategori", "Maliyet Fiyatı", "Satış Fiyatı*", "KDV Oranı (%)", "Stok Miktarı*", "Kritik Stok Sınırı", "Birim", "Barkod"]
    ];
    const example = [
      ["CELIK-001", "Çelik Boru 1 inç", "Çelik Ürünler", 45.00, 75.00, 20, 100, 10, "Metre", "1234567890123"],
      ["CELIK-002", "Çelik Levha 2mm", "Çelik Ürünler", 120.00, 200.00, 20, 50, 5, "Adet", ""]
    ];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...example]);
    // Kolon genişlikleri
    ws["!cols"] = [14, 24, 18, 14, 14, 14, 14, 16, 10, 18].map(w => ({ wch: w }));
    // Header stilini ayarla
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ürünler");
    XLSX.writeFile(wb, "urun_stok_sablonu.xlsx");
  };

  // --- MEVCUT STOĞU EXCEL'E AKTAR ---
  const handleExportCurrentStock = () => {
    const rows = products.map(p => ({
      "Ürün Kodu": p.code,
      "Ürün Adı": p.name,
      "Kategori": p.categoryName || "",
      "Maliyet Fiyatı": p.costPrice ?? 0,
      "Satış Fiyatı": p.price,
      "KDV Oranı (%)": p.taxRate ?? 20,
      "Mevcut Stok": p.stock,
      "Kritik Stok Sınırı": p.criticalStock,
      "Birim": p.unit || "Adet",
      "Barkod": p.barcode || ""
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [14, 24, 18, 14, 14, 14, 14, 16, 10, 18].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stok Listesi");
    XLSX.writeFile(wb, `stok_listesi_${new Date().toLocaleDateString('tr-TR').replace(/\./g, "-")}.xlsx`);
  };

  // --- EXCEL DOSYASI OKU & ÖNİZLE ---
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const wb = XLSX.read(event.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

        const colMap = {
          code: ["Ürün Kodu*", "Ürün Kodu", "Kod", "SKU", "code"],
          name: ["Ürün Adı*", "Ürün Adı", "Ad", "İsim", "name"],
          categoryName: ["Kategori", "category", "Kategori Adı"],
          costPrice: ["Maliyet Fiyatı", "Maliyet", "costPrice"],
          price: ["Satış Fiyatı*", "Satış Fiyatı", "Fiyat", "price"],
          taxRate: ["KDV Oranı (%)", "KDV", "KDV Oranı", "taxRate"],
          stock: ["Stok Miktarı*", "Stok", "Mevcut Stok", "stock"],
          criticalStock: ["Kritik Stok Sınırı", "Kritik Stok", "criticalStock"],
          unit: ["Birim", "unit"],
          barcode: ["Barkod", "barcode"]
        };

        const getVal = (row, aliases) => {
          for (const alias of aliases) {
            if (row[alias] !== undefined && row[alias] !== "") return row[alias];
          }
          return null;
        };

        const parsed = [];
        const errs = [];

        rows.forEach((row, i) => {
          const rowNum = i + 2;
          const code = String(getVal(row, colMap.code) ?? "").trim().toUpperCase();
          const name = String(getVal(row, colMap.name) ?? "").trim();
          const price = parseFloat(getVal(row, colMap.price)) || 0;
          const stock = parseInt(getVal(row, colMap.stock), 10);

          const rowErrs = [];
          if (!code || code.length < 2) rowErrs.push("Ürün kodu eksik/geçersiz");
          if (!name) rowErrs.push("Ürün adı eksik");
          if (isNaN(price) || price < 0) rowErrs.push("Satış fiyatı geçersiz");
          if (isNaN(stock) || stock < 0) rowErrs.push("Stok miktarı geçersiz");

          if (rowErrs.length > 0) {
            errs.push({ row: rowNum, code: code || "?", errors: rowErrs });
            return;
          }

          parsed.push({
            code,
            name,
            categoryName: String(getVal(row, colMap.categoryName) ?? "Kategorisiz").trim() || "Kategorisiz",
            costPrice: parseFloat(getVal(row, colMap.costPrice)) || 0,
            price,
            taxRate: parseInt(getVal(row, colMap.taxRate), 10) || 20,
            stock: isNaN(stock) ? 0 : stock,
            criticalStock: parseInt(getVal(row, colMap.criticalStock), 10) || 5,
            unit: String(getVal(row, colMap.unit) ?? "Adet").trim() || "Adet",
            barcode: String(getVal(row, colMap.barcode) ?? "").trim()
          });
        });

        setImportRows(parsed);
        setImportErrors(errs);
        setImportResult(null);
        setShowImportModal(true);
      } catch (err) {
        showToast("Excel dosyası okunamadı: " + err.message, "error");
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- EXCEL'DEN TOPLU ÜRÜN KAYDET ---
  const handleConfirmImport = async () => {
    if (importRows.length === 0) return;
    setImporting(true);
    let added = 0, updated = 0, failed = 0;

    for (const row of importRows) {
      try {
        // Kategoriye bak
        let cat = categories.find(c => c.name.toLowerCase() === row.categoryName.toLowerCase());
        let categoryId = cat?.id || "";
        let categoryName = cat?.name || row.categoryName;

        // Aynı kodlu ürün var mı?
        const existing = products.find(p => p.code === row.code);
        const payload = {
          code: row.code,
          name: row.name,
          categoryId,
          categoryName,
          costPrice: row.costPrice,
          price: row.price,
          taxRate: row.taxRate,
          stock: row.stock,
          criticalStock: row.criticalStock,
          unit: row.unit,
          barcode: row.barcode
        };

        if (existing) {
          await updateProduct(existing.id, payload, user.uid, user.displayName, user.role);
          updated++;
        } else {
          await addProduct(payload, user.uid, user.displayName, user.role);
          added++;
        }
      } catch {
        failed++;
      }
    }

    setImportResult({ added, updated, failed });
    setImporting(false);
    fetchInventoryData();
  };

  // --- FİLTRELEME MANTIĞI ---
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === "all" || p.categoryId === selectedCategory;
    
    const matchesCritical = !filterCriticalOnly || p.stock <= p.criticalStock;

    return matchesSearch && matchesCategory && matchesCritical;
  }).sort((a, b) => {
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

  if (!user) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade">
      
      {/* Üst İşlem Çubuğu ve Filtreler */}
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        
        {/* İşlem Butonları (Rol bazlı yetkilendirme) */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Stok Kontrol Listesi</h3>
          
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {(user.role === "admin" || user.role === "sysadmin") && (
              <>
                <button className="btn btn-secondary btn-sm" onClick={handleDownloadTemplate} title="Excel şablonu indir">
                  <FileSpreadsheet size={16} />
                  <span>Şablon İndir</span>
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleExportCurrentStock} title="Mevcut stoğu Excel'e aktar">
                  <Download size={16} />
                  <span>Excel'e Aktar</span>
                </button>
                <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer", margin: 0 }} title="Excel'den toplu ürün yükle">
                  <Upload size={16} />
                  <span>Excel'den İçe Aktar</span>
                  <input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleImportFile} />
                </label>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowCategoryModal(true)}>
                  <FolderPlus size={16} />
                  <span>Kategori Ekle</span>
                </button>
              </>
            )}
            <button className="btn btn-primary btn-sm" onClick={handleOpenAddProduct}>
              <Plus size={16} />
              <span>Yeni Ürün Ekle</span>
            </button>
          </div>
        </div>

        <div style={{ borderBottom: "1px solid var(--border-color)", margin: "0.25rem 0" }}></div>

        {/* Filtre Arayüzü */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "1rem" }} className="grid-cols-3">
          {/* Metin Arama */}
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
              <Search size={16} />
            </span>
            <input 
              type="text" 
              className="form-control"
              style={{ paddingLeft: "2.25rem" }}
              placeholder="Ürün adı veya barkod/kod arama..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Kategori Filtresi */}
          <select
            className="form-control"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">Tüm Kategoriler</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Kritik Stok Switcher */}
          <label style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "0.5rem", 
            cursor: "pointer",
            fontWeight: 500,
            fontSize: "0.875rem",
            color: filterCriticalOnly ? "var(--danger)" : "var(--text-secondary)",
            padding: "0.5rem",
            borderRadius: "var(--radius-sm)",
            backgroundColor: filterCriticalOnly ? "var(--danger-light)" : "transparent",
            transition: "all var(--transition-fast)"
          }}>
            <input 
              type="checkbox" 
              checked={filterCriticalOnly} 
              onChange={(e) => setFilterCriticalOnly(e.target.checked)}
              style={{ width: "16px", height: "16px" }}
            />
            <AlertTriangle size={16} />
            <span>Kritik Stok Uyarısı</span>
          </label>
        </div>
      </section>

      {/* Ürün Listesi Tablosu */}
      <section className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th onClick={() => handleSort("code")} style={{ cursor: "pointer" }}>
                  KOD / Barkod {sortField === "code" ? (sortOrder === "asc" ? " ▲" : " ▼") : ""}
                </th>
                <th onClick={() => handleSort("name")} style={{ cursor: "pointer" }}>
                  Ürün Adı {sortField === "name" ? (sortOrder === "asc" ? " ▲" : " ▼") : ""}
                </th>
                <th onClick={() => handleSort("categoryName")} style={{ cursor: "pointer" }}>
                  Kategori {sortField === "categoryName" ? (sortOrder === "asc" ? " ▲" : " ▼") : ""}
                </th>
                <th onClick={() => handleSort("costPrice")} style={{ textAlign: "right", cursor: "pointer" }}>
                  Maliyet {sortField === "costPrice" ? (sortOrder === "asc" ? " ▲" : " ▼") : ""}
                </th>
                <th onClick={() => handleSort("price")} style={{ textAlign: "right", cursor: "pointer" }}>
                  Satış Fiyatı {sortField === "price" ? (sortOrder === "asc" ? " ▲" : " ▼") : ""}
                </th>
                <th style={{ textAlign: "center" }}>Kar %</th>
                <th style={{ textAlign: "center" }}>KDV</th>
                <th onClick={() => handleSort("stock")} style={{ textAlign: "center", cursor: "pointer" }}>
                  Mevcut Stok {sortField === "stock" ? (sortOrder === "asc" ? " ▲" : " ▼") : ""}
                </th>
                <th onClick={() => handleSort("criticalStock")} style={{ textAlign: "center", cursor: "pointer" }}>
                  Kritik Limit {sortField === "criticalStock" ? (sortOrder === "asc" ? " ▲" : " ▼") : ""}
                </th>
                <th style={{ textAlign: "center" }}>Durum</th>
                <th style={{ width: "100px", textAlign: "right" }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                   <td colSpan="11" style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem" }}>
                    Aranan kriterlere uygun ürün bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isKritik = p.stock <= p.criticalStock;
                  return (
                    <tr key={p.id} style={{ backgroundColor: isKritik ? "rgba(239, 68, 68, 0.015)" : "transparent" }}>
                      <td style={{ fontWeight: 600 }}>{p.code}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                      </td>
                      <td>{p.categoryName}</td>
                      <td style={{ textAlign: "right", color: "var(--text-secondary)" }}>
                        {(p.costPrice ?? 0) > 0 ? `${(p.costPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : "—"}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {p.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {(p.costPrice ?? 0) > 0 ? (
                          (() => {
                            const margin = ((p.price - p.costPrice) / p.price * 100);
                            const color = margin >= 20 ? "var(--success)" : margin >= 10 ? "var(--warning-hover)" : "var(--danger)";
                            return <span style={{ fontWeight: 600, color }}>%{margin.toFixed(1)}</span>;
                          })()
                        ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                      </td>
                      <td style={{ textAlign: "center", color: "var(--text-secondary)" }}>
                        %{p.taxRate ?? 20}
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>
                        <span style={{ color: isKritik ? "var(--danger)" : "var(--text-primary)" }}>
                          {p.stock} {p.unit || "Adet"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center", color: "var(--text-muted)" }}>
                        {p.criticalStock} {p.unit || "Adet"}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {isKritik ? (
                          <span className="badge badge-danger" style={{ gap: "0.25rem", padding: "0.25rem 0.5rem" }}>
                            <AlertTriangle size={12} />
                            <span>Kritik</span>
                          </span>
                        ) : (
                          <span className="badge badge-success">Yeterli</span>
                        )}
                      </td>
                      
                      <td>
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                          <button
                            onClick={() => handleOpenEditProduct(p)}
                            style={{ color: "var(--primary)", cursor: "pointer" }}
                            title="Ürünü Düzenle"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            style={{ color: "var(--danger)", cursor: "pointer" }}
                            title="Ürünü Sil"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- ÜRÜN EKLEME / DÜZENLEME MODALI --- */}
      {showProductModal && (
        <div className="modal-overlay" onClick={(e) => handleOverlayClick(e, setShowProductModal)}>
          <div className="modal-content animate-slide-up" style={{ maxWidth: "550px" }} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                {modalMode === "add" ? "Yeni Ürün Ekle" : "Ürün Düzenle"}
              </h3>
              <button onClick={() => setShowProductModal(false)} style={{ cursor: "pointer", fontSize: "1.25rem" }} aria-label="Kapat">&times;</button>
            </div>
            <form onSubmit={handleProductSubmit}>
              <div className="modal-body">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label className="form-label">Ürün Kodu / SKU</label>
                    <input 
                      type="text" 
                      className={`form-control ${errors.code ? "is-invalid" : ""}`}
                      value={productForm.code}
                      onChange={(e) => {
                        setProductForm({...productForm, code: e.target.value.toUpperCase()});
                        if (errors.code) setErrors({...errors, code: null});
                      }}
                      placeholder="OFIS-001"
                      required
                    />
                    {errors.code && <div className="invalid-feedback">{errors.code}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ürün Adı</label>
                    <input 
                      type="text" 
                      className={`form-control ${errors.name ? "is-invalid" : ""}`}
                      value={productForm.name}
                      onChange={(e) => {
                        setProductForm({...productForm, name: e.target.value});
                        if (errors.name) setErrors({...errors, name: null});
                      }}
                      placeholder="A4 Fotokopi Kağıdı"
                      required
                    />
                    {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Barkod Numarası <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(opsiyonel)</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={productForm.barcode}
                    onChange={(e) => setProductForm({...productForm, barcode: e.target.value})}
                    placeholder="Ürün üzerindeki barkod numarası"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label className="form-label">Kategori</label>
                    <select
                      className="form-control"
                      value={productForm.categoryId}
                      onChange={(e) => setProductForm({...productForm, categoryId: e.target.value})}
                      required
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Birim</label>
                    <select 
                      className="form-control"
                      value={productForm.unit}
                      onChange={(e) => setProductForm({...productForm, unit: e.target.value})}
                    >
                      <option value="Adet">Adet</option>
                      <option value="Kg">Kg</option>
                      <option value="Litre">Litre</option>
                      <option value="Metre">Metre</option>
                      <option value="Kutu">Kutu</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label className="form-label">Maliyet Fiyatı (₺)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      value={productForm.costPrice}
                      onChange={(e) => setProductForm({...productForm, costPrice: e.target.value})}
                      placeholder="0.00"
                    />
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Alış / üretim maliyeti</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Satış Fiyatı (KDV Hariç ₺)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={`form-control ${errors.price ? "is-invalid" : ""}`}
                      value={productForm.price}
                      onChange={(e) => {
                        setProductForm({...productForm, price: e.target.value});
                        if (errors.price) setErrors({...errors, price: null});
                      }}
                      required
                    />
                    {errors.price && <div className="invalid-feedback">{errors.price}</div>}
                    {parseFloat(productForm.costPrice) > 0 && parseFloat(productForm.price) > 0 && (
                      <div style={{ fontSize: "0.72rem", marginTop: "0.2rem", color: "var(--success)", fontWeight: 600 }}>
                        Kar marjı: %{((parseFloat(productForm.price) - parseFloat(productForm.costPrice)) / parseFloat(productForm.price) * 100).toFixed(1)}
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">KDV Oranı</label>
                    <select
                      className="form-control"
                      value={productForm.taxRate}
                      onChange={(e) => setProductForm({...productForm, taxRate: parseInt(e.target.value)})}
                    >
                      <option value={0}>%0</option>
                      <option value={1}>%1</option>
                      <option value={10}>%10</option>
                      <option value={20}>%20</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label className="form-label">Mevcut Stok</label>
                    <input 
                      type="number" 
                      min="0"
                      className={`form-control ${errors.stock ? "is-invalid" : ""}`}
                      value={productForm.stock}
                      onChange={(e) => {
                        setProductForm({...productForm, stock: e.target.value});
                        if (errors.stock) setErrors({...errors, stock: null});
                      }}
                      required
                    />
                    {errors.stock && <div className="invalid-feedback">{errors.stock}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Kritik Stok Sınırı</label>
                    <input 
                      type="number" 
                      min="0"
                      className={`form-control ${errors.criticalStock ? "is-invalid" : ""}`}
                      value={productForm.criticalStock}
                      onChange={(e) => {
                        setProductForm({...productForm, criticalStock: e.target.value});
                        if (errors.criticalStock) setErrors({...errors, criticalStock: null});
                      }}
                      required
                    />
                    {errors.criticalStock && <div className="invalid-feedback">{errors.criticalStock}</div>}
                  </div>
                </div>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowProductModal(false)}>İptal</button>
                <button type="submit" className="btn btn-primary">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- KATEGORİ EKLEME MODALI --- */}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={(e) => handleOverlayClick(e, setShowCategoryModal)}>
          <div className="modal-content animate-slide-up" style={{ maxWidth: "450px" }} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Yeni Kategori Ekle</h3>
              <button onClick={() => setShowCategoryModal(false)} style={{ cursor: "pointer", fontSize: "1.25rem" }} aria-label="Kapat">&times;</button>
            </div>
            <form onSubmit={handleCategorySubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Kategori Adı</label>
                  <input 
                    type="text" 
                    className="form-control"
                    placeholder="e.g. Kırtasiye"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Açıklama</label>
                  <textarea 
                    className="form-control"
                    rows="3"
                    placeholder="Kategori kapsamı hakkında kısa açıklama..."
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({...categoryForm, description: e.target.value})}
                    style={{ resize: "none" }}
                  />
                </div>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCategoryModal(false)}>İptal</button>
                <button type="submit" className="btn btn-primary">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EXCEL İMPORT ÖNİZLEME MODALI --- */}
      {showImportModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target.className === "modal-overlay") { setShowImportModal(false); setImportResult(null); } }}>
          <div className="modal-content animate-slide-up" style={{ maxWidth: "860px", maxHeight: "90vh", display: "flex", flexDirection: "column" }} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Upload size={18} /> Excel'den Toplu Ürün İçe Aktarma
              </h3>
              <button onClick={() => { setShowImportModal(false); setImportResult(null); }} style={{ cursor: "pointer", fontSize: "1.25rem" }} aria-label="Kapat">&times;</button>
            </div>

            <div className="modal-body" style={{ overflowY: "auto", flex: 1 }}>
              {/* Sonuç mesajı */}
              {importResult && (
                <div style={{ padding: "1rem", borderRadius: "var(--radius-sm)", marginBottom: "1rem",
                  backgroundColor: importResult.failed === 0 ? "var(--success-light)" : "var(--warning-light)",
                  color: importResult.failed === 0 ? "var(--success)" : "var(--warning-hover)",
                  fontWeight: 600, fontSize: "0.9rem"
                }}>
                  İşlem tamamlandı: {importResult.added} ürün eklendi, {importResult.updated} ürün güncellendi
                  {importResult.failed > 0 && `, ${importResult.failed} ürün başarısız`}.
                </div>
              )}

              {/* Hata listesi */}
              {importErrors.length > 0 && (
                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--danger)", marginBottom: "0.5rem" }}>
                    {importErrors.length} satırda hata var — bu satırlar içe aktarılmayacak:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", maxHeight: "120px", overflowY: "auto" }}>
                    {importErrors.map((e, i) => (
                      <div key={i} style={{ fontSize: "0.8rem", color: "var(--danger)", backgroundColor: "var(--danger-light)", padding: "0.35rem 0.75rem", borderRadius: "var(--radius-sm)" }}>
                        Satır {e.row} ({e.code}): {e.errors.join(", ")}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Önizleme tablosu */}
              {importRows.length > 0 ? (
                <>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
                    <strong>{importRows.length}</strong> geçerli satır içe aktarılmaya hazır.
                    Mevcut kodla eşleşenler <strong>güncellenecek</strong>, yeniler <strong>eklenecek</strong>.
                  </div>
                  <div className="table-container" style={{ maxHeight: "340px", overflowY: "auto" }}>
                    <table className="table" style={{ fontSize: "0.8rem" }}>
                      <thead>
                        <tr>
                          <th>Kod</th>
                          <th>Ürün Adı</th>
                          <th>Kategori</th>
                          <th style={{ textAlign: "right" }}>Maliyet</th>
                          <th style={{ textAlign: "right" }}>Satış Fiyatı</th>
                          <th style={{ textAlign: "center" }}>KDV</th>
                          <th style={{ textAlign: "center" }}>Stok</th>
                          <th style={{ textAlign: "center" }}>Birim</th>
                          <th style={{ textAlign: "center" }}>Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.map((row, i) => {
                          const exists = products.some(p => p.code === row.code);
                          return (
                            <tr key={i}>
                              <td style={{ fontWeight: 600 }}>{row.code}</td>
                              <td>{row.name}</td>
                              <td style={{ color: "var(--text-muted)" }}>{row.categoryName}</td>
                              <td style={{ textAlign: "right" }}>{row.costPrice > 0 ? `${row.costPrice.toFixed(2)} ₺` : "—"}</td>
                              <td style={{ textAlign: "right", fontWeight: 600 }}>{row.price.toFixed(2)} ₺</td>
                              <td style={{ textAlign: "center" }}>%{row.taxRate}</td>
                              <td style={{ textAlign: "center", fontWeight: 600 }}>{row.stock}</td>
                              <td style={{ textAlign: "center" }}>{row.unit}</td>
                              <td style={{ textAlign: "center" }}>
                                <span className={`badge badge-${exists ? "warning" : "success"}`} style={{ fontSize: "0.65rem" }}>
                                  {exists ? "Güncelle" : "Yeni"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                  Geçerli satır bulunamadı.
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowImportModal(false); setImportResult(null); }}>
                {importResult ? "Kapat" : "İptal"}
              </button>
              {!importResult && importRows.length > 0 && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirmImport}
                  disabled={importing}
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                >
                  <Upload size={16} />
                  <span>{importing ? `İçe aktarılıyor... (${importRows.length} ürün)` : `${importRows.length} Ürünü İçe Aktar`}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Inventory;
