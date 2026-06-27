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

// Güvenli JSON parse: bozuk veri varsa uygulamayı çökertmez
const safeParse = (jsonString, fallback = null) => {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error(`LocalStorage JSON parse hatası (bozuk veri):`, e);
    return fallback;
  }
};

// Yerel depolamadaki kullanıcıları yükle veya ilklendir
const getLocalUsers = () => {
  const users = safeParse(localStorage.getItem("takip_users"));
  if (!users) {
    localStorage.setItem("takip_users", JSON.stringify(INITIAL_USERS));
    return INITIAL_USERS;
  }
  return users;
};

// Aktif giriş yapmış simüle kullanıcı
let mockCurrentUser = safeParse(localStorage.getItem("takip_current_user")) || null;
let mockAuthCallbacks = [];

// Simüle kimlik doğrulama değişiklik dinleyicisi
const triggerMockAuthChange = (user) => {
  mockCurrentUser = user;
  if (user) {
    localStorage.setItem("takip_current_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("takip_current_user");
  }
  mockAuthCallbacks.forEach(callback => callback(user));
};

export const login = async (email, password) => {
  if (isFirebaseActive) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // Firestore'dan rol bilgisini al
    const userDocRef = doc(firestore, "users", userCredential.user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      if (userDoc.data().disabled) {
        await signOut(auth);
        throw new Error("Hesabınız devre dışı bırakılmıştır!");
      }
      return {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        ...(userDoc.data() || {})
      };
    } else {
      // Eğer Firestore'da profil yoksa varsayılan olarak satıcı rolü ver (ya da hata ver)
      throw new Error("Kullanıcı profil verisi bulunamadı!");
    }
  } else {
    // Yerel Mock Login
    const users = getLocalUsers();
    const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!foundUser) {
      throw new Error("E-posta adresi sistemde kayıtlı değil!");
    }
    
    if (foundUser.disabled) {
      throw new Error("Hesabınız devre dışı bırakılmıştır!");
    }
    
    const expectedPassword = foundUser.password;
    if (!expectedPassword || password !== expectedPassword) {
      throw new Error("Hatalı şifre! Lütfen şifrenizi kontrol edin.");
    }
    
    triggerMockAuthChange(foundUser);
    return foundUser;
  }
};

export const logout = async () => {
  if (isFirebaseActive) {
    await signOut(auth);
  } else {
    triggerMockAuthChange(null);
  }
};

export const resetPassword = async (email) => {
  if (isFirebaseActive) {
    await sendPasswordResetEmail(auth, email);
  } else {
    // Mock şifre sıfırlama
    const users = getLocalUsers();
    const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!foundUser) {
      throw new Error("E-posta adresi bulunamadı!");
    }
    // Başarılı varsayalım
    return true;
  }
};

export const onAuthStateChanged = (callback) => {
  if (isFirebaseActive) {
    return fbOnAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const userDocRef = doc(firestore, "users", fbUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists() && !userDoc.data().disabled) {
            callback({
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.displayName || userDoc.data().displayName,
              role: userDoc.data().role,
              ...userDoc.data()
            });
          } else {
            // Profil dokümanı Firestore'dan silindiyse veya devre dışı bırakıldıysa oturumu kapat
            await signOut(auth);
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
    // Mock dinleyici
    mockAuthCallbacks.push(callback);
    // İlk çağrı
    if (mockCurrentUser && mockCurrentUser.disabled) {
      triggerMockAuthChange(null);
    }
    callback(mockCurrentUser);
    // Unsubscribe fonksiyonu döndür
    return () => {
      mockAuthCallbacks = mockAuthCallbacks.filter(cb => cb !== callback);
    };
  }
};

// Yeni kullanıcı oluşturma (Yönetici yetkisi ile)
// currentUser parametresi: çağıran kullanıcı bilgisi (güvenlik kontrolü için)
// Sadece admin/sysadmin yeni kullanıcı oluşturabilir (her iki modda da geçerli)
export const registerUser = async (email, password, displayName, role, currentUser) => {
  // Güvenlik: sadece admin/sysadmin yeni kullanıcı oluşturabilir
  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "sysadmin")) {
    throw new Error("Bu işlem için yönetici yetkisi gereklidir!");
  }

  if (isFirebaseActive) {
    try {
      // Aktif admin oturumunu bozmamak için geçici bir ikincil Firebase App oluşturuyoruz
      const tempAppName = "TempApp_" + Math.random().toString(36).substring(2, 11);
      const tempApp = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);

      const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
      const uid = userCredential.user.uid;

      // Geçici uygulamayı bellekten siliyoruz
      await deleteApp(tempApp);

      // Firestore'da kullanıcı profil belgesini oluşturuyoruz
      await setDoc(doc(firestore, "users", uid), {
        uid,
        email,
        displayName,
        role,
        createdAt: new Date().toISOString()
      });

      return { uid, email, displayName, role };
    } catch (error) {
      console.error("Firebase kullanıcı oluşturma hatası:", error);
      throw new Error("Kullanıcı oluşturulamadı: " + error.message);
    }
  } else {
    const users = getLocalUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("Bu e-posta adresiyle zaten bir kullanıcı kayıtlı!");
    }
    const newUser = {
      uid: "user-" + Math.random().toString(36).substr(2, 9),
      email,
      displayName,
      role,
      password, // Mock modda kimlik doğrulama için gerekli (Firebase Auth yerine)
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    try {
      localStorage.setItem("takip_users", JSON.stringify(users));
    } catch (e) {
      throw new Error("Kullanıcı kaydedilemedi: LocalStorage kotası dolu olabilir.");
    }
    // Şifreyi dönüş objesine dahil etme
    const { password: _pwd, ...safeUser } = newUser;
    return safeUser;
  }
};

// Kullanıcı rolünü güncelleme (Yönetici yetkisi ile)
export const updateUserRole = async (userId, userName, newRole, currentUserId, currentUserName, currentUserRole) => {
  if (isFirebaseActive) {
    const docRef = doc(firestore, "users", userId);
    await updateDoc(docRef, { role: newRole });
  } else {
    const users = getLocalUsers();
    const idx = users.findIndex(u => u.uid === userId);
    if (idx !== -1) {
      users[idx].role = newRole;
      localStorage.setItem("takip_users", JSON.stringify(users));
      
      // Eğer güncellenen kullanıcı şu anki giriş yapan kullanıcıysa onun oturumunu da güncelle
      const current = safeParse(localStorage.getItem("takip_current_user"));
      if (current && current.uid === userId) {
        current.role = newRole;
        localStorage.setItem("takip_current_user", JSON.stringify(current));
      }
    } else {
      throw new Error("Kullanıcı bulunamadı!");
    }
  }
  await addLog(currentUserId, currentUserName, currentUserRole, "UPDATE_USER_ROLE", `"${userName}" kullanıcısının rolü "${newRole}" olarak güncellendi.`);
};

// Kullanıcı silme (Yönetici yetkisi ile - Pasifleştirme/Soft-delete altyapısı)
export const deleteUser = async (userId, userName, currentUserId, currentUserName, currentUserRole) => {
  if (isFirebaseActive) {
    const docRef = doc(firestore, "users", userId);
    await updateDoc(docRef, { disabled: true });
  } else {
    const users = getLocalUsers();
    const idx = users.findIndex(u => u.uid === userId);
    if (idx !== -1) {
      users[idx].disabled = true;
      localStorage.setItem("takip_users", JSON.stringify(users));
    }
  }
  await addLog(currentUserId, currentUserName, currentUserRole, "DELETE_USER", `"${userName}" isimli personel sistemden silindi (devre dışı bırakıldı).`);
};

// Kullanıcı profil ve şifre bilgilerini güncelleme (Kullanıcının kendisi tarafından)
export const updateUserProfile = async (displayName, newPassword) => {
  if (isFirebaseActive) {
    const user = auth.currentUser;
    if (!user) throw new Error("Oturum açık değil!");

    if (displayName) {
      await updateProfile(user, { displayName });
      const docRef = doc(firestore, "users", user.uid);
      await updateDoc(docRef, { displayName });
    }

    if (newPassword) {
      await updatePassword(user, newPassword);
    }

    return true;
  } else {
    const current = safeParse(localStorage.getItem("takip_current_user"));
    if (!current) throw new Error("Oturum açık değil!");

    const users = getLocalUsers();
    const idx = users.findIndex(u => u.uid === current.uid);
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
