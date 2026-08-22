// Takip Sistemi - Resmi ÖZKON Logo Yönetimi ve PDF Rasterizer

// Browser ortamında SVG'yi yüksek çözünürlüklü (High-DPI) PNG'ye çeviren ve önbelleğe alan motor
let cachedLogoPng: string | null = null;

export const getOzkonLogoPng = async (): Promise<string | null> => {
  if (cachedLogoPng) return cachedLogoPng;
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const scale = 4; // 4x Retina / Baskı kalitesi
          canvas.width = (img.naturalWidth || 210) * scale;
          canvas.height = (img.naturalHeight || 64) * scale;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            cachedLogoPng = canvas.toDataURL("image/png");
            resolve(cachedLogoPng);
            return;
          }
        } catch (err) {
          console.warn("Canvas logo rasterize warning:", err);
        }
        resolve(null);
      };
      img.onerror = (e) => {
        console.warn("Logo image load error:", e);
        resolve(null);
      };
      img.src = "/logo.svg";
    } catch (e) {
      console.warn("getOzkonLogoPng error:", e);
      resolve(null);
    }
  });
};

export const OZKON_LOGO_SVG_PATH = "/logo.svg";
