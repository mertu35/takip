// Takip Sistemi - Veritabanı Servisi (Firestore ve Yerel Mock Destekli)
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  runTransaction
} from "firebase/firestore";
import { firestore, isFirebaseActive } from "./firebase";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import firebaseConfig from "./firebase";
import { 
  INITIAL_CUSTOMERS, 
  INITIAL_PRODUCTS, 
  INITIAL_CATEGORIES, 
  INITIAL_SALES, 
  INITIAL_LOGS 
} from "./mockData";

// --- YEREL SIMÜLASYON YARDIMCILARI (LOCAL STORAGE) ---
const initLocalStorage = () => {
  if (!localStorage.getItem("takip_customers")) {
    localStorage.setItem("takip_customers", JSON.stringify(INITIAL_CUSTOMERS));
  }
  if (!localStorage.getItem("takip_products")) {
    localStorage.setItem("takip_products", JSON.stringify(INITIAL_PRODUCTS));
  }
  if (!localStorage.getItem("takip_categories")) {
    localStorage.setItem("takip_categories", JSON.stringify(INITIAL_CATEGORIES));
  }
  if (!localStorage.getItem("takip_sales")) {
    localStorage.setItem("takip_sales", JSON.stringify(INITIAL_SALES));
  }
  if (!localStorage.getItem("takip_logs")) {
    localStorage.setItem("takip_logs", JSON.stringify(INITIAL_LOGS));
  }
  if (!localStorage.getItem("takip_announcements")) {
    localStorage.setItem("takip_announcements", JSON.stringify([
      { id: "ann-1", text: "Özkon Çelik Takip Sistemine Hoş Geldiniz! İyi çalışmalar dileriz.", active: true, createdAt: new Date().toISOString() }
    ]));
  }
};

// Sayfa yüklendiğinde yerel verileri ilklendir
if (!isFirebaseActive) {
  initLocalStorage();
}

// Güvenli JSON parse: bozuk JSON varsa uygulamayı çökertmez
const safeParse = (jsonString, fallback = null) => {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error(`LocalStorage JSON parse hatası (bozuk veri):`, e);
    return fallback;
  }
};

const getLocalData = (key) => safeParse(localStorage.getItem(key), []);

// Quota-safe yazma: LocalStorage 5-10 MB sınırını aşarsa sessizce çökmek yerine uyarı verir
const setLocalData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    if (e.name === "QuotaExceededError" || e.code === 22) {
      console.error(`LocalStorage kotası aşıldı! Anahtar: ${key}. Eski loglar temizlenmeli.`);
      // Son çare: logs listesini kırp (audit trail kotası en çok şişen yer)
      if (key === "takip_logs" && Array.isArray(data) && data.length > 100) {
        try {
          const trimmed = data.slice(0, 100);
          localStorage.setItem(key, JSON.stringify(trimmed));
          console.warn(`Log koleksiyonu 100 kayda kırpıldı.`);
          return;
        } catch (_) {
          // hâlâ sığmıyorsa → kritik hata
        }
      }
    }
    throw e;
  }
};

// İşlem logu ekleme yardımcısı (istemci tarafında tetiklenir)
export const addLog = async (userId, userName, userRole, action, details) => {
  const newLog = {
    id: isFirebaseActive ? "" : "log-" + Math.random().toString(36).substr(2, 9),
    userId,
    userName,
    userRole,
    action,
    details,
    createdAt: new Date().toISOString()
  };

  if (isFirebaseActive) {
    try {
      await addDoc(collection(firestore, "logs"), newLog);
    } catch (e) {
      console.error("Log kaydedilemedi:", e);
    }
  } else {
    const logs = getLocalData("takip_logs");
    logs.unshift(newLog); // En başa ekle (kronolojik)
    // Log limiti: LocalStorage şişmesini önlemek için en eski 500 kaydı tut
    // (İleride ayarlanabilir; 500 ~ 5-10 KB civarı)
    const MAX_LOGS = 500;
    const trimmed = logs.length > MAX_LOGS ? logs.slice(0, MAX_LOGS) : logs;
    try {
      setLocalData("takip_logs", trimmed);
    } catch (e) {
      // setLocalData zaten quota hatası durumunda kırpmayı deniyor; burada sessizce yutalım
      console.error("Log kaydedilemedi (quota veya başka hata):", e);
    }
  }
};

// --- MÜŞTERİ (CUSTOMERS) SERVISLERI ---
export const getCustomers = async () => {
  if (isFirebaseActive) {
    const q = query(collection(firestore, "customers"), orderBy("name"));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } else {
    return getLocalData("takip_customers").sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }
};

export const addCustomer = async (customer, currentUserId, currentUserName, currentUserRole) => {
  if (isFirebaseActive) {
    const docRef = await addDoc(collection(firestore, "customers"), {
      ...customer,
      createdAt: new Date().toISOString()
    });
    await addLog(currentUserId, currentUserName, currentUserRole, "ADD_CUSTOMER", `${customer.name} (${customer.company}) müşterisi eklendi.`);
    return { id: docRef.id, ...customer };
  } else {
    const customers = getLocalData("takip_customers");
    const newCustomer = {
      id: "cust-" + Math.random().toString(36).substr(2, 9),
      ...customer,
      createdAt: new Date().toISOString()
    };
    customers.push(newCustomer);
    setLocalData("takip_customers", customers);
    await addLog(currentUserId, currentUserName, currentUserRole, "ADD_CUSTOMER", `${customer.name} (${customer.company}) müşterisi eklendi.`);
    return newCustomer;
  }
};

// --- KATEGORİ (CATEGORIES) SERVISLERI ---
export const getCategories = async () => {
  if (isFirebaseActive) {
    const q = query(collection(firestore, "categories"), orderBy("name"));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } else {
    return getLocalData("takip_categories").sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }
};

export const addCategory = async (category, currentUserId, currentUserName, currentUserRole) => {
  if (isFirebaseActive) {
    const docRef = await addDoc(collection(firestore, "categories"), {
      ...category,
      createdAt: new Date().toISOString()
    });
    await addLog(currentUserId, currentUserName, currentUserRole, "ADD_CATEGORY", `${category.name} kategorisi oluşturuldu.`);
    return { id: docRef.id, ...category };
  } else {
    const categories = getLocalData("takip_categories");
    const newCategory = {
      id: "cat-" + Math.random().toString(36).substr(2, 9),
      ...category,
      createdAt: new Date().toISOString()
    };
    categories.push(newCategory);
    setLocalData("takip_categories", categories);
    await addLog(currentUserId, currentUserName, currentUserRole, "ADD_CATEGORY", `${category.name} kategorisi oluşturuldu.`);
    return newCategory;
  }
};

// --- ÜRÜN (PRODUCTS) SERVISLERI ---
export const getProducts = async () => {
  if (isFirebaseActive) {
    const q = query(collection(firestore, "products"), orderBy("name"));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } else {
    return getLocalData("takip_products").sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }
};

export const addProduct = async (product, currentUserId, currentUserName, currentUserRole) => {
  if (isFirebaseActive) {
    const docRef = await addDoc(collection(firestore, "products"), {
      ...product,
      createdAt: new Date().toISOString()
    });
    await addLog(currentUserId, currentUserName, currentUserRole, "ADD_PRODUCT", `${product.name} (${product.code}) ürünü eklendi.`);
    return { id: docRef.id, ...product };
  } else {
    const products = getLocalData("takip_products");
    const newProduct = {
      id: "prod-" + Math.random().toString(36).substr(2, 9),
      ...product,
      createdAt: new Date().toISOString()
    };
    products.push(newProduct);
    setLocalData("takip_products", products);
    await addLog(currentUserId, currentUserName, currentUserRole, "ADD_PRODUCT", `${product.name} (${product.code}) ürünü eklendi.`);
    return newProduct;
  }
};

export const updateProduct = async (productId, updatedFields, currentUserId, currentUserName, currentUserRole) => {
  if (isFirebaseActive) {
    const docRef = doc(firestore, "products", productId);
    await updateDoc(docRef, updatedFields);
    await addLog(currentUserId, currentUserName, currentUserRole, "UPDATE_PRODUCT", `${updatedFields.name || productId} ürünü güncellendi.`);
    return { id: productId, ...updatedFields };
  } else {
    const products = getLocalData("takip_products");
    const idx = products.findIndex(p => p.id === productId);
    if (idx !== -1) {
      products[idx] = { ...products[idx], ...updatedFields };
      setLocalData("takip_products", products);
      await addLog(currentUserId, currentUserName, currentUserRole, "UPDATE_PRODUCT", `${products[idx].name} ürünü güncellendi.`);
      return products[idx];
    }
    throw new Error("Ürün bulunamadı!");
  }
};

export const deleteProduct = async (productId, currentUserId, currentUserName, currentUserRole) => {
  if (isFirebaseActive) {
    const docRef = doc(firestore, "products", productId);
    await deleteDoc(docRef);
    await addLog(currentUserId, currentUserName, currentUserRole, "DELETE_PRODUCT", `${productId} ID'li ürün silindi.`);
    return true;
  } else {
    const products = getLocalData("takip_products");
    const filtered = products.filter(p => p.id !== productId);
    setLocalData("takip_products", filtered);
    await addLog(currentUserId, currentUserName, currentUserRole, "DELETE_PRODUCT", `${productId} ID'li ürün silindi.`);
    return true;
  }
};

// --- SATIŞ (SALES) SERVISLERI ---
export const getSales = async (role, userId) => {
  if (isFirebaseActive) {
    let q;
    if (role === "sales" && userId) {
      // Satışçı sadece kendi satışlarını okuyabilir; composite index gerektirmemesi için orderBy yok, JS'de sıralıyoruz
      q = query(collection(firestore, "sales"), where("salespersonId", "==", userId));
    } else {
      q = query(collection(firestore, "sales"), orderBy("date", "desc"));
    }
    const snap = await getDocs(q);
    const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (role === "sales") {
      docs.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    return docs;
  } else {
    const all = getLocalData("takip_sales").sort((a, b) => new Date(b.date) - new Date(a.date));
    if (role === "sales" && userId) {
      return all.filter(s => s.salespersonId === userId);
    }
    return all;
  }
};

export const getSalesByCustomer = async (customerId) => {
  if (isFirebaseActive) {
    const q = query(collection(firestore, "sales"), where("customerId", "==", customerId));
    const snap = await getDocs(q);
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => new Date(b.date) - new Date(a.date));
    return docs;
  } else {
    return getLocalData("takip_sales")
      .filter(s => s.customerId === customerId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }
};

export const addSale = async (saleData, currentUserId, currentUserName, currentUserRole) => {
  const prefix = `TS-${new Date().getFullYear()}-`;
  
  if (isFirebaseActive) {
    const salesCol = collection(firestore, "sales");
    const newSaleDocRef = doc(salesCol);
    const counterDocRef = doc(firestore, "counters", "sales");

    let finalSale;

    try {
      await runTransaction(firestore, async (transaction) => {
        // 1. Sayaç dokümanını oku ve artır
        const counterDoc = await transaction.get(counterDocRef);
        let lastNum = 0;
        if (counterDoc.exists()) {
          lastNum = counterDoc.data().lastNo || 0;
        }

        const nextNum = lastNum + 1;
        const receiptNo = prefix + String(nextNum).padStart(5, "0");

        // 2. Stok kontrolü + düşürme (satış anında atomik)
        for (const item of saleData.items) {
          const pDocRef = doc(firestore, "products", item.productId);
          const pDoc = await transaction.get(pDocRef);

          if (!pDoc.exists()) {
            throw new Error(`Ürün bulunamadı: ${item.productName}`);
          }

          const currentStock = pDoc.data().stock || 0;
          if (currentStock < item.quantity) {
            throw new Error(`Yetersiz stok: ${item.productName} (Mevcut: ${currentStock} ${pDoc.data().unit || 'Adet'}, İstenen: ${item.quantity} ${item.unit || 'Adet'})`);
          }
          transaction.update(pDocRef, { stock: currentStock - item.quantity });
        }

        // 3. Sayaç güncelle
        transaction.set(counterDocRef, { lastNo: nextNum });

        // 4. Satış verisini oluştur ve yaz (pending_accounting olarak)
        finalSale = {
          ...saleData,
          receiptNo,
          status: "pending_accounting",
          accountingProcessed: false,
          processedAt: null,
          processedBy: null,
          createdAt: new Date().toISOString(),
          date: new Date().toISOString()
        };

        transaction.set(newSaleDocRef, finalSale);
      });

      await addLog(currentUserId, currentUserName, currentUserRole, "CREATE_SALE", `${finalSale.receiptNo} numaralı satış fişi oluşturuldu (Tutar: ${finalSale.netAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL).`);
      return { id: newSaleDocRef.id, ...finalSale };
    } catch (error) {
      console.error("Satış eklenirken hata:", error);
      throw error; // UI'da yakalanmak üzere hatayı fırlat
    }
  } else {
    // Yerel Mock Modu
    const sales = getLocalData("takip_sales");

    // 1. Stok kontrolü + düşürme (satış anında)
    const products = getLocalData("takip_products");
    for (const item of saleData.items) {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) {
        throw new Error(`Ürün bulunamadı: ${item.productName}`);
      }
      if (prod.stock < item.quantity) {
        throw new Error(`Yetersiz stok: ${item.productName} (Mevcut: ${prod.stock} ${prod.unit || 'Adet'}, İstenen: ${item.quantity} ${item.unit || 'Adet'})`);
      }
    }
    for (const item of saleData.items) {
      const pIdx = products.findIndex(p => p.id === item.productId);
      if (pIdx !== -1) products[pIdx].stock -= item.quantity;
    }
    setLocalData("takip_products", products);

    // 2. Fiş numarasını çakışmasız hesapla (race condition korumalı)
    const matchSales = sales.filter(s => s.receiptNo && s.receiptNo.startsWith(prefix));
    let lastNum = 0;
    if (matchSales.length > 0) {
      const nums = matchSales.map(s => parseInt(s.receiptNo.replace(prefix, ""), 10));
      lastNum = Math.max(...nums);
    }

    // Race condition koruması: başka sekme/process aynı numarayı almışsa atla
    let receiptNo;
    let attempts = 0;
    const maxAttempts = 100;
    while (attempts < maxAttempts) {
      const nextNum = lastNum + 1 + attempts;
      const candidate = prefix + String(nextNum).padStart(5, "0");
      if (!sales.some(s => s.receiptNo === candidate)) {
        receiptNo = candidate;
        break;
      }
      attempts++;
    }
    if (!receiptNo) {
      throw new Error("Fiş numarası üretilemedi (çakışma). Lütfen tekrar deneyin.");
    }

    // 3. NOT: Stok düşürme burada YAPILMAZ.
    // İş kuralı: muhasebeci depoda çalışmaz; stok düşürme sadece onay anında processApproval'da yapılacak.

    const newSale = {
      ...saleData,
      receiptNo,
      status: "pending_accounting",
      accountingProcessed: false,
      processedAt: null,
      processedBy: null,
      createdAt: new Date().toISOString(),
      date: new Date().toISOString(),
      id: "sale-" + Math.random().toString(36).substr(2, 9)
    };

    sales.unshift(newSale);
    setLocalData("takip_sales", sales);
    // products güncellenmedi - onay anında processApproval'da güncellenecek

    await addLog(currentUserId, currentUserName, currentUserRole, "CREATE_SALE", `${receiptNo} numaralı satış fişi oluşturuldu (Tutar: ${newSale.netAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL).`);
    return newSale;
  }
};

// Satış Düzenleme (Muhasebe onay öncesi düzenleme yetkisi)
export const updateSale = async (saleId, updatedFields, currentUserId, currentUserName, currentUserRole) => {
  if (isFirebaseActive) {
    const docRef = doc(firestore, "sales", saleId);
    await updateDoc(docRef, updatedFields);
    await addLog(currentUserId, currentUserName, currentUserRole, "UPDATE_SALE", `${saleId} ID'li satış kaydı güncellendi.`);
    return { id: saleId, ...updatedFields };
  } else {
    const sales = getLocalData("takip_sales");
    const idx = sales.findIndex(s => s.id === saleId);
    if (idx !== -1) {
      sales[idx] = { ...sales[idx], ...updatedFields };
      setLocalData("takip_sales", sales);
      await addLog(currentUserId, currentUserName, currentUserRole, "UPDATE_SALE", `${sales[idx].receiptNo} numaralı satış kaydı güncellendi.`);
      return sales[idx];
    }
    throw new Error("Satış kaydı bulunamadı!");
  }
};

// Muhasebe Onay / Red İşlemi
// İş kuralı: Stok düşürme SADECE onay (approved) anında yapılır.
// Red durumunda stok düşürülmez (çünkü addSale'de zaten düşürülmüyor).
// İdempotent: Sadece pending_accounting durumundan geçiş kabul edilir.
export const processApproval = async (saleId, status, notes, isMicroProcessed, currentUserId, currentUserName, currentUserRole) => {
  const approvalData = {
    status, // "approved" | "rejected"
    accountingProcessed: isMicroProcessed,
    processedAt: new Date().toISOString(),
    processedBy: currentUserName
  };

  if (isFirebaseActive) {
    const docRef = doc(firestore, "sales", saleId);

    await runTransaction(firestore, async (transaction) => {
      const saleDoc = await transaction.get(docRef);
      if (!saleDoc.exists()) throw new Error("Satış kaydı bulunamadı!");

      const currentSale = saleDoc.data();
      if (currentSale.status !== "pending_accounting") {
        throw new Error(`Bu satış zaten işlenmiş! (Mevcut durum: ${currentSale.status})`);
      }

      if (status === "rejected") {
        // Red: stok satış anında düşmüştü, geri ekle
        for (const item of currentSale.items || []) {
          const pDocRef = doc(firestore, "products", item.productId);
          const pDoc = await transaction.get(pDocRef);
          if (pDoc.exists()) {
            transaction.update(pDocRef, { stock: (pDoc.data().stock || 0) + item.quantity });
          }
        }
      }
      // Onayda stok zaten satış anında düşmüştü, değişiklik yok

      transaction.update(docRef, approvalData);
    });

    await addDoc(collection(firestore, "approvals"), {
      saleId,
      status,
      userId: currentUserId,
      userName: currentUserName,
      notes,
      createdAt: new Date().toISOString()
    });

    const actionType = status === "approved" ? "APPROVE_SALE" : "REJECT_SALE";
    const detailMsg = status === "approved"
      ? `${saleId} ID'li satış onaylandı. (Mikro'ya işlendi: ${isMicroProcessed ? "Evet" : "Hayır"})`
      : `${saleId} ID'li satış reddedildi, stok iade edildi. Nedeni: ${notes}`;

    await addLog(currentUserId, currentUserName, currentUserRole, actionType, detailMsg);

    // Satışçıya bildirim gönder
    const saleSnap = await getDoc(docRef);
    if (saleSnap.exists()) {
      const saleData = saleSnap.data();
      const notifMsg = status === "approved"
        ? `${saleData.receiptNo || saleId} numaralı satışınız onaylandı.`
        : `${saleData.receiptNo || saleId} numaralı satışınız reddedildi. Neden: ${notes}`;
      await addNotification(saleData.salespersonId, notifMsg, status === "approved" ? "success" : "error", { saleId, receiptNo: saleData.receiptNo });
    }

    return { id: saleId, ...approvalData };
  } else {
    // Yerel Mock Modu
    const sales = getLocalData("takip_sales");
    const idx = sales.findIndex(s => s.id === saleId);
    if (idx === -1) {
      throw new Error("Satış kaydı bulunamadı!");
    }

    const oldSale = sales[idx];
    // İdempotent kontrol
    if (oldSale.status !== "pending_accounting") {
      throw new Error(`Bu satış zaten işlenmiş! (Mevcut durum: ${oldSale.status})`);
    }

    if (status === "rejected") {
      // Red: stok satış anında düşmüştü, geri ekle
      const products = getLocalData("takip_products");
      for (const item of oldSale.items || []) {
        const pIdx = products.findIndex(p => p.id === item.productId);
        if (pIdx !== -1) products[pIdx].stock += item.quantity;
      }
      setLocalData("takip_products", products);
    }
    // Onayda stok zaten satış anında düşmüştü, değişiklik yok

    // Satış durumunu güncelle
    sales[idx] = {
      ...oldSale,
      status,
      accountingProcessed: isMicroProcessed,
      processedAt: new Date().toISOString(),
      processedBy: currentUserName
    };
    setLocalData("takip_sales", sales);

    // Onay geçmişini kaydet
    const approvals = getLocalData("takip_approvals") || [];
    approvals.push({
      id: "appr-" + Math.random().toString(36).substr(2, 9),
      saleId,
      status,
      userId: currentUserId,
      userName: currentUserName,
      notes,
      createdAt: new Date().toISOString()
    });
    localStorage.setItem("takip_approvals", JSON.stringify(approvals));

    const actionType = status === "approved" ? "APPROVE_SALE" : "REJECT_SALE";
    const detailMsg = status === "approved"
      ? `${oldSale.receiptNo} numaralı satış onaylandı. (Mikro'ya işlendi: ${isMicroProcessed ? "Evet" : "Hayır"})`
      : `${oldSale.receiptNo} numaralı satış reddedildi, stok iade edildi. Nedeni: ${notes}`;

    await addLog(currentUserId, currentUserName, currentUserRole, actionType, detailMsg);

    // Satışçıya bildirim gönder
    const notifMsg = status === "approved"
      ? `${oldSale.receiptNo} numaralı satışınız onaylandı.`
      : `${oldSale.receiptNo} numaralı satışınız reddedildi. Neden: ${notes}`;
    await addNotification(oldSale.salespersonId, notifMsg, status === "approved" ? "success" : "error", { saleId, receiptNo: oldSale.receiptNo });

    return sales[idx];
  }
};

// Reddedilen satışı düzenleyip tekrar gönderme
// İş kuralı: Red anında stok iade edilmişti. Tekrar gönderimde stok yeniden düşürülür.
export const resubmitSale = async (saleId, updatedItems, updatedNotes, updatedDiscount, currentUserId, currentUserName, currentUserRole) => {
  if (isFirebaseActive) {
    const docRef = doc(firestore, "sales", saleId);

    let finalSale;
    await runTransaction(firestore, async (transaction) => {
      const saleDoc = await transaction.get(docRef);
      if (!saleDoc.exists()) throw new Error("Satış kaydı bulunamadı!");

      const currentSale = saleDoc.data();
      if (currentSale.status !== "rejected") {
        throw new Error("Sadece reddedilmiş satışlar yeniden gönderilebilir!");
      }

      // Stok kontrolü + düşürme
      for (const item of updatedItems) {
        const pDocRef = doc(firestore, "products", item.productId);
        const pDoc = await transaction.get(pDocRef);
        if (!pDoc.exists()) throw new Error(`Ürün bulunamadı: ${item.productName}`);
        const currentStock = pDoc.data().stock || 0;
        if (currentStock < item.quantity) {
          throw new Error(`Yetersiz stok: ${item.productName} (Mevcut: ${currentStock}, İstenen: ${item.quantity})`);
        }
        transaction.update(pDocRef, { stock: currentStock - item.quantity });
      }

      // Toplamları yeniden hesapla
      const totalAmount = updatedItems.reduce((s, i) => s + i.total, 0);
      const taxAmount = updatedItems.reduce((s, i) => s + (i.total * (i.taxRate / (100 + i.taxRate))), 0);
      const netAmount = Math.max(0, totalAmount - updatedDiscount);

      finalSale = {
        items: updatedItems,
        notes: updatedNotes,
        discountAmount: updatedDiscount,
        totalAmount,
        taxAmount,
        netAmount,
        status: "pending_accounting",
        accountingProcessed: false,
        processedAt: null,
        processedBy: null,
        resubmittedAt: new Date().toISOString(),
        resubmittedBy: currentUserName
      };

      transaction.update(docRef, finalSale);
    });

    await addLog(currentUserId, currentUserName, currentUserRole, "RESUBMIT_SALE", `${saleId} ID'li reddedilen satış düzenlenerek tekrar gönderildi.`);
    return { id: saleId, ...finalSale };
  } else {
    const sales = getLocalData("takip_sales");
    const idx = sales.findIndex(s => s.id === saleId);
    if (idx === -1) throw new Error("Satış kaydı bulunamadı!");

    const oldSale = sales[idx];
    if (oldSale.status !== "rejected") throw new Error("Sadece reddedilmiş satışlar yeniden gönderilebilir!");

    // Stok kontrolü + düşürme
    const products = getLocalData("takip_products");
    for (const item of updatedItems) {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) throw new Error(`Ürün bulunamadı: ${item.productName}`);
      if (prod.stock < item.quantity) {
        throw new Error(`Yetersiz stok: ${item.productName} (Mevcut: ${prod.stock}, İstenen: ${item.quantity})`);
      }
    }
    for (const item of updatedItems) {
      const pIdx = products.findIndex(p => p.id === item.productId);
      if (pIdx !== -1) products[pIdx].stock -= item.quantity;
    }
    setLocalData("takip_products", products);

    const totalAmount = updatedItems.reduce((s, i) => s + i.total, 0);
    const taxAmount = updatedItems.reduce((s, i) => s + (i.total * (i.taxRate / (100 + i.taxRate))), 0);
    const netAmount = Math.max(0, totalAmount - updatedDiscount);

    sales[idx] = {
      ...oldSale,
      items: updatedItems,
      notes: updatedNotes,
      discountAmount: updatedDiscount,
      totalAmount,
      taxAmount,
      netAmount,
      status: "pending_accounting",
      accountingProcessed: false,
      processedAt: null,
      processedBy: null,
      resubmittedAt: new Date().toISOString(),
      resubmittedBy: currentUserName
    };
    setLocalData("takip_sales", sales);

    await addLog(currentUserId, currentUserName, currentUserRole, "RESUBMIT_SALE", `${oldSale.receiptNo} numaralı reddedilen satış düzenlenerek tekrar gönderildi.`);
    return sales[idx];
  }
};

// --- BİLDİRİM (NOTIFICATIONS) SERVİSLERİ ---
export const addNotification = async (userId, message, type = "info", meta = {}) => {
  const notification = {
    userId,
    message,
    type, // "info" | "warning" | "success" | "error"
    read: false,
    createdAt: new Date().toISOString(),
    ...meta
  };
  if (isFirebaseActive) {
    try {
      await addDoc(collection(firestore, "notifications"), notification);
    } catch (e) {
      console.error("Bildirim kaydedilemedi:", e);
    }
  } else {
    const notifications = getLocalData("takip_notifications");
    notifications.unshift({ id: "notif-" + Math.random().toString(36).substr(2, 9), ...notification });
    setLocalData("takip_notifications", notifications.slice(0, 200));
  }
};

export const getNotifications = async (userId) => {
  if (isFirebaseActive) {
    const q = query(
      collection(firestore, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } else {
    const all = getLocalData("takip_notifications");
    return all.filter(n => n.userId === userId).slice(0, 50);
  }
};

export const markNotificationsRead = async (userId) => {
  if (isFirebaseActive) {
    const q = query(
      collection(firestore, "notifications"),
      where("userId", "==", userId),
      where("read", "==", false)
    );
    const snap = await getDocs(q);
    const updates = snap.docs.map(d => updateDoc(d.ref, { read: true }));
    await Promise.all(updates);
  } else {
    const all = getLocalData("takip_notifications");
    const updated = all.map(n => n.userId === userId ? { ...n, read: true } : n);
    setLocalData("takip_notifications", updated);
  }
};

// --- LOG (LOGS) SERVISLERI ---
export const getLogs = async () => {
  if (isFirebaseActive) {
    const q = query(collection(firestore, "logs"), orderBy("createdAt", "desc"), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } else {
    return getLocalData("takip_logs").sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
};

// Verileri Yedekleme (JSON formatında dışa aktarma)
export const exportBackupData = () => {
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
};

// Yedekten Geri Yükleme (JSON formatından içeri aktarma)
export const importBackupData = (jsonString) => {
  try {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== "object") {
      throw new Error("Geçersiz yedek dosyası!");
    }
    if (!Array.isArray(data.customers) || !Array.isArray(data.products) || !Array.isArray(data.sales)) {
      throw new Error("Geçersiz yedek formatı! Gerekli tablolar (customers, products, sales) bulunamadı veya liste formatında değil.");
    }
    
    // İsteğe bağlı (opsiyonel) diğer tabloların da dizi olduğunu doğrula
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
  } catch (error) {
    console.error("Yedek yükleme hatası:", error);
    throw error;
  }
};

// --- FİREBASE CANLI İLKLENDİRME VE SEED SERVİSLERİ ---
export const isDatabaseInitialized = async () => {
  if (!isFirebaseActive) return true;
  try {
    const q = query(collection(firestore, "users"), where("role", "==", "sysadmin"), limit(1));
    const snap = await getDocs(q);
    return !snap.empty;
  } catch (e) {
    console.error("Veritabanı kontrol hatası:", e);
    return true; // Hata halinde tedbiren true dönüyoruz
  }
};

export const initializeFirebaseDatabase = async (adminEmail, adminPassword, adminName) => {
  if (!isFirebaseActive) return false;
  
  try {
    console.log("Firebase config to initialize:", { ...firebaseConfig, apiKey: firebaseConfig.apiKey ? firebaseConfig.apiKey.substring(0, 10) + "..." : "missing" });

    // 1. İkincil geçici uygulama ile admin kullanıcısını Auth tarafında oluşturuyoruz
    const tempAppName = "InitApp_" + Math.random().toString(36).substring(2, 11);
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);
    
    let uid;
    try {
      const userCredential = await createUserWithEmailAndPassword(tempAuth, adminEmail, adminPassword);
      uid = userCredential.user.uid;
    } catch (authError) {
      if (authError.code === "auth/email-already-in-use") {
        const userCredential = await signInWithEmailAndPassword(tempAuth, adminEmail, adminPassword);
        uid = userCredential.user.uid;
      } else {
        throw authError;
      }
    }

    // 1.5. Aynı şekilde sysadmin kullanıcısını Auth tarafında oluşturuyoruz
    let sysAdminUid;
    const sysAdminEmail = import.meta.env.VITE_SEED_SYSADMIN_EMAIL || "sysadmin@takip.com";
    const sysAdminPassword = import.meta.env.VITE_SEED_SYSADMIN_PASSWORD;
    if (!sysAdminPassword) throw new Error("VITE_SEED_SYSADMIN_PASSWORD env değişkeni tanımlı değil!");
    try {
      const userCredential = await createUserWithEmailAndPassword(tempAuth, sysAdminEmail, sysAdminPassword);
      sysAdminUid = userCredential.user.uid;
    } catch (authError) {
      if (authError.code === "auth/email-already-in-use") {
        const userCredential = await signInWithEmailAndPassword(tempAuth, sysAdminEmail, sysAdminPassword);
        sysAdminUid = userCredential.user.uid;
      } else {
        throw authError;
      }
    }

    // 1.6. Satışçı kullanıcısını Auth tarafında oluşturuyoruz
    let salesUid;
    const salesEmail = import.meta.env.VITE_SEED_SALES_EMAIL || "satis@takip.com";
    const salesPassword = import.meta.env.VITE_SEED_SALES_PASSWORD;
    if (!salesPassword) throw new Error("VITE_SEED_SALES_PASSWORD env değişkeni tanımlı değil!");
    try {
      const userCredential = await createUserWithEmailAndPassword(tempAuth, salesEmail, salesPassword);
      salesUid = userCredential.user.uid;
    } catch (authError) {
      if (authError.code === "auth/email-already-in-use") {
        const userCredential = await signInWithEmailAndPassword(tempAuth, salesEmail, salesPassword);
        salesUid = userCredential.user.uid;
      } else {
        throw authError;
      }
    }

    // 1.7. Muhasebeci kullanıcısını Auth tarafında oluşturuyoruz
    let accountingUid;
    const accountingEmail = import.meta.env.VITE_SEED_ACCOUNTING_EMAIL || "muhasebe@takip.com";
    const accountingPassword = import.meta.env.VITE_SEED_ACCOUNTING_PASSWORD;
    if (!accountingPassword) throw new Error("VITE_SEED_ACCOUNTING_PASSWORD env değişkeni tanımlı değil!");
    try {
      const userCredential = await createUserWithEmailAndPassword(tempAuth, accountingEmail, accountingPassword);
      accountingUid = userCredential.user.uid;
    } catch (authError) {
      if (authError.code === "auth/email-already-in-use") {
        const userCredential = await signInWithEmailAndPassword(tempAuth, accountingEmail, accountingPassword);
        accountingUid = userCredential.user.uid;
      } else {
        throw authError;
      }
    }

    await deleteApp(tempApp);

    // 2. Firestore'da Admin profili oluştur
    await setDoc(doc(firestore, "users", uid), {
      uid,
      email: adminEmail,
      displayName: adminName,
      role: "admin",
      createdAt: new Date().toISOString()
    });

    // 2.5. Firestore'da Sysadmin profili oluştur
    await setDoc(doc(firestore, "users", sysAdminUid), {
      uid: sysAdminUid,
      email: sysAdminEmail,
      displayName: "Sistem Yöneticisi",
      role: "sysadmin",
      createdAt: new Date().toISOString()
    });

    // 2.6. Firestore'da Satışçı profili oluştur
    await setDoc(doc(firestore, "users", salesUid), {
      uid: salesUid,
      email: salesEmail,
      displayName: "Ali Satışçı",
      role: "sales",
      createdAt: new Date().toISOString()
    });

    // 2.7. Firestore'da Muhasebeci profili oluştur
    await setDoc(doc(firestore, "users", accountingUid), {
      uid: accountingUid,
      email: accountingEmail,
      displayName: "Canan Muhasebeci",
      role: "accounting",
      createdAt: new Date().toISOString()
    });

    // 3. Kategorileri aktar
    for (const cat of INITIAL_CATEGORIES) {
      await setDoc(doc(firestore, "categories", cat.id), cat);
    }

    // 4. Ürünleri aktar
    for (const prod of INITIAL_PRODUCTS) {
      await setDoc(doc(firestore, "products", prod.id), {
        ...prod,
        createdAt: new Date().toISOString()
      });
    }

    // 5. Müşterileri aktar
    for (const cust of INITIAL_CUSTOMERS) {
      await setDoc(doc(firestore, "customers", cust.id), {
        ...cust,
        createdAt: new Date().toISOString()
      });
    }

    // 6. Logları aktar
    for (const log of INITIAL_LOGS) {
      await addDoc(collection(firestore, "logs"), log);
    }

    // 7. Duyuruları aktar
    await setDoc(doc(firestore, "announcements", "ann-1"), {
      id: "ann-1",
      text: "Özkon Çelik Takip Sistemine Hoş Geldiniz! İyi çalışmalar dileriz.",
      active: true,
      createdAt: new Date().toISOString()
    });

    return true;
  } catch (error) {
    console.error("Veritabanı ilklendirilirken hata:", error);
    throw new Error("Veritabanı kurulum hatası: " + error.message);
  }
};

// --- DUYURU (ANNOUNCEMENTS) SERVİSLERİ ---
export const getAnnouncements = async () => {
  if (isFirebaseActive) {
    const snap = await getDocs(collection(firestore, "announcements"));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } else {
    return getLocalData("takip_announcements");
  }
};

export const addAnnouncement = async (text, currentUserId, currentUserName, currentUserRole) => {
  const newAnn = {
    id: isFirebaseActive ? "" : "ann-" + Math.random().toString(36).substring(2, 11),
    text,
    active: true,
    createdAt: new Date().toISOString()
  };

  if (isFirebaseActive) {
    const docRef = await addDoc(collection(firestore, "announcements"), newAnn);
    await addLog(currentUserId, currentUserName, currentUserRole, "ADD_ANNOUNCEMENT", `Yeni duyuru yayınlandı: "${text.substring(0, 30)}..."`);
    return { id: docRef.id, ...newAnn };
  } else {
    const anns = getLocalData("takip_announcements");
    anns.unshift(newAnn);
    setLocalData("takip_announcements", anns);
    await addLog(currentUserId, currentUserName, currentUserRole, "ADD_ANNOUNCEMENT", `Yeni duyuru yayınlandı (Yerel): "${text.substring(0, 30)}..."`);
    return newAnn;
  }
};

export const deleteAnnouncement = async (annId, currentUserId, currentUserName, currentUserRole) => {
  if (isFirebaseActive) {
    const docRef = doc(firestore, "announcements", annId);
    await deleteDoc(docRef);
    await addLog(currentUserId, currentUserName, currentUserRole, "DELETE_ANNOUNCEMENT", `Duyuru silindi.`);
  } else {
    const anns = getLocalData("takip_announcements");
    const filtered = anns.filter(a => a.id !== annId);
    setLocalData("takip_announcements", filtered);
    await addLog(currentUserId, currentUserName, currentUserRole, "DELETE_ANNOUNCEMENT", `Duyuru silindi (Yerel).`);
  }
  return true;
};
