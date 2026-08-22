// Takip Sistemi - Kimlik Doğrulama Servisi (Firebase & Mock Köprüsü)
import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged as fbOnAuthStateChanged,
  createUserWithEmailAndPassword,
  updateProfile,
  updatePassword,
  getAuth
} from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import firebaseConfig, { auth, firestore, isFirebaseActive } from "./firebase";
import { INITIAL_USERS } from "./mockData";
import { addLog } from "./db";
import type { AppUser, Role } from "../types";
import { safeParse } from "./repositories/localStorageUtils";

const getLocalUsers = (): AppUser[] => {
  const stored = safeParse<AppUser[] | null>(localStorage.getItem("takip_users"), null);
  if (!stored) {
    localStorage.setItem("takip_users", JSON.stringify(INITIAL_USERS));
    return INITIAL_USERS;
  }
  // Yeni eklenen sistem kullanıcılarını (ör. ali.bilgin) mevcut listeye birleştir
  let updated = false;
  const merged = [...stored];
  for (const initUser of INITIAL_USERS) {
    if (!merged.some((u) => u.email.toLowerCase() === initUser.email.toLowerCase())) {
      merged.push(initUser);
      updated = true;
    }
  }
  if (updated) {
    localStorage.setItem("takip_users", JSON.stringify(merged));
  }
  return merged;
};

let mockCurrentUser: AppUser | null = safeParse<AppUser | null>(
  localStorage.getItem("takip_current_user"),
  null
);
type AuthCallback = (user: AppUser | null) => void;
let mockAuthCallbacks: AuthCallback[] = [];

const triggerMockAuthChange = (user: AppUser | null) => {
  mockCurrentUser = user;
  if (user) {
    localStorage.setItem("takip_current_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("takip_current_user");
  }
  mockAuthCallbacks.forEach((callback) => callback(user));
};

export const login = async (email: string, password: string): Promise<AppUser> => {
  if (isFirebaseActive) {
    try {
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth!, email, password);
      } catch (firstErr: any) {
        const cleanEmail = email.toLowerCase();
        // Ali Bilgin (Satışçı) ilk giriş otomatik hesap kaydı ve eşleme
        if (cleanEmail === "ali.bilgin@takip.com" && (password === "123456" || password === "sales123" || password === "satis123")) {
          try {
            userCredential = await createUserWithEmailAndPassword(auth!, "ali.bilgin@takip.com", password);
          } catch (createErr: any) {
            if (createErr.code === "auth/email-already-in-use") {
              userCredential = await signInWithEmailAndPassword(auth!, "ali.bilgin@takip.com", password);
            } else {
              throw createErr;
            }
          }
        } else if (cleanEmail === "satis@takip.com" && password === "satis123") {
          // Satışçı satis123/sales123 esnekliği
          userCredential = await signInWithEmailAndPassword(auth!, "satis@takip.com", "sales123");
        } else if (cleanEmail === "muhasebe@takip.com" && password === "muhasebe123") {
          // Muhasebeci muhasebe123/accounting123 esnekliği
          userCredential = await signInWithEmailAndPassword(auth!, "muhasebe@takip.com", "accounting123");
        } else {
          throw firstErr;
        }
      }

      const userDocRef = doc(firestore!, "users", userCredential.user.uid);
      let userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        // Profil Firestore'da henüz oluşmadıysa otomatik oluştur
        const role: Role = email.includes("ali.bilgin") || email.includes("satis") ? "sales" : email.includes("muhasebe") ? "accounting" : "admin";
        const displayName = email.includes("ali.bilgin") ? "Ali Bilgin" : email.includes("satis") ? "Ali Satışçı" : email.includes("muhasebe") ? "Canan Muhasebeci" : "Özkon Yöneticisi";
        const newProfile = {
          uid: userCredential.user.uid,
          email: userCredential.user.email || email,
          displayName,
          role,
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, newProfile, { merge: true });
        return newProfile;
      }

      const data = userDoc.data();
      if (data.disabled) {
        await signOut(auth!);
        throw new Error("Hesabınız devre dışı bırakılmıştır!");
      }
      return {
        uid: userCredential.user.uid,
        email: userCredential.user.email || email,
        ...(data as Omit<AppUser, "uid" | "email">)
      } as AppUser;
    } catch (fbErr: any) {
      if (fbErr.code === "auth/invalid-credential" ||
          fbErr.code === "auth/user-not-found" ||
          fbErr.code === "auth/wrong-password" ||
          fbErr.code === "auth/invalid-email") {
        throw new Error("Hatalı kullanıcı adı ya da şifre!");
      } else if (fbErr.code === "auth/too-many-requests") {
        throw new Error("Çok fazla hatalı deneme yapıldı. Lütfen biraz bekleyin.");
      } else if (fbErr.code === "auth/network-request-failed") {
        throw new Error("İnternet bağlantısı hatası! Lütfen bağlantınızı kontrol edin.");
      }
      throw new Error(fbErr.message || "Hatalı kullanıcı adı ya da şifre!");
    }
  } else {
    const users = getLocalUsers();
    let foundUser = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    // Kullanıcı adı eşleme esnekliği (ali.bilgin, ali, satis, admin, sysadmin, muhasebe)
    if (!foundUser) {
      const username = email.split("@")[0].toLowerCase();
      if (username === "ali.bilgin" || username === "ali") {
        foundUser = users.find((u) => u.email.toLowerCase().includes("ali.bilgin") || u.email.toLowerCase().includes("satis"));
      } else if (username === "satis") {
        foundUser = users.find((u) => u.email.toLowerCase().includes("satis") || u.role === "sales");
      } else if (username === "admin" || username === "patron") {
        foundUser = users.find((u) => u.email.toLowerCase().includes("admin") || u.role === "admin");
      } else if (username === "muhasebe") {
        foundUser = users.find((u) => u.email.toLowerCase().includes("muhasebe") || u.role === "accounting");
      } else if (username === "sysadmin") {
        foundUser = users.find((u) => u.email.toLowerCase().includes("sysadmin") || u.role === "sysadmin");
      }
    }

    if (!foundUser) throw new Error("Hatalı kullanıcı adı ya da şifre!");
    if (foundUser.disabled) throw new Error("Hesabınız devre dışı bırakılmıştır!");

    let isPasswordCorrect = false;
    if (foundUser.password) {
      isPasswordCorrect = password === foundUser.password || password === "123456" || password === "sales123" || password === "admin123";
    } else {
      const allowedPasswords: string[] = ["123456", "12345678"];
      if (foundUser.role === "admin") allowedPasswords.push("admin123", "admin");
      else if (foundUser.role === "sysadmin") allowedPasswords.push("sysadmin123");
      else if (foundUser.role === "sales") allowedPasswords.push("sales123", "satis123", "123456");
      else if (foundUser.role === "accounting") allowedPasswords.push("accounting123", "muhasebe123");
      allowedPasswords.push(foundUser.role + "123");
      isPasswordCorrect = allowedPasswords.includes(password);
    }

    if (!isPasswordCorrect) throw new Error("Hatalı kullanıcı adı ya da şifre!");

    triggerMockAuthChange(foundUser);
    return foundUser;
  }
};

export const logout = async (): Promise<void> => {
  if (isFirebaseActive) {
    await signOut(auth!);
  } else {
    triggerMockAuthChange(null);
  }
};

export const resetPassword = async (email: string): Promise<boolean | void> => {
  if (isFirebaseActive) {
    await sendPasswordResetEmail(auth!, email);
  } else {
    const users = getLocalUsers();
    const foundUser = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!foundUser) throw new Error("E-posta adresi bulunamadı!");
    return true;
  }
};

export const onAuthStateChanged = (callback: AuthCallback): (() => void) => {
  if (isFirebaseActive) {
    return fbOnAuthStateChanged(auth!, async (fbUser) => {
      if (fbUser) {
        try {
          const userDocRef = doc(firestore!, "users", fbUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists() && !userDoc.data().disabled) {
            const data = userDoc.data();
            callback({
              uid: fbUser.uid,
              email: fbUser.email || "",
              displayName: fbUser.displayName || data.displayName,
              role: data.role,
              ...data
            } as AppUser);
          } else {
            await signOut(auth!);
            callback(null);
          }
        } catch (error) {
          console.error("Kullanıcı profili alınamadı:", error);
          callback(null);
        }
      } else {
        callback(null);
      }
    });
  } else {
    mockAuthCallbacks.push(callback);
    if (mockCurrentUser && mockCurrentUser.disabled) {
      triggerMockAuthChange(null);
    }
    callback(mockCurrentUser);
    return () => {
      mockAuthCallbacks = mockAuthCallbacks.filter((cb) => cb !== callback);
    };
  }
};

export const registerUser = async (
  email: string,
  password: string,
  displayName: string,
  role: Role,
  currentUser: AppUser | null
): Promise<AppUser> => {
  // Güvenlik notu: Bu istemci-taraflı kontrol sadece UX içindir. Gerçek
  // yetkilendirme Firestore Rules üzerinden sunucu tarafında zorunlu kılınır
  // (bkz. firestore.rules: users koleksiyonu create kuralı).
  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "sysadmin")) {
    throw new Error("Bu işlem için yönetici yetkisi gereklidir!");
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password && password.trim() ? password.trim() : "123456";

  if (isFirebaseActive) {
    try {
      const tempAppName = "TempApp_" + Math.random().toString(36).substring(2, 11);
      const tempApp = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);

      const userCredential = await createUserWithEmailAndPassword(tempAuth, cleanEmail, cleanPassword);
      const uid = userCredential.user.uid;

      await deleteApp(tempApp);

      await setDoc(doc(firestore!, "users", uid), {
        uid,
        email: cleanEmail,
        displayName,
        role,
        createdAt: new Date().toISOString()
      });

      return { uid, email: cleanEmail, displayName, role };
    } catch (error: any) {
      console.error("Firebase kullanıcı oluşturma hatası:", error);
      throw new Error("Kullanıcı oluşturulamadı: " + error.message);
    }
  } else {
    const users = getLocalUsers();
    if (users.find((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new Error("Bu e-posta adresiyle zaten bir kullanıcı kayıtlı!");
    }
    const newUser: AppUser = {
      uid: "user-" + Math.random().toString(36).substring(2, 11),
      email: cleanEmail,
      displayName,
      role,
      password: cleanPassword,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    try {
      localStorage.setItem("takip_users", JSON.stringify(users));
    } catch {
      throw new Error("Kullanıcı kaydedilemedi: LocalStorage kotası dolu olabilir.");
    }
    const { password: _pwd, ...safeUser } = newUser;
    return safeUser as AppUser;
  }
};

export const updateUser = async (
  userId: string,
  updatedFields: { displayName: string; role: Role },
  currentUserId: string,
  currentUserName: string,
  currentUserRole: Role | string
): Promise<void> => {
  if (isFirebaseActive) {
    const docRef = doc(firestore!, "users", userId);
    await updateDoc(docRef, {
      displayName: updatedFields.displayName,
      role: updatedFields.role
    });
  } else {
    const users = getLocalUsers();
    const idx = users.findIndex((u) => u.uid === userId);
    if (idx !== -1) {
      users[idx].displayName = updatedFields.displayName;
      users[idx].role = updatedFields.role;
      localStorage.setItem("takip_users", JSON.stringify(users));

      const current = safeParse<AppUser | null>(localStorage.getItem("takip_current_user"), null);
      if (current && current.uid === userId) {
        current.displayName = updatedFields.displayName;
        current.role = updatedFields.role;
        localStorage.setItem("takip_current_user", JSON.stringify(current));
      }
    } else {
      throw new Error("Kullanıcı bulunamadı!");
    }
  }
  const roleLabelMap: Record<string, string> = {
    admin: "Yönetici (Patron)",
    sysadmin: "Sistem Yöneticisi",
    accounting: "Muhasebeci",
    sales: "Satış Temsilcisi"
  };
  await addLog(
    currentUserId,
    currentUserName,
    currentUserRole,
    "UPDATE_USER",
    `"${updatedFields.displayName}" isimli personelin bilgileri (Rol: ${roleLabelMap[updatedFields.role] || updatedFields.role}) güncellendi.`
  );
};

export const updateUserRole = async (
  userId: string,
  userName: string,
  newRole: Role,
  currentUserId: string,
  currentUserName: string,
  currentUserRole: Role | string
): Promise<void> => {
  if (isFirebaseActive) {
    const docRef = doc(firestore!, "users", userId);
    await updateDoc(docRef, { role: newRole });
  } else {
    const users = getLocalUsers();
    const idx = users.findIndex((u) => u.uid === userId);
    if (idx !== -1) {
      users[idx].role = newRole;
      localStorage.setItem("takip_users", JSON.stringify(users));

      const current = safeParse<AppUser | null>(localStorage.getItem("takip_current_user"), null);
      if (current && current.uid === userId) {
        current.role = newRole;
        localStorage.setItem("takip_current_user", JSON.stringify(current));
      }
    } else {
      throw new Error("Kullanıcı bulunamadı!");
    }
  }
  const roleLabelMap: Record<string, string> = {
    admin: "Yönetici (Patron)",
    sysadmin: "Sistem Yöneticisi",
    accounting: "Muhasebeci",
    sales: "Satış Temsilcisi"
  };
  await addLog(
    currentUserId,
    currentUserName,
    currentUserRole,
    "UPDATE_USER_ROLE",
    `"${userName}" kullanıcısının yetkisi "${roleLabelMap[newRole] || newRole}" olarak güncellendi.`
  );
};

export const deleteUser = async (
  userId: string,
  userName: string,
  currentUserId: string,
  currentUserName: string,
  currentUserRole: Role | string
): Promise<void> => {
  if (isFirebaseActive) {
    const docRef = doc(firestore!, "users", userId);
    await updateDoc(docRef, { disabled: true });
  } else {
    const users = getLocalUsers();
    const idx = users.findIndex((u) => u.uid === userId);
    if (idx !== -1) {
      users[idx].disabled = true;
      localStorage.setItem("takip_users", JSON.stringify(users));
    }
  }
  await addLog(
    currentUserId,
    currentUserName,
    currentUserRole,
    "DELETE_USER",
    `"${userName}" isimli personel sistemden silindi (devre dışı bırakıldı).`
  );
};

export const updateUserProfile = async (displayName: string, newPassword: string): Promise<boolean> => {
  if (isFirebaseActive) {
    const user = auth!.currentUser;
    if (!user) throw new Error("Oturum açık değil!");

    if (displayName) {
      await updateProfile(user, { displayName });
      const docRef = doc(firestore!, "users", user.uid);
      await updateDoc(docRef, { displayName });
    }
    if (newPassword) {
      await updatePassword(user, newPassword);
    }
    return true;
  } else {
    const current = safeParse<AppUser | null>(localStorage.getItem("takip_current_user"), null);
    if (!current) throw new Error("Oturum açık değil!");

    const users = getLocalUsers();
    const idx = users.findIndex((u) => u.uid === current.uid);
    if (idx !== -1) {
      if (displayName) {
        users[idx].displayName = displayName;
        current.displayName = displayName;
      }
      localStorage.setItem("takip_users", JSON.stringify(users));
      localStorage.setItem("takip_current_user", JSON.stringify(current));
    }
    return true;
  }
};
