// Takip Sistemi - Firebase Yapılandırması ve Durum Kontrolü
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Çevre değişkenlerinden Firebase yapılandırmasını al
const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let isFirebaseActive = false;

// Yapılandırma değerlerinin geçerli olup olmadığını kontrol et
const isValidConfig =
  !!firebaseConfig.apiKey &&
  !!firebaseConfig.projectId &&
  firebaseConfig.apiKey !== "YOUR_API_KEY";

if (isValidConfig) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    firestore = getFirestore(app);
    storage = getStorage(app);
    isFirebaseActive = true;
    console.log("Firebase başarıyla başlatıldı.");
  } catch (error) {
    console.error("Firebase başlatılırken hata oluştu, Yerel Simülasyon moduna geçiliyor:", error);
    isFirebaseActive = false;
  }
} else {
  console.log("Firebase yapılandırması eksik veya geçersiz. Yerel Simülasyon (Local Mock) modunda çalışılıyor.");
}

export { app, auth, firestore, storage, isFirebaseActive };
export default firebaseConfig;
