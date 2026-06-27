// Takip Sistemi - Sistem Ayarları Ekranı (Settings)
import React, { useState, useEffect } from "react";
import { registerUser, updateUserRole, deleteUser } from "../services/auth";
import { getCustomers, getProducts, getSales, exportBackupData, importBackupData, getAnnouncements, addAnnouncement, deleteAnnouncement } from "../services/db";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { 
  Settings, 
  UserPlus, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  ShieldAlert, 
  Check, 
  UserCheck,
  Trash2
} from "lucide-react";
import * as XLSX from "xlsx";
import { isFirebaseActive, firestore } from "../services/firebase";
import { collection, getDocs } from "firebase/firestore";

const SettingsPage = () => {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleRoleChange = async (userId, userName, newRole) => {
    try {
      await updateUserRole(userId, userName, newRole, currentUser.uid, currentUser.displayName, currentUser.role);
      setUserSuccess(`"${userName}" kullanıcısının rolü "${newRole === 'admin' ? 'Yönetici' : newRole === 'accounting' ? 'Muhasebeci' : 'Satışçı'}" olarak güncellendi.`);
      setTimeout(() => setUserSuccess(""), 4000);
      fetchUsers();
    } catch (err) {
      setUserError("Rol güncellenirken hata: " + err.message);
      setTimeout(() => setUserError(""), 4000);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (userId === currentUser.uid) {
      showToast("Kendi hesabınızı silemezsiniz!", "error");
      return;
    }
    
    if (window.confirm(`"${userName}" isimli personeli sistemden silmek istediğinize emin misiniz?`)) {
      try {
        await deleteUser(userId, userName, currentUser.uid, currentUser.displayName, currentUser.role);
        setUserSuccess(`"${userName}" isimli personel sistemden silindi.`);
        setTimeout(() => setUserSuccess(""), 4000);
        fetchUsers();
      } catch (err) {
        setUserError("Personel silinirken hata: " + err.message);
        setTimeout(() => setUserError(""), 4000);
      }
    }
  };

  // Yeni Kullanıcı Formu
  const [userForm, setUserForm] = useState({ displayName: "", email: "", role: "sales", password: "" });
  const [userSuccess, setUserSuccess] = useState("");
  const [userError, setUserError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Yedekleme Mesajları
  const [backupSuccess, setBackupSuccess] = useState("");
  const [backupError, setBackupError] = useState("");

  // Duyuru Yönetimi
  const [announcements, setAnnouncements] = useState([]);
  const [annForm, setAnnForm] = useState("");
  const [annLoading, setAnnLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const data = await getAnnouncements();
      setAnnouncements(data);
    } catch (err) {
      console.error("Duyurular yüklenirken hata:", err);
    }
  };

  const fetchUsers = async () => {
    try {
      if (isFirebaseActive) {
        const querySnapshot = await getDocs(collection(firestore, "users"));
        const fbUsers = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(u => !u.disabled);
        setUsers(fbUsers);
      } else {
        // Local users listesini çek (güvenli parse)
        const localUsers = localStorage.getItem("takip_users");
        if (localUsers) {
          try {
            const parsed = JSON.parse(localUsers);
            setUsers(parsed.filter(u => !u.disabled));
          } catch (err) {
            console.error("Kullanıcı listesi parse hatası:", err);
            setUsers([]);
          }
        }
      }
    } catch (err) {
      console.error("Kullanıcılar yüklenirken hata:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUserRegister = async (e) => {
    e.preventDefault();
    setUserError("");
    setUserSuccess("");
    
    if (!userForm.displayName || !userForm.email) {
      setUserError("Lütfen tüm alanları doldurun.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Kullanıcı adı girildiyse ve @ içermiyorsa otomatik email formatına çevir
      const email = userForm.email.includes("@") ? userForm.email : `${userForm.email.trim().toLowerCase()}@takip.com`;

      // Eğer şifre girilmediyse varsayılan olarak rol+123 yap, girildiyse girileni kullan
      const password = userForm.password ? userForm.password.trim() : (userForm.role + "123");
      
      if (userForm.password && userForm.password.length < 6) {
        throw new Error("Belirttiğiniz şifre en az 6 karakter olmalıdır!");
      }

      await registerUser(email, password, userForm.displayName, userForm.role, currentUser);
      
      setUserSuccess(`Kullanıcı başarıyla oluşturuldu! Şifre: ${password}`);
      setUserForm({ displayName: "", email: "", role: "sales", password: "" });
      
      // Kullanıcı listesini yenile
      fetchUsers();
    } catch (err) {
      setUserError(err.message || "Kullanıcı oluşturulurken bir hata meydana geldi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- EXCEL DIŞA AKTARMA (EXCEL EXPORT) ---
  const handleExportExcel = async () => {
    try {
      const [sales, products, customers] = await Promise.all([
        getSales(),
        getProducts(),
        getCustomers()
      ]);

      // Excel çalışma kitabı (Workbook) oluştur
      const wb = XLSX.utils.book_new();

      // Satışlar Verisini Hazırla
      const formattedSales = sales.map(s => ({
        "Fiş No": s.receiptNo,
        "Müşteri": s.customerCompany,
        "Yetkili": s.customerName,
        "Satışçı": s.salespersonName,
        "Tarih": new Date(s.date).toLocaleDateString('tr-TR'),
        "Durum": s.status === "approved" ? "Onaylandı" : s.status === "rejected" ? "Reddedildi" : "Onay Bekliyor",
        "Ara Toplam (₺)": s.totalAmount,
        "KDV (₺)": s.taxAmount,
        "İndirim (₺)": s.discountAmount,
        "Net Tutar (₺)": s.netAmount,
        "Mikro Kaydı": s.accountingProcessed ? "İşlendi" : "İşlenmedi",
        "Onaylayan": s.processedBy || "-",
        "Onay Tarihi": s.processedAt ? new Date(s.processedAt).toLocaleDateString('tr-TR') : "-",
        "Notlar": s.notes || ""
      }));

      // Ürünler Verisini Hazırla
      const formattedProducts = products.map(p => ({
        "Ürün Kodu": p.code,
        "Ürün Adı": p.name,
        "Kategori": p.categoryName,
        "Birim Fiyat (₺)": p.price,
        "Mevcut Stok": p.stock,
        "Kritik Limit": p.criticalStock,
        "Birim": p.unit,
        "Kritik Stok Uyarısı": p.stock <= p.criticalStock ? "EVET" : "HAYIR"
      }));

      // Müşteriler Verisini Hazırla
      const formattedCustomers = customers.map(c => ({
        "Firma Unvanı": c.company,
        "İsim Soyisim": c.name,
        "Telefon": c.phone || "-",
        "E-posta": c.email || "-",
        "Vergi Dairesi": c.taxOffice || "-",
        "Vergi Numarası": c.taxNumber || "-",
        "Adres": c.address || "-"
      }));

      // Çalışma sayfaları (Worksheets) oluştur
      const wsSales = XLSX.utils.json_to_sheet(formattedSales);
      const wsProducts = XLSX.utils.json_to_sheet(formattedProducts);
      const wsCustomers = XLSX.utils.json_to_sheet(formattedCustomers);

      // Sayfaları kitaba ekle
      XLSX.utils.book_append_sheet(wb, wsSales, "Satış Raporları");
      XLSX.utils.book_append_sheet(wb, wsProducts, "Ürün & Stok Listesi");
      XLSX.utils.book_append_sheet(wb, wsCustomers, "Müşteri Rehberi");

      // Excel dosyasını indir
      XLSX.writeFile(wb, `Takip_Sistemi_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      setBackupSuccess("Excel raporu başarıyla oluşturuldu ve indirildi.");
      setTimeout(() => setBackupSuccess(""), 4000);
    } catch (err) {
      setBackupError("Excel dışa aktarımı başarısız: " + err.message);
      setTimeout(() => setBackupError(""), 4000);
    }
  };

  // --- VERİ TABANI YEDEKLEME (EXPORT JSON) ---
  const handleExportBackup = () => {
    try {
      const dataStr = exportBackupData();
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `takip_yedek_${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      setBackupSuccess("Sistem yedek dosyası başarıyla indirildi.");
      setTimeout(() => setBackupSuccess(""), 4000);
    } catch (err) {
      setBackupError("Yedekleme dosyası oluşturulamadı: " + err.message);
      setTimeout(() => setBackupError(""), 4000);
    }
  };

  // --- YEDEKTEN GERİ YÜKLEME (IMPORT JSON) ---
  const handleImportBackup = (e) => {
    const fileReader = new FileReader();
    const file = e.target.files[0];
    
    if (!file) return;

    fileReader.onload = (event) => {
      try {
        const fileContent = event.target.result;
        const success = importBackupData(fileContent);
        if (success) {
          setBackupSuccess("Sistem yedeği başarıyla geri yüklendi! Sayfa yenileniyor...");
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } catch (err) {
        setBackupError("Yedekten geri yükleme başarısız! Dosyayı kontrol edin: " + err.message);
        setTimeout(() => setBackupError(""), 5000);
      }
    };
    fileReader.readAsText(file, "UTF-8");
  };

  const handleAddAnnouncement = async (e) => {
    e.preventDefault();
    if (!annForm.trim()) {
      showToast("Lütfen duyuru metni girin.", "warning");
      return;
    }
    setAnnLoading(true);
    try {
      await addAnnouncement(annForm, currentUser.uid, currentUser.displayName, currentUser.role);
      showToast("Yeni duyuru başarıyla yayınlandı.", "success");
      setAnnForm("");
      fetchAnnouncements();
    } catch (err) {
      showToast("Duyuru yayınlanırken hata: " + err.message, "error");
    } finally {
      setAnnLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (annId) => {
    if (window.confirm("Bu duyuruyu silmek istediğinize emin misiniz?")) {
      try {
        await deleteAnnouncement(annId, currentUser.uid, currentUser.displayName, currentUser.role);
        showToast("Duyuru silindi.", "success");
        fetchAnnouncements();
      } catch (err) {
        showToast("Duyuru silinirken hata: " + err.message, "error");
      }
    }
  };



  if (!currentUser) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "1.5rem" }} className="grid-cols-2 animate-fade">
      
      {/* SOL KOLON: Personel Yönetimi */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* Personel Ekleme Formu */}
        <section className="card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <UserPlus size={18} />
            <span>Yeni Personel Kaydı</span>
          </h3>

          {userSuccess && (
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
              marginBottom: "1rem" 
            }}>
              <Check size={16} />
              <span>{userSuccess}</span>
            </div>
          )}

          {userError && (
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
              marginBottom: "1rem" 
            }}>
              <ShieldAlert size={16} />
              <span>{userError}</span>
            </div>
          )}

          <form onSubmit={handleUserRegister}>
            <div className="form-group">
              <label className="form-label">Personel Ad Soyad</label>
              <input 
                type="text" 
                className="form-control"
                placeholder="Örn: Veli Bilgin"
                value={userForm.displayName}
                onChange={(e) => setUserForm({...userForm, displayName: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Kullanıcı Adı</label>
              <input 
                type="text" 
                className="form-control"
                placeholder="Örn: veli"
                value={userForm.email}
                onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Sistem Yetkisi (Rol)</label>
              <select
                className="form-control"
                value={userForm.role}
                onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                required
              >
                <option value="sales">Satış Temsilcisi (Satışçı)</option>
                <option value="accounting">Muhasebe Sorumlusu (Muhasebeci)</option>
                <option value="admin">Yönetici (Patron)</option>
                <option value="sysadmin">Sistem Yöneticisi</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Giriş Şifresi</label>
              <input 
                type="text" 
                className="form-control"
                placeholder="Boş bırakılırsa otomatik atanır (örn: sales123)"
                value={userForm.password}
                onChange={(e) => setUserForm({...userForm, password: e.target.value})}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "0.5rem" }}
              disabled={isSubmitting}
            >
              <UserCheck size={18} />
              <span>Personeli Kaydet</span>
            </button>
          </form>
        </section>

        {/* Kayıtlı Personel Listesi */}
        <section className="card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>Aktif Sistem Kullanıcıları</h3>
          
          <div className="table-container">
            <table className="table" style={{ fontSize: "0.875rem" }}>
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>E-Posta</th>
                  <th>Yetki Rolü</th>
                  <th style={{ width: "60px", textAlign: "center" }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: "center" }}>Yükleniyor...</td>
                  </tr>
                ) : (
                  users.map((u, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{u.displayName}</td>
                      <td>{u.email}</td>
                      <td>
                        <select
                          className="form-control"
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem", width: "130px", height: "auto" }}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.uid, u.displayName, e.target.value)}
                          disabled={u.uid === currentUser?.uid}
                        >
                          <option value="sales">Satışçı</option>
                          <option value="accounting">Muhasebeci</option>
                          <option value="admin">Yönetici (Patron)</option>
                          <option value="sysadmin">Sistem Yöneticisi</option>
                        </select>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.uid, u.displayName)}
                          style={{ 
                            color: u.uid === currentUser?.uid ? "var(--text-muted)" : "var(--danger)", 
                            cursor: u.uid === currentUser?.uid ? "not-allowed" : "pointer" 
                          }}
                          disabled={u.uid === currentUser?.uid}
                          title={u.uid === currentUser?.uid ? "Kendi hesabınızı silemezsiniz!" : "Kullanıcıyı Sil"}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* SAĞ KOLON: Excel Rapor & Yedekleme */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* Excel Dışa Aktar */}
        <section className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <FileSpreadsheet size={18} />
            <span>Excel Dışa Aktarma</span>
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Sistemdeki tüm onaylanmış satışları, güncel ürün listesini, stok durumlarını ve müşteri verilerini tek bir Excel dosyasında ayrı sekmeler halinde indirebilirsiniz.
          </p>
          <button 
            onClick={handleExportExcel} 
            className="btn btn-success"
            style={{ alignSelf: "flex-start", gap: "0.5rem" }}
          >
            <Download size={18} />
            <span>Excel Raporu İndir (.xlsx)</span>
          </button>
        </section>

        {/* Veri Yedekleme ve Geri Yükleme */}
        <section className="card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Settings size={18} />
            <span>Veri Yedekleme & Geri Yükleme</span>
          </h3>

          {backupSuccess && (
            <div style={{ 
              backgroundColor: "var(--success-light)", 
              color: "var(--success)", 
              padding: "0.75rem 1rem", 
              borderRadius: "var(--radius-sm)", 
              fontSize: "0.85rem" 
            }}>
              {backupSuccess}
            </div>
          )}

          {backupError && (
            <div style={{ 
              backgroundColor: "var(--danger-light)", 
              color: "var(--danger)", 
              padding: "0.75rem 1rem", 
              borderRadius: "var(--radius-sm)", 
              fontSize: "0.85rem" 
            }}>
              {backupError}
            </div>
          )}

          {/* Yedek Al */}
          <div style={{ padding: "1rem", border: "1px dashed var(--border-color)", borderRadius: "var(--radius-sm)" }}>
            <h4 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem" }}>Verileri Yedekle</h4>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
              Tüm sistem durumunu (Ürünler, Müşteriler, Satış Kayıtları ve Loglar) JSON formatında indirir.
            </p>
            <button 
              onClick={handleExportBackup} 
              className="btn btn-secondary btn-sm"
              style={{ gap: "0.5rem" }}
            >
              <Download size={14} />
              <span>Yedek Dosyası İndir (JSON)</span>
            </button>
          </div>

          {/* Geri Yükle */}
          <div style={{ padding: "1rem", border: "1px dashed var(--border-color)", borderRadius: "var(--radius-sm)" }}>
            <h4 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem" }}>Yedekten Geri Yükle</h4>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
              Daha önce indirdiğiniz JSON yedek dosyasını yükleyerek verilerinizi geri yükleyin. Bu işlem mevcut yerel verileri sıfırlayacaktır.
            </p>
            
            <label 
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", gap: "0.5rem", cursor: "pointer" }}
            >
              <Upload size={14} />
              <span>Yedek Dosyası Yükle</span>
              <input 
                type="file" 
                accept=".json" 
                style={{ display: "none" }}
                onChange={handleImportBackup}
              />
            </label>
          </div>
        </section>

        {/* Duyuru Yönetimi */}
        <section className="card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.2rem" }}>📢</span>
            <span>Sistem Duyuruları Yönetimi</span>
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Sistem genelinde tüm personelin ekranında (Header altında) gösterilecek duyurular yayınlayın veya silin.
          </p>

          <form onSubmit={handleAddAnnouncement} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div className="form-group">
              <label className="form-label">Duyuru Metni</label>
              <textarea 
                className="form-control"
                rows="2"
                placeholder="Örn: 27 Haziran Cumartesi günü sistem bakım çalışması yapılacaktır."
                value={annForm}
                onChange={(e) => setAnnForm(e.target.value)}
                maxLength="200"
                required
              />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary btn-sm"
              style={{ alignSelf: "flex-start" }}
              disabled={annLoading}
            >
              Duyuruyu Yayınla
            </button>
          </form>

          <div style={{ borderBottom: "1px solid var(--border-color)", margin: "0.25rem 0" }}></div>

          <h4 style={{ fontSize: "0.9rem", fontWeight: 600 }}>Aktif Duyurular</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "200px", overflowY: "auto" }}>
            {announcements.length === 0 ? (
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center" }}>
                Yayınlanmış duyuru bulunmuyor.
              </p>
            ) : (
              announcements.map((ann) => (
                <div 
                  key={ann.id} 
                  style={{
                    padding: "0.75rem",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--bg-primary)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "1rem"
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-primary)", margin: 0, lineHeight: 1.4 }}>
                      {ann.text}
                    </p>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                      {new Date(ann.createdAt).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleDeleteAnnouncement(ann.id)}
                    style={{ 
                      color: "var(--danger)", 
                      background: "none", 
                      border: "none", 
                      cursor: "pointer",
                      padding: "0.25rem",
                      display: "flex",
                      alignItems: "center"
                    }}
                    title="Duyuruyu Sil"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

      </div>

    </div>
  );
};

export default SettingsPage;
