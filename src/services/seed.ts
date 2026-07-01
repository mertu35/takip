// Takip Sistemi - Firebase Canlı İlklendirme ve Seed Servisleri
// (Sadece Firebase modunda anlamlıdır; mock modda no-op döner.)
import { collection, query, where, limit, getDocs, setDoc, doc, addDoc } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { firestore, isFirebaseActive } from "./firebase";
import firebaseConfig from "./firebase";
import {
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  INITIAL_LOGS
} from "./mockData";

export async function isDatabaseInitialized(): Promise<boolean> {
  if (!isFirebaseActive) return true;
  try {
    const q = query(collection(firestore!, "users"), where("role", "==", "sysadmin"), limit(1));
    const snap = await getDocs(q);
    return !snap.empty;
  } catch (e) {
    console.error("Veritabanı kontrol hatası:", e);
    return true; // Hata halinde tedbiren true dönüyoruz
  }
}

async function createOrSignIn(tempAuth: ReturnType<typeof getAuth>, email: string, password: string) {
  try {
    const cred = await createUserWithEmailAndPassword(tempAuth, email, password);
    return cred.user.uid;
  } catch (authError: any) {
    if (authError.code === "auth/email-already-in-use") {
      const cred = await signInWithEmailAndPassword(tempAuth, email, password);
      return cred.user.uid;
    }
    throw authError;
  }
}

export async function initializeFirebaseDatabase(
  adminEmail: string,
  adminPassword: string,
  adminName: string
): Promise<boolean> {
  if (!isFirebaseActive) return false;

  const tempAppName = "InitApp_" + Math.random().toString(36).substring(2, 11);
  const tempApp = initializeApp(firebaseConfig, tempAppName);
  const tempAuth = getAuth(tempApp);

  try {
    const uid = await createOrSignIn(tempAuth, adminEmail, adminPassword);

    const sysAdminEmail = import.meta.env.VITE_SEED_SYSADMIN_EMAIL || "sysadmin@takip.com";
    const sysAdminPassword = import.meta.env.VITE_SEED_SYSADMIN_PASSWORD || "sysadmin123";
    const sysAdminUid = await createOrSignIn(tempAuth, sysAdminEmail, sysAdminPassword);

    const salesEmail = import.meta.env.VITE_SEED_SALES_EMAIL || "satis@takip.com";
    const salesPassword = import.meta.env.VITE_SEED_SALES_PASSWORD || "sales123";
    const salesUid = await createOrSignIn(tempAuth, salesEmail, salesPassword);

    const accountingEmail = import.meta.env.VITE_SEED_ACCOUNTING_EMAIL || "muhasebe@takip.com";
    const accountingPassword = import.meta.env.VITE_SEED_ACCOUNTING_PASSWORD || "accounting123";
    const accountingUid = await createOrSignIn(tempAuth, accountingEmail, accountingPassword);

    await deleteApp(tempApp);

    await setDoc(doc(firestore!, "users", uid), {
      uid,
      email: adminEmail,
      displayName: adminName,
      role: "admin",
      createdAt: new Date().toISOString()
    });
    await setDoc(doc(firestore!, "users", sysAdminUid), {
      uid: sysAdminUid,
      email: sysAdminEmail,
      displayName: "Sistem Yöneticisi",
      role: "sysadmin",
      createdAt: new Date().toISOString()
    });
    await setDoc(doc(firestore!, "users", salesUid), {
      uid: salesUid,
      email: salesEmail,
      displayName: "Ali Satışçı",
      role: "sales",
      createdAt: new Date().toISOString()
    });
    await setDoc(doc(firestore!, "users", accountingUid), {
      uid: accountingUid,
      email: accountingEmail,
      displayName: "Canan Muhasebeci",
      role: "accounting",
      createdAt: new Date().toISOString()
    });

    for (const cat of INITIAL_CATEGORIES) {
      await setDoc(doc(firestore!, "categories", cat.id), cat);
    }
    for (const prod of INITIAL_PRODUCTS) {
      await setDoc(doc(firestore!, "products", prod.id), { ...prod, createdAt: new Date().toISOString() });
    }
    for (const cust of INITIAL_CUSTOMERS) {
      await setDoc(doc(firestore!, "customers", cust.id), { ...cust, createdAt: new Date().toISOString() });
    }
    for (const log of INITIAL_LOGS) {
      await addDoc(collection(firestore!, "logs"), log);
    }
    await setDoc(doc(firestore!, "announcements", "ann-1"), {
      id: "ann-1",
      text: "Özkon Çelik Takip Sistemine Hoş Geldiniz! İyi çalışmalar dileriz.",
      active: true,
      createdAt: new Date().toISOString()
    });

    return true;
  } catch (error: any) {
    console.error("Veritabanı ilklendirilirken hata:", error);
    throw new Error("Veritabanı kurulum hatası: " + error.message);
  }
}
