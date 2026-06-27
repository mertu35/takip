import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import { useAuth } from "../context/AuthContext";
import { Menu, X, Bell } from "lucide-react";
import { useLocation } from "react-router-dom";
import { getAnnouncements, getSales, getNotifications, markNotificationsRead } from "../services/db";
import ProfileModal from "./ProfileModal";

const Layout = ({ children }) => {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingSales, setPendingSales] = useState([]);
  const [userNotifications, setUserNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getAnnouncements();
        setAnnouncements(data.filter(a => a.active));

        if (user.role === "sales") {
          // Satışçı: kendi bildirimlerini göster
          const notifs = await getNotifications(user.uid);
          setUserNotifications(notifs);
          setUnreadCount(notifs.filter(n => !n.read).length);
        } else {
          // Muhasebe/Admin: bekleyen onayları göster
          const salesData = await getSales(user.role, user.uid);
          const pending = salesData.filter(s => s.status === "pending_accounting");
          setPendingSales(pending);
          setPendingCount(pending.length);
        }
      } catch (err) {
        console.error("Bildirimler yüklenirken hata:", err);
      }
    };
    if (user) fetchData();
  }, [user, location.pathname]);

  if (!user) return children;

  // Sayfa başlığını belirle
  const getPageTitle = () => {
    switch (location.pathname) {
      case "/": return "Dashboard & Raporlar";
      case "/sales": return "Satış İşlemleri";
      case "/accounting": return "Muhasebe Onay Ekranı";
      case "/inventory": return "Ürün ve Stok Takibi";
      case "/logs": return "Sistem İşlem Logları";
      case "/settings": return "Sistem Ayarları";
      default: return "Özkon Çelik Takip";
    }
  };

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
    <div className="layout-wrapper" style={{ display: "flex", minHeight: "100vh" }}>
      {/* Mobil Sidebar Drawer ve Karartma */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(2px)",
            zIndex: 99,
            display: "none" // CSS'te media query ile kontrol edilecek
          }}
          className="mobile-overlay"
        />
      )}

      {/* Sidebar - responsive sınıflarla sarmalanmış */}
      <div className={`sidebar-container ${mobileOpen ? "open" : ""}`} style={{ zIndex: 100 }}>
        <Sidebar onOpenProfile={() => setShowProfileModal(true)} />
      </div>

      {/* Ana Arayüz */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header - Üst Bilgi Çubuğu */}
        <header 
          style={{
            height: "var(--header-height)",
            backgroundColor: "var(--bg-secondary)",
            borderBottom: "1px solid var(--border-color)",
            padding: "0 2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 90,
            marginLeft: "var(--sidebar-width)",
            transition: "margin-left var(--transition-normal)"
          }}
          className="app-header"
        >
          {/* Sol Kısım: Hamburger Menü (Mobil) ve Başlık */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <button 
              className="mobile-toggle"
              onClick={() => setMobileOpen(!mobileOpen)}
              style={{
                display: "none",
                cursor: "pointer",
                color: "var(--text-primary)",
                padding: "0.5rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-color)"
              }}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>
              {getPageTitle()}
            </h1>
          </div>

          {/* Sağ Kısım: Profil Hızlı Menü (Mobil İçin Ekstralar) */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }} className="header-right">
            {/* Bildirim Zili */}
            <div style={{ position: "relative" }}>
              <button
                onClick={async () => {
                  const opening = !showNotifications;
                  setShowNotifications(opening);
                  if (opening && user.role === "sales" && unreadCount > 0) {
                    await markNotificationsRead(user.uid);
                    setUnreadCount(0);
                    setUserNotifications(prev => prev.map(n => ({ ...n, read: true })));
                  }
                }}
                aria-label="Bildirimler"
                style={{
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  padding: "0.5rem",
                  borderRadius: "var(--radius-sm)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative"
                }}
              >
                <Bell size={20} />
                {(user.role === "sales" ? unreadCount : pendingCount) > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: "2px",
                      right: "2px",
                      backgroundColor: "var(--danger)",
                      color: "white",
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      borderRadius: "50%",
                      width: "16px",
                      height: "16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    {user.role === "sales" ? unreadCount : pendingCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div
                    onClick={() => setShowNotifications(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 199, background: "transparent" }}
                  />
                  <div
                    className="card animate-slide-up"
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "100%",
                      marginTop: "0.5rem",
                      width: "300px",
                      zIndex: 200,
                      padding: "1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                      boxShadow: "var(--shadow-lg)"
                    }}
                  >
                    <h4 style={{ fontSize: "0.9rem", fontWeight: 700, borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem" }}>
                      {user.role === "sales" ? "Bildirimlerim" : "Bekleyen Sipariş Onayları"}
                    </h4>
                    <div style={{ maxHeight: "240px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {user.role === "sales" ? (
                        userNotifications.length === 0 ? (
                          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center", padding: "1rem 0" }}>
                            Yeni bildiriminiz yok.
                          </p>
                        ) : (
                          userNotifications.map((n, idx) => (
                            <div key={idx} style={{
                              fontSize: "0.8rem",
                              borderBottom: "1px solid var(--border-color)",
                              paddingBottom: "0.5rem",
                              display: "flex",
                              gap: "0.5rem",
                              alignItems: "flex-start",
                              opacity: n.read ? 0.65 : 1
                            }}>
                              <span style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                backgroundColor: n.type === "success" ? "var(--success)" : n.type === "error" ? "var(--danger)" : "var(--primary)",
                                flexShrink: 0,
                                marginTop: "4px"
                              }} />
                              <div>
                                <div style={{ color: "var(--text-primary)", lineHeight: 1.4 }}>{n.message}</div>
                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                                  {new Date(n.createdAt).toLocaleString("tr-TR")}
                                </div>
                              </div>
                            </div>
                          ))
                        )
                      ) : (
                        pendingCount === 0 ? (
                          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center", padding: "1rem 0" }}>
                            Yeni onay bekleyen sipariş yok.
                          </p>
                        ) : (
                          pendingSales.map((s, idx) => (
                            <div key={idx} style={{ fontSize: "0.8rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem" }}>
                              <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{s.receiptNo}</div>
                              <div style={{ color: "var(--text-secondary)", marginTop: "0.15rem" }}>{s.customerCompany}</div>
                              <div style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 600, marginTop: "0.15rem" }}>
                                Net Tutar: {s.netAmount.toLocaleString("tr-TR")} ₺
                              </div>
                            </div>
                          ))
                        )
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Küçük Ekranlar için Rol Gösterimi */}
            <div 
              className="header-user-badge" 
              onClick={() => setShowProfileModal(true)}
              style={{ 
                display: "flex", 
                flexDirection: "column", 
                alignItems: "flex-end",
                cursor: "pointer",
                padding: "0.4rem 0.8rem",
                borderRadius: "var(--radius-sm)",
                transition: "background-color var(--transition-fast)"
              }}
              title="Profil Ayarlarım"
            >
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{user.displayName}</span>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "capitalize" }}>
                {getRoleLabel(user.role)}
              </span>
            </div>
          </div>
        </header>

        {/* Duyuru Şeridi */}
        {announcements.length > 0 && (
          <div 
            className="app-announcement"
            style={{
              backgroundColor: "var(--primary)",
              color: "#fff",
              padding: "0.5rem 2rem",
              fontSize: "0.85rem",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              overflow: "hidden",
              position: "relative",
              marginLeft: "var(--sidebar-width)",
              transition: "margin-left var(--transition-normal)",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              zIndex: 89
            }}
          >
            <div style={{ 
              fontWeight: 700, 
              backgroundColor: "rgba(255,255,255,0.2)", 
              padding: "0.15rem 0.6rem", 
              borderRadius: "var(--radius-sm)", 
              marginRight: "1rem",
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              flexShrink: 0
            }}>
              Duyuru:
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div className="announcement-marquee">
                <div className="announcement-track">
                  {announcements.map((a) => (
                    <span key={a.id} style={{ marginRight: "3rem", whiteSpace: "nowrap" }}>
                      • {a.text}
                    </span>
                  ))}
                  {/* Sonsuz döngü için duyuruları tekrar et */}
                  {announcements.map((a) => (
                    <span key={`dup-${a.id}`} style={{ marginRight: "3rem", whiteSpace: "nowrap" }} aria-hidden="true">
                      • {a.text}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sayfa İçerik Alanı */}
        <main className="main-content" style={{ marginTop: 0 }}>
          {children}
        </main>
      </div>

      {/* Profil Modalı */}
      <ProfileModal 
        isOpen={showProfileModal} 
        onClose={() => setShowProfileModal(false)} 
      />

      {/* Ek stiller */}
      <style>{`
        .sidebar-container {
          transition: transform var(--transition-normal);
        }

        /* Duyuru marquee animasyonu (HTML5 <marquee> deprecated yerine) */
        .announcement-marquee {
          width: 100%;
          overflow: hidden;
          position: relative;
        }
        .announcement-track {
          display: inline-block;
          white-space: nowrap;
          animation: marquee-scroll 30s linear infinite;
          will-change: transform;
        }
        @keyframes marquee-scroll {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .announcement-marquee:hover .announcement-track {
          animation-play-state: paused;
        }

        @media (max-width: 992px) {
          .app-header {
            margin-left: 0 !important;
            padding: 0 1rem !important;
          }
          .app-announcement {
            margin-left: 0 !important;
            padding: 0.5rem 1rem !important;
          }
          .mobile-toggle {
            display: flex !important;
            align-items: center;
            justify-content: center;
          }
          .sidebar-container {
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            transform: translateX(-100%);
            transition: transform var(--transition-normal);
          }
          .sidebar-container.open {
            transform: translateX(0);
          }
          .mobile-overlay {
            display: block !important;
          }
          .header-user-badge {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Layout;
