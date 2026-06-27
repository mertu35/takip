// Takip Sistemi - Sidebar Bileşeni
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { 
  LayoutDashboard, 
  ShoppingBag, 
  CheckSquare, 
  Package, 
  History, 
  Settings, 
  LogOut,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  User
} from "lucide-react";

const Sidebar = ({ onOpenProfile }) => {
  const { user, logoutUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;

  const isActive = (path) => location.pathname === path;

  // Rol bazlı navigasyon linklerini tanımla
  const menuItems = [];

  if (user.role === "admin") {
    menuItems.push(
      { path: "/", label: "Dashboard", icon: LayoutDashboard },
      { path: "/accounting", label: "Satış Geçmişi", icon: CheckSquare },
      { path: "/logs", label: "İşlem Logları", icon: History }
    );
  } else if (user.role === "sysadmin") {
    menuItems.push(
      { path: "/settings", label: "Sistem Ayarları", icon: Settings },
      { path: "/logs", label: "İşlem Logları", icon: History }
    );
  } else if (user.role === "sales") {
    menuItems.push(
      { path: "/sales", label: "Satış Paneli", icon: ShoppingBag },
      { path: "/inventory", label: "Ürün & Stok", icon: Package }
    );
  } else if (user.role === "accounting") {
    menuItems.push(
      { path: "/accounting", label: "Muhasebe Onay", icon: CheckSquare },
      { path: "/inventory", label: "Ürün & Stok", icon: Package }
    );
  }

  // Rolün Türkçe karşılığı
  const getRoleLabel = (role) => {
    switch (role) {
      case "admin": return "Yönetici (Patron)";
      case "sysadmin": return "Sistem Yöneticisi";
      case "accounting": return "Muhasebeci";
      case "sales": return "Satışçı";
      default: return role;
    }
  };

  return (
    <>
      {/* Sidebar Container */}
      <aside 
        style={{
          width: collapsed ? "80px" : "var(--sidebar-width)",
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          backgroundColor: "var(--bg-secondary)",
          borderRight: "1px solid var(--border-color)",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          transition: "width var(--transition-normal)",
          overflowX: "hidden"
        }}
      >
        {/* Logo Bölümü */}
        <div 
          style={{
            height: "var(--header-height)",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            padding: "0 1.5rem",
            borderBottom: "1px solid var(--border-color)"
          }}
        >
          {!collapsed && (
            <Link to="/" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none" }} aria-label="Ana Sayfa">
              <img 
                src="/logo.png" 
                alt="Özkon Çelik Logo" 
                style={{ 
                  height: "28px", 
                  objectFit: "contain",
                  display: "block"
                }} 
              />
              <span className="brand-title" style={{ fontSize: "1rem", color: "var(--primary)" }}>ÖZKON ÇELİK</span>
            </Link>
          )}
          {collapsed && (
            <Link to="/" style={{ display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="Ana Sayfa">
              <img 
                src="/logo.png" 
                alt="Özkon Çelik Logo" 
                style={{ 
                  height: "26px", 
                  width: "26px",
                  objectFit: "contain",
                  display: "block"
                }} 
              />
            </Link>
          )}
          
          <button 
            onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Menüyü Genişlet" : "Menüyü Daralt"}
            style={{
              cursor: "pointer",
              color: "var(--text-secondary)",
              padding: "0.25rem",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Kullanıcı Bilgisi */}
        {!collapsed && (
          <div 
            onClick={onOpenProfile}
            style={{
              padding: "1.5rem 1.25rem",
              borderBottom: "1px solid var(--border-color)",
              backgroundColor: "rgba(0,0,0,0.01)",
              cursor: "pointer",
              transition: "background-color var(--transition-fast)"
            }}
            className="sidebar-user-card"
            title="Profil Ayarlarını Aç"
          >
            <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)" }}>{user.displayName}</div>
            <div style={{ 
              fontSize: "0.75rem", 
              fontWeight: 500, 
              color: "var(--primary)", 
              backgroundColor: "var(--primary-light)", 
              padding: "0.15rem 0.5rem", 
              borderRadius: "var(--radius-full)",
              display: "inline-block",
              marginTop: "0.35rem"
            }}>{getRoleLabel(user.role)}</div>
          </div>
        )}

        {/* Menü Linkleri */}
        <nav style={{ flex: 1, padding: "1rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "0.85rem 1rem",
                  borderRadius: "var(--radius-sm)",
                  color: active ? "var(--primary)" : "var(--text-secondary)",
                  backgroundColor: active ? "var(--primary-light)" : "transparent",
                  fontWeight: active ? 600 : 500,
                  transition: "all var(--transition-fast)",
                  justifyContent: collapsed ? "center" : "flex-start"
                }}
                title={collapsed ? item.label : ""}
              >
                <Icon size={20} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Alt Butonlar (Tema ve Çıkış) */}
        <div style={{ padding: "0.75rem", borderTop: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <button
            onClick={onOpenProfile}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: "0.85rem 1rem",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
              justifyContent: collapsed ? "center" : "flex-start",
              width: "100%",
              backgroundColor: "transparent",
              border: "none",
              textAlign: "left"
            }}
            title={collapsed ? "Profilim" : ""}
          >
            <User size={20} />
            {!collapsed && <span>Profilim</span>}
          </button>

          <button
            onClick={toggleTheme}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: "0.85rem 1rem",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
              justifyContent: collapsed ? "center" : "flex-start",
              width: "100%",
              backgroundColor: "transparent",
              border: "none",
              textAlign: "left"
            }}
          >
            {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
            {!collapsed && <span>{theme === "light" ? "Karanlık Tema" : "Açık Tema"}</span>}
          </button>
          
          <button
            onClick={logoutUser}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: "0.85rem 1rem",
              borderRadius: "var(--radius-sm)",
              color: "var(--danger)",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
              justifyContent: collapsed ? "center" : "flex-start",
              width: "100%",
              backgroundColor: "transparent",
              border: "none",
              textAlign: "left"
            }}
          >
            <LogOut size={20} />
            {!collapsed && <span>Çıkış Yap</span>}
          </button>
        </div>
      </aside>

      {/* Adjust Main Layout margin when sidebar collapsed */}
      <style>{`
        :root {
          --sidebar-width: ${collapsed ? "80px" : "260px"};
        }
        .sidebar-user-card:hover {
          background-color: var(--bg-tertiary) !important;
        }
      `}</style>
    </>
  );
};

export default Sidebar;
