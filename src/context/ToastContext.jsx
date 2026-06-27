// Takip Sistemi - Premium Toast Bildirim Sağlayıcısı (ToastContext)
import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle, AlertTriangle, XCircle, Info, X } from "lucide-react";

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message, type = "info") => {
    const id = "toast-" + Math.random().toString(36).substr(2, 9);
    
    setToasts((prevToasts) => [
      ...prevToasts,
      { id, message, type }
    ]);

    // 3.5 saniye sonra otomatik kaldır
    setTimeout(() => {
      removeToast(id);
    }, 3500);
  }, [removeToast]);

  const getIcon = (type) => {
    switch (type) {
      case "success": return <CheckCircle size={18} />;
      case "warning": return <AlertTriangle size={18} />;
      case "error": return <XCircle size={18} />;
      case "info":
      default: return <Info size={18} />;
    }
  };

  const getColors = (type) => {
    switch (type) {
      case "success":
        return {
          border: "rgba(16, 185, 129, 0.2)",
          background: "rgba(16, 185, 129, 0.1)",
          color: "var(--success)",
          glow: "rgba(16, 185, 129, 0.15)"
        };
      case "warning":
        return {
          border: "rgba(245, 158, 11, 0.2)",
          background: "rgba(245, 158, 11, 0.1)",
          color: "var(--warning)",
          glow: "rgba(245, 158, 11, 0.15)"
        };
      case "error":
        return {
          border: "rgba(239, 68, 68, 0.2)",
          background: "rgba(239, 68, 68, 0.1)",
          color: "var(--danger)",
          glow: "rgba(239, 68, 68, 0.15)"
        };
      case "info":
      default:
        return {
          border: "rgba(6, 182, 212, 0.2)",
          background: "rgba(6, 182, 212, 0.1)",
          color: "var(--info)",
          glow: "rgba(6, 182, 212, 0.15)"
        };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Bildirim Arayüzü */}
      <div 
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          maxWidth: "360px",
          width: "100%"
        }}
      >
        {toasts.map((toast) => {
          const colors = getColors(toast.type);
          return (
            <div
              key={toast.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-secondary)",
                borderLeft: `4px solid ${colors.color}`,
                boxShadow: `0 4px 20px ${colors.glow}, var(--shadow-lg)`,
                color: "var(--text-primary)",
                fontSize: "0.9rem",
                fontWeight: 500,
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                animation: "slideInRight var(--transition-fast) forwards",
                transition: "all var(--transition-normal)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", color: colors.color }}>
                {getIcon(toast.type)}
                <span style={{ color: "var(--text-primary)" }}>{toast.message}</span>
              </div>
              <button 
                onClick={() => removeToast(toast.id)}
                style={{ 
                  cursor: "pointer", 
                  color: "var(--text-muted)", 
                  display: "flex", 
                  alignItems: "center",
                  transition: "color var(--transition-fast)" 
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
                onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast bir ToastProvider içinde kullanılmalıdır!");
  }
  return context;
};
