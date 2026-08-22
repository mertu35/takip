import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in component tree:", error, errorInfo);
    // Yeni versiyon deploy edildiğinde eski chunk dosyası eksikse sayfayı sessizce yenile
    const isChunkError =
      error?.message?.includes("Failed to fetch dynamically imported module") ||
      error?.message?.includes("Loading chunk");

    if (isChunkError) {
      const lastReload = Number(sessionStorage.getItem("takip_last_chunk_reload") || "0");
      if (Date.now() - lastReload > 8000) {
        sessionStorage.setItem("takip_last_chunk_reload", String(Date.now()));
        window.location.reload();
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "70vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            textAlign: "center"
          }}
        >
          <div
            className="card animate-fade"
            style={{
              maxWidth: "500px",
              padding: "2rem",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-secondary)",
              boxShadow: "var(--shadow-lg)"
            }}
          >
            <div
              style={{
                width: "54px",
                height: "54px",
                borderRadius: "50%",
                backgroundColor: "var(--danger-light)",
                color: "var(--danger)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem auto"
              }}
            >
              <AlertCircle size={28} />
            </div>

            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Bir Yükleme Hatası Oluştu
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
              {this.state.error?.message || "Sayfa bileşeni yüklenirken beklenmedik bir durum oluştu."}
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.location.reload()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                width: "100%"
              }}
            >
              <RefreshCw size={16} />
              <span>Sayfayı Yenile</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
