import React, { useState, useRef, useEffect } from "react";
import { X, Printer, Tag } from "lucide-react";
import type { Product, CompanyProfile } from "../types";

interface BarcodeLabelModalProps {
  product: Product | null;
  companyProfile?: CompanyProfile | null;
  onClose: () => void;
}

// Canvas tabanlı taranabilir yüksek çözünürlüklü Code 39 Barkod Çizici
const BarcodeCanvas = ({ code, width = 200, height = 55 }: { code: string; width?: number; height?: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!code || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // CODE39 desen haritası
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

    const formattedText = `*${code.toUpperCase()}*`;

    let totalModules = 0;
    for (const char of formattedText) {
      const pattern = patterns[char] || patterns[' '];
      for (const sym of pattern) {
        totalModules += (sym === 'N' || sym === 'n') ? 1 : 2.5;
      }
      totalModules += 1;
    }

    const scale = 2; // Yüksek DPI için
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const moduleWidth = (width - 16) / totalModules;
    let currentX = 8;

    ctx.fillStyle = "#000000";
    for (const char of formattedText) {
      const pattern = patterns[char] || patterns[' '];
      let isBar = true;
      for (const sym of pattern) {
        const barW = (sym === 'N' || sym === 'n') ? moduleWidth * 1 : moduleWidth * 2.5;
        if (isBar) {
          ctx.fillRect(currentX, 2, barW, height - 4);
        }
        currentX += barW;
        isBar = !isBar;
      }
      currentX += moduleWidth;
    }
  }, [code, width, height]);

  return <canvas ref={canvasRef} style={{ width: `${width}px`, height: `${height}px`, display: "block" }} />;
};

const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({ product, companyProfile, onClose }) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [includePrice, setIncludePrice] = useState<boolean>(true);
  const [includeCompany, setIncludeCompany] = useState<boolean>(true);
  const [labelSize, setLabelSize] = useState<"thermal_50x30" | "thermal_60x40" | "a4_grid">("thermal_50x30");
  const [printing, setPrinting] = useState<boolean>(false);

  if (!product) return null;

  const barcodeValue = product.barcode || product.code || "8690000000000";
  const companyName = companyProfile?.companyName || "Özkon Yapı";

  const handlePrint = () => {
    setPrinting(true);

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      setPrinting(false);
      return;
    }

    const itemsCount = Math.max(1, quantity);

    let pageStyles = "";
    if (labelSize === "thermal_50x30") {
      pageStyles = `
        @page { size: 50mm 30mm; margin: 0; }
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .label {
          width: 50mm;
          height: 30mm;
          box-sizing: border-box;
          padding: 2mm 3mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          text-align: center;
          page-break-after: always;
          break-after: page;
          overflow: hidden;
        }
      `;
    } else if (labelSize === "thermal_60x40") {
      pageStyles = `
        @page { size: 60mm 40mm; margin: 0; }
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .label {
          width: 60mm;
          height: 40mm;
          box-sizing: border-box;
          padding: 3mm 4mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          text-align: center;
          page-break-after: always;
          break-after: page;
          overflow: hidden;
        }
      `;
    } else {
      // A4 Grid
      pageStyles = `
        @page { size: A4; margin: 10mm; }
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .a4-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4mm;
        }
        .label {
          border: 1px dashed #ccc;
          box-sizing: border-box;
          padding: 3mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          text-align: center;
          min-height: 35mm;
          overflow: hidden;
          page-break-inside: avoid;
        }
      `;
    }

    // Barkod canvas'ını Data URL olarak çek
    const canvasElement = document.querySelector("#preview-barcode-canvas canvas") as HTMLCanvasElement;
    const barcodeDataUrl = canvasElement ? canvasElement.toDataURL("image/png") : "";

    const labelsHtml = Array.from({ length: itemsCount }).map(() => `
      <div class="label">
        ${includeCompany ? `<div style="font-size: 8pt; font-weight: 700; color: #333; text-transform: uppercase; letter-spacing: 0.5px; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${companyName}</div>` : ""}
        <div style="font-size: 9pt; font-weight: 800; color: #000; line-height: 1.1; max-width: 100%; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
          ${product.name}
        </div>
        <div style="margin: 1mm 0; display: flex; flex-direction: column; align-items: center;">
          <img src="${barcodeDataUrl}" style="height: 11mm; width: auto; max-width: 95%; display: block;" />
          <div style="font-family: monospace; font-size: 7.5pt; font-weight: 700; letter-spacing: 1.5px; margin-top: 0.5mm;">${barcodeValue}</div>
        </div>
        ${includePrice ? `
          <div style="display: flex; justify-content: space-between; width: 100%; align-items: baseline; border-top: 0.5pt solid #eee; padding-top: 0.5mm;">
            <span style="font-size: 6.5pt; color: #666; font-weight: 600;">KDV DAHİL</span>
            <span style="font-size: 10.5pt; font-weight: 800; color: #000;">${((product.price || 0) * (1 + (product.taxRate ?? 20) / 100)).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
          </div>
        ` : ""}
      </div>
    `).join("");

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Barkod Etiketi - ${product.name}</title>
          <style>
            ${pageStyles}
          </style>
        </head>
        <body>
          ${labelSize === "a4_grid" ? `<div class="a4-grid">${labelsHtml}</div>` : labelsHtml}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      setPrinting(false);
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);
    }, 350);
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        backgroundColor: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem"
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="modal-content animate-slide-up"
        style={{
          maxWidth: "600px",
          width: "100%",
          backgroundColor: "var(--bg-secondary)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-xl)",
          border: "1px solid var(--border-color)",
          display: "flex", flexDirection: "column",
          maxHeight: "90vh", overflowY: "auto"
        }}
      >
        {/* Modal Başlığı */}
        <div className="modal-header" style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
              <Tag size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Barkod Etiketi Yazdır</h3>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{product.name}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ cursor: "pointer", color: "var(--text-muted)", padding: "0.25rem" }}
            aria-label="Kapat"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Gövdesi */}
        <div className="modal-body" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Canlı Etiket Önizleme Kartı */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Etiket Canlı Önizlemesi</span>
            
            <div
              style={{
                width: labelSize === "thermal_60x40" ? "260px" : "230px",
                minHeight: labelSize === "thermal_60x40" ? "170px" : "140px",
                backgroundColor: "#ffffff",
                color: "#000000",
                borderRadius: "8px",
                border: "2px solid #0f172a",
                padding: "0.75rem",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "space-between",
                boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                textAlign: "center",
                userSelect: "none"
              }}
            >
              {includeCompany && (
                <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {companyName}
                </div>
              )}

              <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.2, margin: "0.2rem 0" }}>
                {product.name}
              </div>

              <div id="preview-barcode-canvas" style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "0.25rem 0" }}>
                <BarcodeCanvas code={barcodeValue} width={labelSize === "thermal_60x40" ? 220 : 190} height={42} />
                <div style={{ fontFamily: "monospace", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "1.5px", marginTop: "0.15rem", color: "#000" }}>
                  {barcodeValue}
                </div>
              </div>

              {includePrice && (
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "baseline", borderTop: "1px solid #e2e8f0", paddingTop: "0.25rem", marginTop: "0.2rem" }}>
                  <span style={{ fontSize: "0.65rem", color: "#64748b", fontWeight: 700 }}>KDV DAHİL</span>
                  <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a" }}>
                    {((product.price || 0) * (1 + (product.taxRate ?? 20) / 100)).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Ayarlar Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            
            {/* Yazıcı Formatı */}
            <div className="form-group">
              <label className="form-label" style={{ fontSize: "0.85rem" }}>Kağıt / Yazıcı Tipi</label>
              <select
                className="form-control"
                value={labelSize}
                onChange={(e: any) => setLabelSize(e.target.value)}
                style={{ fontSize: "0.85rem" }}
              >
                <option value="thermal_50x30">Standart Termal Rulo (50x30 mm)</option>
                <option value="thermal_60x40">Geniş Termal Rulo (60x40 mm)</option>
                <option value="a4_grid">A4 Sayfaya Çoklu Basım</option>
              </select>
            </div>

            {/* Baskı Adedi */}
            <div className="form-group">
              <label className="form-label" style={{ fontSize: "0.85rem" }}>Baskı Adedi</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="number"
                  min="1"
                  max="500"
                  className="form-control"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ fontSize: "0.85rem", width: "80px" }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setQuantity(product.stock > 0 ? product.stock : 1)}
                  title="Stok miktarı kadar ayarla"
                  style={{ fontSize: "0.75rem", flex: 1 }}
                >
                  Stok Kadar ({product.stock})
                </button>
              </div>
            </div>
          </div>

          {/* Seçenekler On/Off */}
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={includePrice}
                onChange={(e) => setIncludePrice(e.target.checked)}
                style={{ width: "16px", height: "16px" }}
              />
              <span>Satış Fiyatını Göster</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={includeCompany}
                onChange={(e) => setIncludeCompany(e.target.checked)}
                style={{ width: "16px", height: "16px" }}
              />
              <span>Firma Adını Göster ({companyName})</span>
            </label>
          </div>

        </div>

        {/* Modal Altı */}
        <div className="modal-footer" style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            İptal
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePrint}
            disabled={printing}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <Printer size={16} />
            <span>{printing ? "Hazırlanıyor..." : `${quantity} Adet Etiket Yazdır`}</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default BarcodeLabelModal;
