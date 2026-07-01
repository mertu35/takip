import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { updateUserProfile } from "../services/auth";
import { User, Lock, Check, Eye, EyeOff } from "lucide-react";
import Modal from "./Modal";
import type { Role } from "../types";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
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

const ProfileModal = ({ isOpen, onClose }: ProfileModalProps) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) {
      showToast("İsim alanı boş bırakılamaz!", "warning");
      return;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        showToast("Yeni şifre en az 6 karakter olmalıdır!", "warning");
        return;
      }
      if (newPassword !== confirmPassword) {
        showToast("Şifreler uyuşmuyor!", "warning");
        return;
      }
    }

    setLoading(true);
    try {
      await updateUserProfile(displayName, newPassword);
      showToast("Profil başarıyla güncellendi! Sistem yenileniyor...", "success");

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Profil güncellenirken hata oluştu.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="450px"
      zIndex={1100}
      title={
        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <User size={18} />
          <span>Profil Ayarlarım</span>
        </span>
      }
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading} form="profile-form">
            İptal
          </button>
          <button
            type="submit"
            form="profile-form"
            className="btn btn-primary"
            disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            {loading ? (
              <span>Kaydediliyor...</span>
            ) : (
              <>
                <Check size={16} />
                <span>Değişiklikleri Kaydet</span>
              </>
            )}
          </button>
        </>
      }
    >
      <form id="profile-form" onSubmit={handleSubmit}>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div
            style={{
              padding: "1rem",
              backgroundColor: "var(--bg-tertiary)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-color)",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem"
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>SİSTEM KİMLİĞİ</div>
            <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{user.email}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: 600, marginTop: "0.25rem" }}>
              Yetki: {getRoleLabel(user.role)}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <User size={14} />
              <span>Ad Soyad</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Adınız Soyadınız"
              required
            />
          </div>

          <div style={{ borderBottom: "1px dashed var(--border-color)", margin: "0.5rem 0" }}></div>

          <div>
            <h4 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <Lock size={14} />
              <span>Şifre Güncelleme (İsteğe Bağlı)</span>
            </h4>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
              Şifrenizi değiştirmek istemiyorsanız aşağıdaki alanları boş bırakabilirsiniz.
            </p>

            <div className="form-group" style={{ position: "relative" }}>
              <label className="form-label">Yeni Şifre</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"}
                  className="form-control"
                  placeholder="En az 6 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ paddingRight: "2.5rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? "Şifreyi gizle" : "Şifreyi göster"}
                  style={{
                    position: "absolute",
                    right: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center"
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group" style={{ position: "relative", marginTop: "0.75rem" }}>
              <label className="form-label">Yeni Şifre Tekrar</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirmPass ? "text" : "password"}
                  className="form-control"
                  placeholder="Şifreyi tekrar girin"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ paddingRight: "2.5rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  aria-label={showConfirmPass ? "Şifreyi gizle" : "Şifreyi göster"}
                  style={{
                    position: "absolute",
                    right: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center"
                  }}
                >
                  {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default ProfileModal;
