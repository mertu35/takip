import React, { useState, useEffect } from "react";
import { registerUser, updateUser, deleteUser } from "../services/auth";
import { getCustomers, getProducts, getSales, exportBackupData, importBackupData, getAnnouncements, addAnnouncement, deleteAnnouncement, getCompanyProfile, updateCompanyProfile } from "../services/db";
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
  Trash2,
  Building,
  SquarePen,
  AlertTriangle,
  X
} from "lucide-react";
import * as XLSX from "xlsx";
import { isFirebaseActive, firestore } from "../services/firebase";
import { collection, getDocs } from "firebase/firestore";
import { INITIAL_USERS } from "../services/mockData";
import type { AppUser, Announcement, CompanyProfile, Role } from "../types";

const SettingsPage = () => {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Düzenleme Modalı
  const [editUserModal, setEditUserModal] = useState<{
    user: AppUser;
    displayName: string;
    role: Role;
  } | null>(null);
  const [editUserSaving, setEditUserSaving] = useState(false);

  // Silme Onay Modalı
  const [deleteUserModal, setDeleteUserModal] = useState<AppUser | null>(null);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);

  const [userForm, setUserForm] = useState({ displayName: "", email: "", role: "sales" as Role, password: "" });
  const [userError, setUserError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [backupSuccess, setBackupSuccess] = useState("");
  const [backupError, setBackupError] = useState("");

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annForm, setAnnForm] = useState("");
  const [annLoading, setAnnLoading] = useState(false);

  const [profile, setProfile] = useState<CompanyProfile>({
    companyName: "",
    address: "",
    phone: "",
    fax: "",
    taxOffice: "",
    taxNumber: ""
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserModal || !currentUser) return;
    if (!editUserModal.displayName.trim()) {
      showToast("Lütfen personel ad soyadını giriniz.", "error");
      return;
    }
    setEditUserSaving(true);
    try {
      await updateUser(
        editUserModal.user.uid,
        {
          displayName: editUserModal.displayName.trim(),
          role: editUserModal.role
        },
        currentUser.uid,
        currentUser.displayName,
        currentUser.role
      );
      showToast(`"${editUserModal.displayName}" personeli başarıyla güncellendi.`, "success");
      setEditUserModal(null);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || "Güncelleme başarısız oldu.", "error");
    } finally {
      setEditUserSaving(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteUserModal || !currentUser) return;
    if (deleteUserModal.uid === currentUser.uid) {
      showToast("Kendi hesabınızı silemezsiniz!", "error");
      setDeleteUserModal(null);
      return;
    }
    setDeleteUserLoading(true);
    try {
      await deleteUser(
        deleteUserModal.uid,
        deleteUserModal.displayName,
        currentUser.uid,
        currentUser.displayName,
        currentUser.role
      );
      showToast(`"${deleteUserModal.displayName}" personeli sistemden silindi.`, "success");
      setDeleteUserModal(null);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || "Silme işlemi başarısız oldu.", "error");
    } finally {
      setDeleteUserLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchAnnouncements();
    fetchCompanyProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCompanyProfile = async () => {
    try {
      const data = await getCompanyProfile();
      setProfile(data);
    } catch (err) {
      console.error("Şirket profili yüklenirken hata:", err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setProfileSaving(true);
    try {
      await updateCompanyProfile(profile, currentUser.uid, currentUser.displayName, currentUser.role);
      showToast("Şirket profil bilgileri başarıyla güncellendi.", "success");
    } catch (err: any) {
      showToast("Güncelleme sırasında hata oluştu: " + err.message, "error");
    } finally {
      setProfileSaving(false);
    }
  };

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
        const querySnapshot = await getDocs(collection(firestore!, "users"));
        const fbUsers = querySnapshot.docs
          .map((doc) => ({ id: doc.id, uid: doc.id, ...doc.data() } as any))
          .filter((u) => !u.disabled);
        setUsers(fbUsers);
      } else {
        const localUsers = localStorage.getItem("takip_users");
        let list: AppUser[] = [];
        if (localUsers) {
          try {
            list = JSON.parse(localUsers);
          } catch (err) {
            console.error("Kullanıcı listesi parse hatası:", err);
            list = [];
          }
        }
        let updated = false;
        for (const initUser of INITIAL_USERS) {
          if (!list.some((u) => u.email.toLowerCase() === initUser.email.toLowerCase())) {
            list.push(initUser);
            updated = true;
          }
        }
        if (updated || !localUsers) {
          localStorage.setItem("takip_users", JSON.stringify(list));
        }
        setUsers(list.filter((u: AppUser) => !u.disabled));
      }
    } catch (err) {
      console.error("Kullanıcılar yüklenirken hata:", err);
    } finally {
      setLoading(false);
    }
  };

  const [createdCredentials, setCreatedCredentials] = useState<{
    displayName: string;
    loginUsername: string;
    email: string;
    role: string;
    password: string;
  } | null>(null);

  const handleUserRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError("");
    setCreatedCredentials(null);

    if (!userForm.displayName || !userForm.email) {
      setUserError("Lütfen tüm alanları doldurun.");
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanInput = userForm.email.trim().toLowerCase();
      const email = cleanInput.includes("@") ? cleanInput : `${cleanInput}@takip.com`;
      const password = userForm.password && userForm.password.trim() ? userForm.password.trim() : "123456";

      if (userForm.password && userForm.password.trim().length < 6) {
        throw new Error("Belirttiğiniz şifre en az 6 karakter olmalıdır!");
      }

      await registerUser(email, password, userForm.displayName, userForm.role, currentUser);

      setCreatedCredentials({
        displayName: userForm.displayName,
        loginUsername: cleanInput.includes("@") ? cleanInput.split("@")[0] : cleanInput,
        email,
        role: userForm.role === 'admin' ? 'Yönetici' : userForm.role === 'accounting' ? 'Muhasebeci' : userForm.role === 'sysadmin' ? 'Sistem Yöneticisi' : 'Satışçı',
        password
      });

      setUserForm({ displayName: "", email: "", role: "sales", password: "" });

      fetchUsers();
    } catch (err: any) {
      setUserError(err.message || "Kullanıcı oluşturulurken bir hata meydana geldi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const [sales, products, customers] = await Promise.all([getSales(), getProducts(), getCustomers()]);

      const wb = XLSX.utils.book_new();

      const formattedSales = sales.map((s) => ({
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

      const formattedProducts = products.map((p) => ({
        "Ürün Kodu": p.code,
        "Ürün Adı": p.name,
        "Kategori": p.categoryName,
        "Birim Fiyat (₺)": p.price,
        "Mevcut Stok": p.stock,
        "Kritik Limit": p.criticalStock,
        "Birim": p.unit,
        "Kritik Stok Uyarısı": p.stock <= p.criticalStock ? "EVET" : "HAYIR"
      }));

      const formattedCustomers = customers.map((c) => ({
        "Firma Unvanı": c.company,
        "İsim Soyisim": c.name,
        "Telefon": c.phone || "-",
        "E-posta": c.email || "-",
        "Vergi Dairesi": c.taxOffice || "-",
        "Vergi Numarası": c.taxNumber || "-",
        "Adres": c.address || "-"
      }));

      const wsSales = XLSX.utils.json_to_sheet(formattedSales);
      const wsProducts = XLSX.utils.json_to_sheet(formattedProducts);
      const wsCustomers = XLSX.utils.json_to_sheet(formattedCustomers);

      XLSX.utils.book_append_sheet(wb, wsSales, "Satış Raporları");
      XLSX.utils.book_append_sheet(wb, wsProducts, "Ürün & Stok Listesi");
      XLSX.utils.book_append_sheet(wb, wsCustomers, "Müşteri Rehberi");

      XLSX.writeFile(wb, `Takip_Sistemi_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`);

      setBackupSuccess("Excel raporu başarıyla oluşturuldu ve indirildi.");
      setTimeout(() => setBackupSuccess(""), 4000);
    } catch (err: any) {
      setBackupError("Excel dışa aktarımı başarısız: " + err.message);
      setTimeout(() => setBackupError(""), 4000);
    }
  };

  const handleExportBackup = () => {
    try {
      const dataStr = exportBackupData();
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

      const exportFileDefaultName = `takip_yedek_${new Date().toISOString().split('T')[0]}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();

      setBackupSuccess("Sistem yedek dosyası başarıyla indirildi.");
      setTimeout(() => setBackupSuccess(""), 4000);
    } catch (err: any) {
      setBackupError("Yedekleme dosyası oluşturulamadı: " + err.message);
      setTimeout(() => setBackupError(""), 4000);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = e.target.files?.[0];

    if (!file) return;

    fileReader.onload = (event) => {
      try {
        const fileContent = event.target?.result as string;
        const success = importBackupData(fileContent);
        if (success) {
          setBackupSuccess("Sistem yedeği başarıyla geri yüklendi! Sayfa yenileniyor...");
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } catch (err: any) {
        setBackupError("Yedekten geri yükleme başarısız! Dosyayı kontrol edin: " + err.message);
        setTimeout(() => setBackupError(""), 5000);
      }
    };
    fileReader.readAsText(file, "UTF-8");
  };

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
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
    } catch (err: any) {
      showToast("Duyuru yayınlanırken hata: " + err.message, "error");
    } finally {
      setAnnLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (annId: string) => {
    if (!currentUser) return;
    if (window.confirm("Bu duyuruyu silmek istediğinize emin misiniz?")) {
      try {
        await deleteAnnouncement(annId, currentUser.uid, currentUser.displayName, currentUser.role);
        showToast("Duyuru silindi.", "success");
        fetchAnnouncements();
      } catch (err: any) {
        showToast("Duyuru silinirken hata: " + err.message, "error");
      }
    }
  };

  if (!currentUser) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "1.5rem" }} className="grid-cols-2 animate-fade">

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        <section className="card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <UserPlus size={18} />
            <span>Yeni Personel Kaydı</span>
          </h3>

          {createdCredentials && (
            <div style={{
              backgroundColor: "var(--success-light)",
              border: "1px solid var(--success)",
              borderRadius: "var(--radius-md)",
              padding: "1rem",
              marginBottom: "1.25rem",
              color: "var(--text-primary)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, color: "var(--success)", marginBottom: "0.5rem" }}>
                <Check size={18} />
                <span>Personel Başarıyla Oluşturuldu!</span>
              </div>
              <div style={{ fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "0.4rem", backgroundColor: "var(--bg-primary)", padding: "0.85rem", borderRadius: "var(--radius-sm)", border: "1px dashed var(--border-color)" }}>
                <div><strong>Ad Soyad:</strong> {createdCredentials.displayName}</div>
                <div><strong>Yetki Rolü:</strong> {createdCredentials.role}</div>
                <div><strong>Giriş Kullanıcı Adı:</strong> <code style={{ color: "var(--primary)", fontWeight: 700, backgroundColor: "var(--primary-light)", padding: "2px 6px", borderRadius: "4px" }}>{createdCredentials.loginUsername}</code> (veya {createdCredentials.email})</div>
                <div><strong>Giriş Şifresi:</strong> <code style={{ color: "var(--primary)", fontWeight: 700, backgroundColor: "var(--primary-light)", padding: "2px 6px", borderRadius: "4px" }}>{createdCredentials.password}</code></div>
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0.5rem 0 0 0" }}>
                💡 Bu giriş bilgilerini personelinize iletiniz. Personel hem telefondan hem de bilgisayardan bu bilgilerle doğrudan giriş yapabilir.
              </p>
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
                onChange={(e) => setUserForm({ ...userForm, displayName: e.target.value })}
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
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Sistem Yetkisi (Rol)</label>
              <select
                className="form-control"
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value as Role })}
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
                placeholder="Varsayılan: 123456 (Değiştirebilirsiniz)"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                autoComplete="off"
              />
              <small style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                Boş bırakırsanız personelin ilk giriş şifresi otomatik olarak <strong>123456</strong> yapılır.
              </small>
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

        <section className="card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>Aktif Sistem Kullanıcıları</h3>

          <div className="table-container">
            <table className="table" style={{ fontSize: "0.875rem" }}>
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>Kullanıcı Adı</th>
                  <th>Yetki Rolü</th>
                  <th style={{ width: "160px", textAlign: "center" }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3].map((i) => (
                    <tr key={i}>
                      <td><div className="skeleton" style={{ height: "18px", width: "120px" }} /></td>
                      <td><div className="skeleton" style={{ height: "18px", width: "160px" }} /></td>
                      <td><div className="skeleton" style={{ height: "18px", width: "90px" }} /></td>
                      <td style={{ textAlign: "center" }}><div className="skeleton" style={{ height: "24px", width: "80px", margin: "0 auto" }} /></td>
                    </tr>
                  ))
                ) : (
                  users.map((u, idx) => {
                    const isSelf = u.uid === currentUser?.uid;
                    const username = u.email ? u.email.split("@")[0] : "-";

                    const getRoleBadge = (role: string) => {
                      switch (role) {
                        case "admin":
                          return <span style={{ backgroundColor: "rgba(239, 68, 68, 0.12)", color: "var(--danger)", padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 700 }}>Yönetici (Patron)</span>;
                        case "accounting":
                          return <span style={{ backgroundColor: "rgba(245, 158, 11, 0.12)", color: "#d97706", padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 700 }}>Muhasebeci</span>;
                        case "sales":
                          return <span style={{ backgroundColor: "rgba(99, 102, 241, 0.12)", color: "var(--primary)", padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 700 }}>Satışçı</span>;
                        case "sysadmin":
                          return <span style={{ backgroundColor: "rgba(16, 185, 129, 0.12)", color: "var(--success)", padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 700 }}>Sistem Yöneticisi</span>;
                        default:
                          return <span style={{ backgroundColor: "rgba(100, 116, 139, 0.12)", color: "var(--text-secondary)", padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 700 }}>{role}</span>;
                      }
                    };

                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{u.displayName}</td>
                        <td>
                          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{username}</span>
                        </td>
                        <td>{getRoleBadge(u.role)}</td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                            <button
                              type="button"
                              onClick={() => setEditUserModal({ user: u, displayName: u.displayName, role: u.role })}
                              style={{
                                color: "var(--primary)",
                                background: "rgba(99, 102, 241, 0.08)",
                                border: "1px solid rgba(99, 102, 241, 0.2)",
                                borderRadius: "var(--radius-sm)",
                                padding: "0.35rem 0.6rem",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                                fontSize: "0.8rem",
                                fontWeight: 600
                              }}
                              title="Personeli Düzenle"
                            >
                              <SquarePen size={14} />
                              <span>Düzenle</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeleteUserModal(u)}
                              style={{
                                color: isSelf ? "var(--text-muted)" : "var(--danger)",
                                background: isSelf ? "transparent" : "rgba(239, 68, 68, 0.08)",
                                border: isSelf ? "1px solid transparent" : "1px solid rgba(239, 68, 68, 0.2)",
                                borderRadius: "var(--radius-sm)",
                                padding: "0.35rem 0.6rem",
                                cursor: isSelf ? "not-allowed" : "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                                fontSize: "0.8rem",
                                fontWeight: 600
                              }}
                              disabled={isSelf}
                              title={isSelf ? "Kendi hesabınızı silemezsiniz!" : "Kullanıcıyı Sil"}
                            >
                              <Trash2 size={14} />
                              <span>Sil</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

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
                rows={2}
                placeholder="Örn: 27 Haziran Cumartesi günü sistem bakım çalışması yapılacaktır."
                value={annForm}
                onChange={(e) => setAnnForm(e.target.value)}
                maxLength={200}
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
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
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

        <section className="card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Building size={18} />
            <span>Şirket Profil Bilgileri</span>
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Satış fişlerinin (Proforma fatura) üst kısmında yer alacak şirket unvanı, adres, vergi dairesi ve vergi numarası gibi resmi bilgileri buradan düzenleyebilirsiniz.
          </p>

          {profileLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="skeleton" style={{ height: "40px", width: "100%" }} />
              <div className="skeleton" style={{ height: "60px", width: "100%" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="skeleton" style={{ height: "40px" }} />
                <div className="skeleton" style={{ height: "40px" }} />
              </div>
            </div>
          ) : (
            <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Şirket Unvanı</label>
                <input
                  type="text"
                  className="form-control"
                  value={profile.companyName}
                  onChange={(e) => setProfile({ ...profile, companyName: e.target.value.toUpperCase() })}
                  placeholder="ÖZKON YAPI"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Açık Adres</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={profile.address}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  placeholder="Şirket adresi..."
                  style={{ resize: "none" }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">Telefon</label>
                  <input
                    type="text"
                    className="form-control"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="0212..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Faks</label>
                  <input
                    type="text"
                    className="form-control"
                    value={profile.fax}
                    onChange={(e) => setProfile({ ...profile, fax: e.target.value })}
                    placeholder="0212..."
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">Vergi Dairesi</label>
                  <input
                    type="text"
                    className="form-control"
                    value={profile.taxOffice}
                    onChange={(e) => setProfile({ ...profile, taxOffice: e.target.value })}
                    placeholder="Maslak"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Vergi Numarası</label>
                  <input
                    type="text"
                    className="form-control"
                    value={profile.taxNumber}
                    onChange={(e) => setProfile({ ...profile, taxNumber: e.target.value.replace(/\D/g, "") })}
                    placeholder="10 Haneli No"
                    maxLength={10}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "100%", height: "40px", marginTop: "0.5rem" }}
                disabled={profileSaving}
              >
                {profileSaving ? "Kaydediliyor..." : "Profil Bilgilerini Kaydet"}
              </button>
            </form>
          )}
        </section>

      </div>

      {/* --- KULLANICI DÜZENLEME MODALI --- */}
      {editUserModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            backgroundColor: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem"
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="card card-glass animate-slide-up"
            style={{
              width: "100%",
              maxWidth: "460px",
              padding: "1.75rem",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-xl)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
                <SquarePen size={20} color="var(--primary)" />
                <span>Personel Bilgilerini Düzenle</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditUserModal(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "0.25rem" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser}>
              <div className="form-group">
                <label className="form-label">Personel Ad Soyad</label>
                <input
                  type="text"
                  className="form-control"
                  value={editUserModal.displayName}
                  onChange={(e) => setEditUserModal({ ...editUserModal, displayName: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Kullanıcı Adı</label>
                <input
                  type="text"
                  className="form-control"
                  value={editUserModal.user.email ? editUserModal.user.email.split("@")[0] : ""}
                  disabled
                  style={{ backgroundColor: "var(--bg-secondary)", cursor: "not-allowed" }}
                />
                <small style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                  Kullanıcı adı güvenlik sebebiyle değiştirilemez.
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Yetki Rolü</label>
                <select
                  className="form-control"
                  value={editUserModal.role}
                  onChange={(e) => setEditUserModal({ ...editUserModal, role: e.target.value as Role })}
                  disabled={editUserModal.user.uid === currentUser?.uid}
                >
                  <option value="sales">Satış Temsilcisi (Satışçı)</option>
                  <option value="accounting">Muhasebe Sorumlusu (Muhasebeci)</option>
                  <option value="admin">Yönetici (Patron)</option>
                  <option value="sysadmin">Sistem Yöneticisi</option>
                </select>
                {editUserModal.user.uid === currentUser?.uid && (
                  <small style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                    Kendi hesabınızın rolünü değiştiremezsiniz.
                  </small>
                )}
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setEditUserModal(null)}
                  disabled={editUserSaving}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={editUserSaving}
                >
                  {editUserSaving ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ÖZEL KULLANICI SİLME ONAY MODALI --- */}
      {deleteUserModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            backgroundColor: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem"
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="card card-glass animate-slide-up"
            style={{
              width: "100%",
              maxWidth: "440px",
              padding: "1.75rem",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-xl)",
              textAlign: "center"
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: "rgba(239, 68, 68, 0.12)",
                color: "var(--danger)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1rem auto"
              }}
            >
              <AlertTriangle size={28} />
            </div>

            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Personeli Silmek İstiyor musunuz?
            </h3>

            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: "1.5", marginBottom: "1.5rem" }}>
              <strong>"{deleteUserModal.displayName}"</strong> (<code>{deleteUserModal.email ? deleteUserModal.email.split("@")[0] : ""}</code>) isimli personeli sistemden silmek üzeresiniz. 
              <br /><br />
              Bu personelin sisteme erişimi derhal durdurulacaktır. Devam etmek istiyor musunuz?
            </p>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setDeleteUserModal(null)}
                disabled={deleteUserLoading}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={handleConfirmDeleteUser}
                disabled={deleteUserLoading}
              >
                {deleteUserLoading ? "Siliniyor..." : "Evet, Personeli Sil"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SettingsPage;
