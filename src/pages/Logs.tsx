// Takip Sistemi - İşlem Logları Sayfası (Logs)
import React, { useState, useEffect } from "react";
import { getLogs } from "../services/db";
import { History, Search } from "lucide-react";
import type { LogEntry } from "../types";

const getActionBadge = (action: string) => {
  switch (action) {
    case "CREATE_SALE":
      return <span className="badge badge-primary">Satış Yapıldı</span>;
    case "APPROVE_SALE":
      return <span className="badge badge-success">Satış Onaylandı</span>;
    case "REJECT_SALE":
      return <span className="badge badge-danger">Satış Reddedildi</span>;
    case "ADD_PRODUCT":
      return <span className="badge badge-info">Ürün Eklendi</span>;
    case "UPDATE_PRODUCT":
      return <span className="badge badge-warning">Ürün Güncellendi</span>;
    case "DELETE_PRODUCT":
      return <span className="badge badge-danger">Ürün Silindi</span>;
    case "ADD_CUSTOMER":
      return <span className="badge badge-info">Müşteri Eklendi</span>;
    case "ADD_CATEGORY":
      return <span className="badge badge-info">Kategori Eklendi</span>;
    default:
      return <span className="badge badge-secondary">{action}</span>;
  }
};

const getRoleLabel = (role: string) => {
  switch (role) {
    case "admin": return "Yönetici";
    case "accounting": return "Muhasebeci";
    case "sales": return "Satışçı";
    default: return role;
  }
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
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh", color: "var(--text-secondary)" }}>
        Yükleniyor...
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
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            className="form-control"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">Tüm Rol Yetkileri</option>
            <option value="admin">Yönetici (Patron)</option>
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
                        color: log.userRole === "admin" ? "var(--danger)" : log.userRole === "accounting" ? "var(--success)" : "var(--primary)"
                      }}>
                        {getRoleLabel(log.userRole as string)}
                      </span>
                    </td>
                    <td>{getActionBadge(log.action)}</td>
                    <td style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>{log.details}</td>
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
