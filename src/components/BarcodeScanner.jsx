import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { X, Camera, CameraOff } from "lucide-react";

const BarcodeScanner = ({ onDetected, onClose }) => {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [error, setError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        setCameras(devices);
        // Arka kamerayı varsayılan seç (mobilde)
        const back = devices.find(d => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("arka"));
        setSelectedCamera(back?.deviceId || devices[0]?.deviceId || null);
      } catch (e) {
        setError("Kamera listesi alınamadı: " + e.message);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!selectedCamera) return;

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    setScanning(true);
    setError(null);

    reader.decodeFromVideoDevice(selectedCamera, videoRef.current, (result, err) => {
      if (result) {
        onDetected(result.getText());
        stopScanning();
      }
    }).catch(e => {
      setError("Kamera açılamadı: " + e.message);
      setScanning(false);
    });

    return () => stopScanning();
  }, [selectedCamera]);

  const stopScanning = () => {
    if (readerRef.current) {
      try { BrowserMultiFormatReader.releaseAllStreams(); } catch (_) {}
    }
    setScanning(false);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      backgroundColor: "rgba(0,0,0,0.85)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "1rem"
    }}>
      <div style={{
        backgroundColor: "var(--bg-primary)",
        borderRadius: "var(--radius-lg)",
        padding: "1.5rem",
        width: "min(420px, 95vw)",
        display: "flex", flexDirection: "column", gap: "1rem"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Camera size={18} /> Barkod Okuyucu
          </h3>
          <button onClick={() => { stopScanning(); onClose(); }}
            style={{ cursor: "pointer", color: "var(--text-secondary)", padding: "0.25rem" }}>
            <X size={20} />
          </button>
        </div>

        {cameras.length > 1 && (
          <select
            className="form-control"
            value={selectedCamera || ""}
            onChange={e => setSelectedCamera(e.target.value)}
            style={{ fontSize: "0.85rem" }}
          >
            {cameras.map(c => (
              <option key={c.deviceId} value={c.deviceId}>{c.label || "Kamera " + c.deviceId.slice(0, 6)}</option>
            ))}
          </select>
        )}

        <div style={{ position: "relative", borderRadius: "var(--radius-md)", overflow: "hidden", background: "#000" }}>
          <video
            ref={videoRef}
            style={{ width: "100%", display: "block", maxHeight: "280px", objectFit: "cover" }}
            autoPlay
            muted
            playsInline
          />
          {/* Hedef çerçeve */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none"
          }}>
            <div style={{
              width: "65%", height: "35%",
              border: "2px solid var(--primary)",
              borderRadius: "8px",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)"
            }} />
          </div>
          {scanning && (
            <div style={{
              position: "absolute", bottom: "0.75rem", left: 0, right: 0,
              textAlign: "center", color: "#fff", fontSize: "0.8rem"
            }}>
              Barkodu çerçeve içine getirin...
            </div>
          )}
        </div>

        {error && (
          <div style={{ color: "var(--danger)", fontSize: "0.85rem", textAlign: "center" }}>
            {error}
          </div>
        )}

        {!scanning && !error && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            <CameraOff size={16} /> Kamera başlatılıyor...
          </div>
        )}

        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", margin: 0 }}>
          EAN-13, QR, Code128 ve diğer barkod formatları desteklenir.
        </p>
      </div>
    </div>
  );
};

export default BarcodeScanner;
