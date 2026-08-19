// Takip Sistemi - İşlem Logları Sayfası (Logs)
import React, { useState, useEffect } from "react";
import { getLogs } from "../services/db";
import { History, Search } from "lucide-react";
import type { LogEntry } from "../types";

const ACTION_LABELS: Record<string, { label: string; badge: string }> = {
  CREATE_SALE: { label: "Satış Yapıldı", badge: "badge-primary" },
  APPROVE_SALE: { label: "Satış Onaylandı", badge: "badge-success" },
  REJECT_SALE: { label: "Satış Reddedildi", badge: "badge-danger" },
  UPDATE_SALE: { label: "Satış Düzenlendi", badge: "badge-warning" },
  RESUBMIT_SALE: { label: "Satış Yeniden Gönderildi", badge: "badge-info" },
  ADD_PRODUCT: { label: "Ürün Eklendi", badge: "badge-info" },
  UPDATE_PRODUCT: { label: "Ürün Güncellendi", badge: "badge-warning" },
  DELETE_PRODUCT: { label: "Ürün Silindi", badge: "badge-danger" },
  ADD_CUSTOMER: { label: "Müşteri Eklendi", badge: "badge-info" },
  UPDATE_CUSTOMER: { label: "Müşteri Güncellendi", badge: "badge-warning" },
  DELETE_CUSTOMER: { label: "Müşteri Silindi", badge: "badge-danger" },
  ADD_PAYMENT: { label: "Tahsilat Alındı", badge: "badge-success" },
  DELETE_PAYMENT: { label: "Tahsilat Silindi", badge: "badge-danger" },
  ADD_CATEGORY: { label: "Kategori Eklendi", badge: "badge-info" },
  DELETE_CATEGORY: { label: "Kategori Silindi", badge: "badge-danger" },
  ADD_ANNOUNCEMENT: { label: "Duyuru Eklendi", badge: "badge-info" },
  DELETE_ANNOUNCEMENT: { label: "Duyuru Silindi", badge: "badge-danger" },
  UPDATE_COMPANY_PROFILE: { label: "Şirket Profili Güncellendi", badge: "badge-primary" },
  CREATE_USER: { label: "Kullanıcı Eklendi", badge: "badge-info" },
  UPDATE_USER: { label: "Kullanıcı Güncellendi", badge: "badge-warning" },
  UPDATE_USER_ROLE: { label: "Yetki Değiştirildi", badge: "badge-warning" },
  DELETE_USER: { label: "Kullanıcı Silindi", badge: "badge-danger" }
};

const getActionBadge = (action: string) => {
  const item = ACTION_LABELS[action];
  if (item) {
    return <span className={`badge ${item.badge}`}>{item.label}</span>;
  }
  // Dinamik / bilinmeyen aksiyonlar için şık rozet
  const fallbackLabel = action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
  return <span className="badge badge-secondary">{fallbackLabel}</span>;
};

const getActionLabel = (action: string) => {
  return ACTION_LABELS[action]?.label || action.replace(/_/g, " ");
};

const getRoleLabel = (role: string) => {
  switch (role) {
    case "admin": return "Yönetici (Patron)";
    case "sysadmin": return "Sistem Yöneticisi";
    case "accounting": return "Muhasebeci";
    case "sales": return "Satış Temsilcisi";
    default: return role;
  }
};

const formatLogDetail = (details?: string) => {
  if (!details) return "—";
  let cleaned = details;

  // 1. Eski loglardaki anlamsız Firestore ID kalıntılarını temizle (Örn: PsUsOCVxS5uu1gcuhZJm ID'li satış -> Satış)
  cleaned = cleaned.replace(/([a-zA-Z0-9_-]{16,32})\s+ID'li\s+satış/g, "Satış");

  // 2. Eski loglardaki İngilizce rol isimlerini Türkçeleştir
  cleaned = cleaned
    .replace(/rolü\s+"admin"/gi, 'yetkisi "Yönetici (Patron)"')
    .replace(/rolü\s+"sysadmin"/gi, 'yetkisi "Sistem Yöneticisi"')
    .replace(/rolü\s+"accounting"/gi, 'yetkisi "Muhasebeci"')
    .replace(/rolü\s+"sales"/gi, 'yetkisi "Satış Temsilcisi"')
    .replace(/Rol:\s*admin/gi, "Rol: Yönetici (Patron)")
    .replace(/Rol:\s*sysadmin/gi, "Rol: Sistem Yöneticisi")
    .replace(/Rol:\s*accounting/gi, "Rol: Muhasebeci")
    .replace(/Rol:\s*sales/gi, "Rol: Satış Temsilcisi");

  return cleaned;
};

const Logs = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const logData = await getLogs();
      setLogs(logData);
    } catch (err) {
      console.error("Loglar yüklenirken hata:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade">
        <section className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="skeleton" style={{ width: "220px", height: "24px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "1rem" }}>
            <div className="skeleton" style={{ height: "38px" }} />
            <div className="skeleton" style={{ height: "38px" }} />
            <div className="skeleton" style={{ height: "38px" }} />
          </div>
        </section>
        <section className="card" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 180px 140px 1fr", gap: "1rem", alignItems: "center", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border-color)" }}>
                <div className="skeleton" style={{ height: "18px" }} />
                <div className="skeleton" style={{ height: "18px" }} />
                <div className="skeleton" style={{ height: "18px" }} />
                <div className="skeleton" style={{ height: "18px" }} />
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  const actionTypes = [...new Set(logs.map(log => log.action))];

  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesRole = roleFilter === "all" || log.userRole === roleFilter;

    return matchesSearch && matchesAction && matchesRole;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade">

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <History size={18} />
          <span>Sistem İşlem Günlükleri (Audit Log)</span>
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "1rem" }} className="grid-cols-3">
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
              <Search size={16} />
            </span>
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: "2.25rem" }}
              placeholder="Personel adı veya detay ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="form-control"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="all">Tüm İşlem Tipleri</option>
            {actionTypes.map(t => (
              <option key={t} value={t}>{getActionLabel(t)}</option>
            ))}
          </select>

          <select
            className="form-control"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">Tüm Rol Yetkileri</option>
            <option value="admin">Yönetici (Patron)</option>
            <option value="sysadmin">Sistem Yöneticisi</option>
            <option value="accounting">Muhasebeci</option>
            <option value="sales">Satış Temsilcisi</option>
          </select>
        </div>
      </section>

      <section className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: "180px" }}>Tarih / Saat</th>
                <th>Kullanıcı</th>
                <th>Rol</th>
                <th>İşlem Tipi</th>
                <th>İşlem Detayları</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem" }}>
                    Filtrelere uygun işlem logu bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 500 }}>
                      {new Date(log.createdAt).toLocaleDateString('tr-TR')} {new Date(log.createdAt).toLocaleTimeString('tr-TR')}
                    </td>
                    <td style={{ fontWeight: 600 }}>{log.userName}</td>
                    <td>
                      <span style={{
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: log.userRole === "admin" ? "var(--danger)" : log.userRole === "sysadmin" ? "#6366f1" : log.userRole === "accounting" ? "var(--success)" : "var(--primary)"
                      }}>
                        {getRoleLabel(log.userRole as string)}
                      </span>
                    </td>
                    <td>{getActionBadge(log.action)}</td>
                    <td style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>{formatLogDetail(log.details)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
};

export default Logs;
