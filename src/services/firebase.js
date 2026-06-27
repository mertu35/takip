// Takip Sistemi - Firebase Yapılandırması ve Durum Kontrolü
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Çevre değişkenlerinden Firebase yapılandırmasını al
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

let app = null;
let auth = null;
let firestore = null;
let storage = null;
let isFirebaseActive = false;

// Yapılandırma değerlerinin geçerli olup olmadığını kontrol et
const isValidConfig = firebaseConfig.apiKey && 
                      firebaseConfig.projectId && 
                      firebaseConfig.apiKey !== "YOUR_API_KEY";

if (isValidConfig) {
  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
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
