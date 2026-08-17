import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { X, Camera, CameraOff, RefreshCw, AlertCircle } from "lucide-react";

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onDetected, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");

  const stopAllMedia = () => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {
        // yoksayılır
      }
      controlsRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop());
      } catch {
        // yoksayılır
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  const startCamera = async (deviceId?: string) => {
    stopAllMedia();
    setError(null);
    setScanning(false);

    try {
      const codeReader = new BrowserMultiFormatReader();
      readerRef.current = codeReader;

      if (!videoRef.current) return;

      // Cihaz belirleme veya arka kamerayı önceliklendirme
      const targetDeviceId = deviceId || (selectedCameraId ? selectedCameraId : undefined);

      const controls = await codeReader.decodeFromVideoDevice(
        targetDeviceId,
        videoRef.current,
        (result, decodeErr) => {
          if (result) {
            const detectedText = result.getText().trim();
            if (detectedText) {
              // Algılandı
              stopAllMedia();
              onDetected(detectedText);
            }
          }
          if (decodeErr && !(decodeErr.name === "NotFoundException")) {
            // Normal tarama sırasında eşleşme olmaması NotFoundException fırlatır, hata sayılmaz
          }
        }
      );

      controlsRef.current = controls;
      setScanning(true);

      // İzin verildikten sonra mevcut tüm kameraları listele
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        setCameras(devices);
        if (devices.length > 0 && !targetDeviceId) {
          // Arka kamerayı seçmeye çalış
          const back = devices.find(
            (d) => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("arka") || d.label.toLowerCase().includes("environment")
          );
          if (back) {
            setSelectedCameraId(back.deviceId);
          } else {
            setSelectedCameraId(devices[0].deviceId);
          }
        }
      } catch {
        // Kamera listesi alınamazsa tek kamera ile devam edilir
      }
    } catch (err: any) {
      console.error("Kamera başlatma hatası:", err);
      let msg = "Kamera başlatılamadı.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        msg = "Kamera erişim izni reddedildi. Lütfen tarayıcınızın adres çubuğundaki kilit simgesinden kamera iznini onaylayın.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        msg = "Cihazınızda kullanılabilir bir kamera bulunamadı.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        msg = "Kamera başka bir uygulama (Zoom, Teams vb.) tarafından kullanılıyor olabilir.";
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
      setScanning(false);
    }
  };

  useEffect(() => {
    startCamera();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopAllMedia();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      stopAllMedia();
      window.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCameraChange = (deviceId: string) => {
    setSelectedCameraId(deviceId);
    startCamera(deviceId);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      stopAllMedia();
      onDetected(manualCode.trim());
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        backgroundColor: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(4px)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: "1rem",
        padding: "1rem"
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Barkod Okuyucu"
    >
      <div style={{
        backgroundColor: "var(--bg-secondary)",
        color: "var(--text-primary)",
        borderRadius: "var(--radius-lg)",
        padding: "1.5rem",
        width: "min(440px, 95vw)",
        display: "flex", flexDirection: "column", gap: "1rem",
        boxShadow: "var(--shadow-xl)",
        border: "1px solid var(--border-color)"
      }}>
        {/* Başlık */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
            <Camera size={20} color="var(--primary)" /> Barkod Okuyucu
          </h3>
          <button
            type="button"
            onClick={() => { stopAllMedia(); onClose(); }}
            aria-label="Kapat"
            style={{ cursor: "pointer", color: "var(--text-muted)", padding: "0.25rem", display: "flex", alignItems: "center" }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Kamera Seçimi (Birden fazla kamera varsa) */}
        {cameras.length > 1 && (
          <div className="form-group" style={{ margin: 0 }}>
            <select
              className="form-control"
              value={selectedCameraId}
              onChange={(e) => handleCameraChange(e.target.value)}
              style={{ fontSize: "0.85rem" }}
            >
              {cameras.map((c, idx) => (
                <option key={c.deviceId || idx} value={c.deviceId}>
                  {c.label || `Kamera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Video & Tarama Çerçevesi */}
        <div style={{
          position: "relative",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          backgroundColor: "#000",
          minHeight: "220px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>
          <video
            ref={videoRef}
            style={{
              width: "100%",
              height: "100%",
              maxHeight: "280px",
              objectFit: "cover",
              display: scanning ? "block" : "none"
            }}
            autoPlay
            muted
            playsInline
          />

          {scanning && (
            <>
              {/* Lazer Tarama Çerçevesi */}
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                pointerEvents: "none"
              }}>
                <div style={{
                  width: "70%", height: "45%",
                  border: "2px solid var(--primary)",
                  borderRadius: "10px",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                  position: "relative"
                }}>
                  {/* Kırmızı Lazer Çizgisi */}
                  <div style={{
                    position: "absolute",
                    top: "50%", left: "5%", right: "5%",
                    height: "2px",
                    backgroundColor: "rgba(239, 68, 68, 0.8)",
                    boxShadow: "0 0 8px rgba(239, 68, 68, 0.9)"
                  }} />
                </div>
              </div>

              <div style={{
                position: "absolute", bottom: "0.75rem", left: 0, right: 0,
                textAlign: "center", color: "#fff", fontSize: "0.8rem",
                fontWeight: 600, textShadow: "0 1px 3px rgba(0,0,0,0.8)"
              }}>
                Barkodu çerçeve içine hizalayın
              </div>
            </>
          )}

          {!scanning && !error && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", color: "rgba(255,255,255,0.7)", padding: "2rem", textAlign: "center" }}>
              <RefreshCw size={24} className="animate-spin" />
              <span style={{ fontSize: "0.85rem" }}>Kamera başlatılıyor...</span>
            </div>
          )}

          {error && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", color: "#fff", padding: "1.5rem", textAlign: "center" }}>
              <AlertCircle size={32} color="var(--danger)" />
              <div style={{ fontSize: "0.85rem", color: "var(--danger)" }}>{error}</div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => startCamera(selectedCameraId)}
                style={{ marginTop: "0.25rem" }}
              >
                <RefreshCw size={14} /> Tekrar Dene
              </button>
            </div>
          )}
        </div>

        {/* Manuel Barkod Girişi Alternatifi */}
        <form onSubmit={handleManualSubmit} style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            className="form-control"
            placeholder="Veya barkodu elle yazın..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            style={{ fontSize: "0.85rem" }}
          />
          <button type="submit" className="btn btn-primary btn-sm">
            Ekle
          </button>
        </form>

        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", margin: 0 }}>
          EAN-13, EAN-8, QR Code, Code 128 ve UPC formatları desteklenir.
        </p>
      </div>
    </div>
  );
};

export default BarcodeScanner;
