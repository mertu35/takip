// Takip Sistemi - Şirket Profili (Settings) Repository
import { doc, getDoc, setDoc } from "firebase/firestore";
import { firestore, isFirebaseActive } from "../firebase";
import type { CompanyProfile, ActorInfo } from "../../types";
import { getLocalData, setLocalData } from "./localStorageUtils";
import { logsRepository } from "./logsRepository";

const DEFAULT_PROFILE: CompanyProfile = {
  companyName: "ÖZKON ÇELİK",
  address: "Merkez Mah. Çelik Sanayi Bulvarı No: 45 Sarıyer / İstanbul",
  phone: "0212 999 88 77",
  fax: "0212 999 88 78",
  taxOffice: "Maslak",
  taxNumber: "6540987654"
};

export interface SettingsRepository {
  getCompanyProfile(): Promise<CompanyProfile>;
  updateCompanyProfile(profile: CompanyProfile, actor: ActorInfo): Promise<void>;
}

const firebaseSettingsRepository: SettingsRepository = {
  async getCompanyProfile() {
    try {
      const docRef = doc(firestore!, "settings", "company_profile");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) return docSnap.data() as CompanyProfile;
    } catch (e) {
      console.error("Şirket profili yüklenemedi:", e);
    }
    return DEFAULT_PROFILE;
  },
  async updateCompanyProfile(profile, actor) {
    const docRef = doc(firestore!, "settings", "company_profile");
    await setDoc(
      docRef,
      { ...profile, updatedAt: new Date().toISOString(), updatedBy: actor.currentUserName },
      { merge: true }
    );
    await logsRepository.add(actor, "UPDATE_COMPANY_PROFILE", "Şirket profil bilgileri güncellendi.");
  }
};

// Bu anahtarların singleton (tek kayıt) olarak saklanacağı LocalStorage anahtarı
const LOCAL_KEY = "takip_company_profile";

const mockSettingsRepository: SettingsRepository = {
  async getCompanyProfile() {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as CompanyProfile;
      } catch {
        // düşer, varsayılana geri döner
      }
    }
    return DEFAULT_PROFILE;
  },
  async updateCompanyProfile(profile, actor) {
    localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify({ ...profile, updatedAt: new Date().toISOString(), updatedBy: actor.currentUserName })
    );
    await logsRepository.add(actor, "UPDATE_COMPANY_PROFILE", "Şirket profil bilgileri güncellendi.");
  }
};

export const settingsRepository: SettingsRepository = isFirebaseActive
  ? firebaseSettingsRepository
  : mockSettingsRepository;

// exportBackupData / importBackupData sadece mock mod için anlamlıdır
// (Firebase modunda gerçek yedekleme Firebase Console/Export araçlarıyla yapılır).
export function exportBackupData(): string {
  const backup = {
    customers: getLocalData("takip_customers"),
    products: getLocalData("takip_products"),
    categories: getLocalData("takip_categories"),
    sales: getLocalData("takip_sales"),
    logs: getLocalData("takip_logs"),
    users: getLocalData("takip_users"),
    backupDate: new Date().toISOString()
  };
  return JSON.stringify(backup, null, 2);
}

export function importBackupData(jsonString: string): boolean {
  const data = JSON.parse(jsonString);
  if (!data || typeof data !== "object") {
    throw new Error("Geçersiz yedek dosyası!");
  }
  if (!Array.isArray(data.customers) || !Array.isArray(data.products) || !Array.isArray(data.sales)) {
    throw new Error("Geçersiz yedek formatı! Gerekli tablolar (customers, products, sales) bulunamadı veya liste formatında değil.");
  }
  if (data.categories && !Array.isArray(data.categories)) throw new Error("Geçersiz kategori formatı!");
  if (data.logs && !Array.isArray(data.logs)) throw new Error("Geçersiz günlük formatı!");
  if (data.users && !Array.isArray(data.users)) throw new Error("Geçersiz kullanıcı formatı!");

  setLocalData("takip_customers", data.customers);
  setLocalData("takip_products", data.products);
  if (data.categories) setLocalData("takip_categories", data.categories);
  setLocalData("takip_sales", data.sales);
  setLocalData("takip_logs", data.logs || []);
  if (data.users) setLocalData("takip_users", data.users);
  return true;
}
