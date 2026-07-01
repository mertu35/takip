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
  User,
  Users,
  type LucideIcon
} from "lucide-react";
import type { Role } from "../types";

interface SidebarProps {
  onOpenProfile: () => void;
}

interface MenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

const getRoleLabel = (role: Role | string) => {
  switch (role) {
    case "admin": return "Yönetici (Patron)";
    case "sysadmin": return "Sistem Yöneticisi";
    case "accounting": return "Muhasebeci";
    case "sales": return "Satışçı";
    default: return role;
  }
};

const Sidebar = ({ onOpenProfile }: SidebarProps) => {
  const { user, logoutUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;

  const isActive = (path: string) => location.pathname === path;

  const menuItems: MenuItem[] = [];

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
      { path: "/customers", label: "Müşteriler", icon: Users },
      { path: "/inventory", label: "Ürün & Stok", icon: Package }
    );
  } else if (user.role === "accounting") {
    menuItems.push(
      { path: "/accounting", label: "Muhasebe Onay", icon: CheckSquare },
      { path: "/inventory", label: "Ürün & Stok", icon: Package }
    );
  }

  return (
    <>
      <aside
        className={`sidebar${collapsed ? " sidebar-collapsed" : ""}`}
        style={{ width: collapsed ? "80px" : "var(--sidebar-width)" }}
      >
        <div className="sidebar-logo" style={{ justifyContent: collapsed ? "center" : "space-between" }}>
          {!collapsed && (
            <Link to="/" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none" }} aria-label="Ana Sayfa">
              <img src="/logo.png" alt="Özkon Çelik Logo" style={{ height: "28px", objectFit: "contain", display: "block" }} />
              <span className="brand-title" style={{ fontSize: "1rem", color: "var(--primary)" }}>ÖZKON ÇELİK</span>
            </Link>
          )}
          {collapsed && (
            <Link to="/" style={{ display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="Ana Sayfa">
              <img src="/logo.png" alt="Özkon Çelik Logo" style={{ height: "26px", width: "26px", objectFit: "contain", display: "block" }} />
            </Link>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Menüyü Genişlet" : "Menüyü Daralt"}
            className="sidebar-collapse-btn"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {!collapsed && (
          <div onClick={onOpenProfile} className="sidebar-user-card" title="Profil Ayarlarını Aç">
            <div className="sidebar-user-name">{user.displayName}</div>
            <div className="sidebar-user-role">{getRoleLabel(user.role)}</div>
          </div>
        )}

        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-nav-link${active ? " active" : ""}`}
                style={{ justifyContent: collapsed ? "center" : "flex-start" }}
                title={collapsed ? item.label : ""}
              >
                <Icon size={20} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button onClick={onOpenProfile} className="sidebar-footer-btn" title={collapsed ? "Profilim" : ""}>
            <User size={20} />
            {!collapsed && <span>Profilim</span>}
          </button>

          <button onClick={toggleTheme} className="sidebar-footer-btn">
            {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
            {!collapsed && <span>{theme === "light" ? "Karanlık Tema" : "Açık Tema"}</span>}
          </button>

          <button onClick={logoutUser} className="sidebar-footer-btn danger">
            <LogOut size={20} />
            {!collapsed && <span>Çıkış Yap</span>}
          </button>
        </div>
      </aside>

      <style>{`
        :root {
          --sidebar-width: ${collapsed ? "80px" : "260px"};
        }
      `}</style>
    </>
  );
};

export default Sidebar;
