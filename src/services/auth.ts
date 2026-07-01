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
  const users = safeParse<AppUser[] | null>(localStorage.getItem("takip_users"), null);
  if (!users) {
    localStorage.setItem("takip_users", JSON.stringify(INITIAL_USERS));
    return INITIAL_USERS;
  }
  return users;
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
    const userCredential = await signInWithEmailAndPassword(auth!, email, password);
    const userDocRef = doc(firestore!, "users", userCredential.user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
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
    } else {
      throw new Error("Kullanıcı profil verisi bulunamadı!");
    }
  } else {
    const users = getLocalUsers();
    const foundUser = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!foundUser) throw new Error("E-posta adresi sistemde kayıtlı değil!");
    if (foundUser.disabled) throw new Error("Hesabınız devre dışı bırakılmıştır!");

    let isPasswordCorrect = false;
    if (foundUser.password) {
      isPasswordCorrect = password === foundUser.password;
    } else {
      const allowedPasswords: string[] = [];
      if (foundUser.role === "admin") allowedPasswords.push("admin123");
      else if (foundUser.role === "sysadmin") allowedPasswords.push("sysadmin123");
      else if (foundUser.role === "sales") allowedPasswords.push("sales123", "satis123");
      else if (foundUser.role === "accounting") allowedPasswords.push("accounting123", "muhasebe123");
      allowedPasswords.push(foundUser.role + "123");
      isPasswordCorrect = allowedPasswords.includes(password);
    }

    if (!isPasswordCorrect) throw new Error("Hatalı şifre! Lütfen şifrenizi kontrol edin.");

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

  if (isFirebaseActive) {
    try {
      const tempAppName = "TempApp_" + Math.random().toString(36).substring(2, 11);
      const tempApp = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);

      const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
      const uid = userCredential.user.uid;

      await deleteApp(tempApp);

      await setDoc(doc(firestore!, "users", uid), {
        uid,
        email,
        displayName,
        role,
        createdAt: new Date().toISOString()
      });

      return { uid, email, displayName, role };
    } catch (error: any) {
      console.error("Firebase kullanıcı oluşturma hatası:", error);
      throw new Error("Kullanıcı oluşturulamadı: " + error.message);
    }
  } else {
    const users = getLocalUsers();
    if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("Bu e-posta adresiyle zaten bir kullanıcı kayıtlı!");
    }
    const newUser: AppUser = {
      uid: "user-" + Math.random().toString(36).substring(2, 11),
      email,
      displayName,
      role,
      password,
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
  await addLog(
    currentUserId,
    currentUserName,
    currentUserRole,
    "UPDATE_USER_ROLE",
    `"${userName}" kullanıcısının rolü "${newRole}" olarak güncellendi.`
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
