import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { User, Lock, ShieldAlert, Check, HelpCircle, Eye, EyeOff } from "lucide-react";
import { isDatabaseInitialized, initializeFirebaseDatabase } from "../services/db";
import { isFirebaseActive } from "../services/firebase";

const Login = () => {
  const { loginUser, resetPasswordEmail } = useAuth();
  const navigate = useNavigate();

  // Giriş Bilgileri
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Veritabanı İlklendirme/Kurulum Bilgileri (Fresh Firebase için)
  const [dbUninitialized, setDbUninitialized] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    const checkDb = async () => {
      if (isFirebaseActive) {
        try {
          const initialized = await isDatabaseInitialized();
          setDbUninitialized(!initialized);
        } catch (e) {
          console.error("DB Initialization check failed", e);
        }
      }
    };
    checkDb();
  }, []);

  const handleSeedDatabase = async () => {
    setSeeding(true);
    setError("");
    try {
      await initializeFirebaseDatabase("admin@takip.com", "admin123", "Özkon Yönetici");
      setDbUninitialized(false);
      setEmail("admin@takip.com");
      setPassword("admin123");
    } catch (err) {
      setError(err.message || "İlklendirme başarısız oldu.");
    } finally {
      setSeeding(false);
    }
  };

  // Şifre Sıfırlama Bilgileri
  const [isForgotView, setIsForgotView] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);


  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Lütfen kullanıcı adı ve şifre alanlarını doldurun.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      // Eğer kullanıcı adı girildiyse ve @ içermiyorsa, otomatik olarak email formatına çeviriyoruz
      const loginEmail = email.includes("@") ? email : `${email.trim().toLowerCase()}@takip.com`;
      await loginUser(loginEmail, password);
      navigate("/");
    } catch (err) {
      setError(err.message || "Giriş başarısız. Bilgilerinizi kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail) {
      setError("Lütfen kullanıcı adınızı veya e-posta adresinizi yazın.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const resetEmail = forgotEmail.includes("@") ? forgotEmail : `${forgotEmail.trim().toLowerCase()}@takip.com`;
      await resetPasswordEmail(resetEmail);
      setResetSuccess(true);
      setTimeout(() => {
        setIsForgotView(false);
        setResetSuccess(false);
        setForgotEmail("");
      }, 3000);
    } catch (err) {
      setError(err.message || "Şifre sıfırlama talebi gönderilemedi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "var(--bg-primary)",
      backgroundImage: "radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.05) 0%, transparent 45%), radial-gradient(circle at 90% 80%, rgba(16, 185, 129, 0.05) 0%, transparent 45%)",
      padding: "1rem",
      position: "relative"
    }}>
      {/* Login Kartı */}
      <div 
        className="card card-glass animate-slide-up"
        style={{
          width: "100%",
          maxWidth: "440px",
          padding: "2.5rem 2rem",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-xl)"
        }}
      >
        {/* Sistem Başlığı / Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <img 
            src="/logo.png" 
            alt="Özkon Çelik Logo" 
            style={{ 
              height: "60px", 
              maxWidth: "100%",
              objectFit: "contain", 
              display: "block", 
              margin: "0 auto 0.75rem auto"
            }} 
          />
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.5px", color: "var(--text-primary)" }}>Özkon Çelik</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Satış, Muhasebe Onay ve Yönetim Platformu
          </p>
        </div>

        {dbUninitialized && (
          <div style={{
            backgroundColor: "rgba(99, 102, 241, 0.08)",
            border: "1px solid rgba(99, 102, 241, 0.2)",
            color: "var(--text-primary)",
            padding: "1rem",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.85rem",
            marginBottom: "1.25rem",
            textAlign: "center"
          }}>
            <div style={{ fontWeight: 600, color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
              <HelpCircle size={18} />
              <span>Boş Firebase Projesi Algılandı!</span>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
              Firestore veritabanınız boş görünüyor. İlk yönetici hesabını (admin@takip.com) ve demo stok/müşteri verilerini kurmak ister misiniz?
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "100%", padding: "0.5rem", fontSize: "0.8rem", height: "auto" }}
              disabled={seeding}
              onClick={handleSeedDatabase}
            >
              {seeding ? "Kuruluyor..." : "Sistemi İlklendir ve Verileri Yükle"}
            </button>
          </div>
        )}

        {error && (
          <div style={{
            backgroundColor: "var(--danger-light)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            color: "var(--danger)",
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "1.25rem"
          }}>
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        {!isForgotView ? (
          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-username">Kullanıcı Adı</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                  <User size={18} />
                </span>
                <input
                  id="login-username"
                  type="text"
                  className="form-control"
                  placeholder="örn: admin, satis, muhasebe"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: "2.75rem" }}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <label className="form-label" htmlFor="login-pass" style={{ marginBottom: 0 }}>Şifre</label>
                <button
                  type="button"
                  onClick={() => setIsForgotView(true)}
                  style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: 500, cursor: "pointer" }}
                >
                  Şifremi Unuttum
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                  <Lock size={18} />
                </span>
                <input
                  id="login-pass"
                  type={showPassword ? "text" : "password"}
                  className="form-control"
                  placeholder="••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: "2.75rem", paddingRight: "2.75rem" }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ 
                    position: "absolute", 
                    right: "1rem", 
                    top: "50%", 
                    transform: "translateY(-50%)", 
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center"
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "1.5rem" }}
              disabled={loading}
            >
              {loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
            </button>
          </form>
        ) : (
          /* --- ŞİFRE SIFIRLAMA FORMU --- */
          <form onSubmit={handleForgotSubmit}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.5rem" }}>Şifre Sıfırlama</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
              Hesabınıza ait kullanıcı adınızı girin. Şifre sıfırlama yönergelerini e-posta adresinize göndereceğiz.
            </p>

            {resetSuccess ? (
              <div style={{
                backgroundColor: "var(--success-light)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                color: "var(--success)",
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "1.25rem"
              }}>
                <Check size={16} />
                <span>Şifre sıfırlama e-postası başarıyla gönderildi!</span>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="forgot-username">Kullanıcı Adı</label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                      <User size={18} />
                    </span>
                    <input
                      id="forgot-username"
                      type="text"
                      className="form-control"
                      placeholder="örn: admin, satis"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      style={{ paddingLeft: "2.75rem" }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setIsForgotView(false);
                      setError("");
                    }}
                    disabled={loading}
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={loading}
                  >
                    Gönder
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
