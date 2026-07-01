// Takip Sistemi - Satış (Sales) Repository
//
// BURASI, projede bulunan en önemli düzeltmenin yapıldığı dosyadır:
//
// ESKİ DAVRANIŞ (hatalı): Muhasebeci "Miktarları Düzenle" ile bir satıştaki
// adetleri değiştirdiğinde (Accounting.jsx -> updateSale), sadece satış
// dokümanındaki items/totalAmount/taxAmount/netAmount alanları güncelleniyor,
// depo stoğuna HİÇ dokunulmuyordu. Oysa (Firebase modunda) stok, satış
// oluşturulduğu anda zaten düşürülmüştü. Sonuç: muhasebeci adet artırırsa
// sistem stoğu gerçekte olması gerekenden FAZLA gösteriyor; azaltırsa AZ
// gösteriyordu. Red durumunda da orijinal (satış anındaki) miktar yerine
// düzenlenmiş miktar stoğa geri ekleniyordu, bu da ek bir sapmaya yol
// açıyordu.
//
// YENİ DAVRANIŞ: `editItems` fonksiyonu, eski/yeni kalem miktarları
// arasındaki farkı (bkz. utils/salesMath.ts#computeStockDeltas) hesaplayıp
// stoğu her düzenlemede gerçek zamanlı senkronize eder. Bu sayede stok her
// zaman "satışın o anki hâli" ile tutarlı kalır ve reddedilme durumunda
// yapılan tam iade de artık doğru miktarı geri ekler.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  runTransaction,
  addDoc
} from "firebase/firestore";
import { firestore, isFirebaseActive } from "../firebase";
import type { ActorInfo, Role, Sale, SaleItem } from "../../types";
import { computeSaleTotals, computeStockDeltas, formatReceiptNo } from "../../utils/salesMath";
import { getLocalData, setLocalData, randomId } from "./localStorageUtils";
import { logsRepository } from "./logsRepository";
import { notificationsRepository } from "./notificationsRepository";
import type { Product } from "../../types";

export interface NewSaleInput {
  salespersonId: string;
  salespersonName: string;
  customerId: string;
  customerName: string;
  customerCompany: string;
  items: SaleItem[];
  discountAmount: number;
  notes?: string;
}

export interface SalesRepository {
  getAll(role?: Role | string, userId?: string): Promise<Sale[]>;
  add(saleData: NewSaleInput, actor: ActorInfo): Promise<Sale>;
  editItems(
    saleId: string,
    newItems: SaleItem[],
    discountAmount: number,
    actor: ActorInfo
  ): Promise<Sale>;
  processApproval(
    saleId: string,
    status: "approved" | "rejected",
    notes: string,
    isMicroProcessed: boolean,
    actor: ActorInfo
  ): Promise<Sale>;
  resubmit(
    saleId: string,
    updatedItems: SaleItem[],
    updatedNotes: string,
    updatedDiscount: number,
    actor: ActorInfo
  ): Promise<Sale>;
}

// ---------------------------------------------------------------------------
// FIREBASE IMPLEMENTASYONU
// ---------------------------------------------------------------------------
const firebaseSalesRepository: SalesRepository = {
  async getAll(role, userId) {
    let q;
    if (role === "sales" && userId) {
      q = query(collection(firestore!, "sales"), where("salespersonId", "==", userId));
    } else {
      q = query(collection(firestore!, "sales"), orderBy("date", "desc"));
    }
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, "id">) }));
    if (role === "sales") {
      docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return docs;
  },

  async add(saleData, actor) {
    const prefix = `TS-${new Date().getFullYear()}-`;
    const salesCol = collection(firestore!, "sales");
    const newSaleDocRef = doc(salesCol);
    const counterDocRef = doc(firestore!, "counters", "sales");

    let finalSale!: Sale;

    await runTransaction(firestore!, async (transaction) => {
      const counterDoc = await transaction.get(counterDocRef);
      const lastNum = counterDoc.exists() ? counterDoc.data().lastNo || 0 : 0;
      const nextNum = lastNum + 1;
      const receiptNo = formatReceiptNo(new Date().getFullYear(), nextNum);

      for (const item of saleData.items) {
        const pDocRef = doc(firestore!, "products", item.productId);
        const pDoc = await transaction.get(pDocRef);
        if (!pDoc.exists()) throw new Error(`Ürün bulunamadı: ${item.productName}`);
        const product = pDoc.data() as Product;
        const currentStock = product.stock || 0;
        if (currentStock < item.quantity) {
          throw new Error(
            `Yetersiz stok: ${item.productName} (Mevcut: ${currentStock} ${product.unit || "Adet"}, İstenen: ${item.quantity})`
          );
        }
        transaction.update(pDocRef, { stock: currentStock - item.quantity });
      }

      transaction.set(counterDocRef, { lastNo: nextNum });

      const totals = computeSaleTotals(saleData.items, saleData.discountAmount);
      finalSale = {
        id: newSaleDocRef.id,
        salespersonId: saleData.salespersonId,
        salespersonName: saleData.salespersonName,
        customerId: saleData.customerId,
        customerName: saleData.customerName,
        customerCompany: saleData.customerCompany,
        items: saleData.items,
        notes: saleData.notes,
        discountAmount: saleData.discountAmount,
        ...totals,
        receiptNo,
        status: "pending_accounting",
        accountingProcessed: false,
        processedAt: null,
        processedBy: null,
        createdAt: new Date().toISOString(),
        date: new Date().toISOString()
      };

      const { id, ...saleWithoutId } = finalSale;
      transaction.set(newSaleDocRef, saleWithoutId);
    });

    await logsRepository.add(
      actor,
      "CREATE_SALE",
      `${finalSale.receiptNo} numaralı satış fişi oluşturuldu (Tutar: ${finalSale.netAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL).`
    );

    return finalSale;
  },

  async editItems(saleId, newItems, discountAmount, actor) {
    const docRef = doc(firestore!, "sales", saleId);
    let updatedSale!: Sale;

    await runTransaction(firestore!, async (transaction) => {
      const saleDoc = await transaction.get(docRef);
      if (!saleDoc.exists()) throw new Error("Satış kaydı bulunamadı!");
      const currentSale = saleDoc.data() as Sale;

      if (currentSale.status !== "pending_accounting") {
        throw new Error("Sadece onay bekleyen satışların kalemleri düzenlenebilir!");
      }

      const deltas = computeStockDeltas(currentSale.items || [], newItems);

      // Önce tüm ürünleri oku ve yeterlilik kontrolü yap (transaction kuralı:
      // tüm read'ler write'lardan önce yapılmalı)
      const productSnaps: Record<string, { ref: ReturnType<typeof doc>; stock: number }> = {};
      for (const productId of Object.keys(deltas)) {
        const pDocRef = doc(firestore!, "products", productId);
        const pDoc = await transaction.get(pDocRef);
        if (!pDoc.exists()) throw new Error(`Ürün bulunamadı: ${productId}`);
        const product = pDoc.data() as Product;
        const newStock = (product.stock || 0) + deltas[productId];
        if (newStock < 0) {
          throw new Error(`Yetersiz stok: ${product.name} (Mevcut: ${product.stock}, gereken ek düşüş: ${-deltas[productId]})`);
        }
        productSnaps[productId] = { ref: pDocRef, stock: newStock };
      }

      for (const productId of Object.keys(productSnaps)) {
        transaction.update(productSnaps[productId].ref, { stock: productSnaps[productId].stock });
      }

      const totals = computeSaleTotals(newItems, discountAmount);
      const updatedFields = { items: newItems, discountAmount, ...totals };
      transaction.update(docRef, updatedFields);

      updatedSale = { ...currentSale, id: saleId, ...updatedFields };
    });

    await logsRepository.add(
      actor,
      "UPDATE_SALE",
      `${updatedSale.receiptNo} numaralı satış kaydının kalemleri düzenlendi (stok senkronize edildi).`
    );

    return updatedSale;
  },

  async processApproval(saleId, status, notes, isMicroProcessed, actor) {
    const docRef = doc(firestore!, "sales", saleId);
    const approvalData = {
      status,
      accountingProcessed: isMicroProcessed,
      processedAt: new Date().toISOString(),
      processedBy: actor.currentUserName
    };

    let currentSale!: Sale;

    await runTransaction(firestore!, async (transaction) => {
      const saleDoc = await transaction.get(docRef);
      if (!saleDoc.exists()) throw new Error("Satış kaydı bulunamadı!");
      currentSale = saleDoc.data() as Sale;

      if (currentSale.status !== "pending_accounting") {
        throw new Error(`Bu satış zaten işlenmiş! (Mevcut durum: ${currentSale.status})`);
      }

      if (status === "rejected") {
        // Stok her zaman satışın güncel kalemleriyle senkron tutulduğu için
        // (bkz. editItems), burada kalemlerdeki miktarları aynen geri eklemek
        // stoğu doğru şekilde eski hâline getirir.
        for (const item of currentSale.items || []) {
          const pDocRef = doc(firestore!, "products", item.productId);
          const pDoc = await transaction.get(pDocRef);
          if (pDoc.exists()) {
            const product = pDoc.data() as Product;
            transaction.update(pDocRef, { stock: (product.stock || 0) + item.quantity });
          }
        }
      }

      transaction.update(docRef, approvalData);
    });

    await addDoc(collection(firestore!, "approvals"), {
      saleId,
      status,
      userId: actor.currentUserId,
      userName: actor.currentUserName,
      notes,
      createdAt: new Date().toISOString()
    });

    const actionType = status === "approved" ? "APPROVE_SALE" : "REJECT_SALE";
    const detailMsg =
      status === "approved"
        ? `${saleId} ID'li satış onaylandı. (Mikro'ya işlendi: ${isMicroProcessed ? "Evet" : "Hayır"})`
        : `${saleId} ID'li satış reddedildi, stok iade edildi. Nedeni: ${notes}`;
    await logsRepository.add(actor, actionType, detailMsg);

    const notifMsg =
      status === "approved"
        ? `${currentSale.receiptNo || saleId} numaralı satışınız onaylandı.`
        : `${currentSale.receiptNo || saleId} numaralı satışınız reddedildi. Neden: ${notes}`;
    await notificationsRepository.add(
      currentSale.salespersonId,
      notifMsg,
      status === "approved" ? "success" : "error",
      { saleId, receiptNo: currentSale.receiptNo }
    );

    return { ...currentSale, id: saleId, ...approvalData } as Sale;
  },

  async resubmit(saleId, updatedItems, updatedNotes, updatedDiscount, actor) {
    const docRef = doc(firestore!, "sales", saleId);
    let finalSale!: Sale;

    await runTransaction(firestore!, async (transaction) => {
      const saleDoc = await transaction.get(docRef);
      if (!saleDoc.exists()) throw new Error("Satış kaydı bulunamadı!");
      const currentSale = saleDoc.data() as Sale;
      if (currentSale.status !== "rejected") {
        throw new Error("Sadece reddedilmiş satışlar yeniden gönderilebilir!");
      }

      for (const item of updatedItems) {
        const pDocRef = doc(firestore!, "products", item.productId);
        const pDoc = await transaction.get(pDocRef);
        if (!pDoc.exists()) throw new Error(`Ürün bulunamadı: ${item.productName}`);
        const product = pDoc.data() as Product;
        const currentStock = product.stock || 0;
        if (currentStock < item.quantity) {
          throw new Error(`Yetersiz stok: ${item.productName} (Mevcut: ${currentStock}, İstenen: ${item.quantity})`);
        }
        transaction.update(pDocRef, { stock: currentStock - item.quantity });
      }

      const totals = computeSaleTotals(updatedItems, updatedDiscount);
      const updatedFields = {
        items: updatedItems,
        notes: updatedNotes,
        discountAmount: updatedDiscount,
        ...totals,
        status: "pending_accounting" as const,
        accountingProcessed: false,
        processedAt: null,
        processedBy: null,
        resubmittedAt: new Date().toISOString(),
        resubmittedBy: actor.currentUserName
      };

      transaction.update(docRef, updatedFields);
      finalSale = { ...currentSale, id: saleId, ...updatedFields };
    });

    await logsRepository.add(
      actor,
      "RESUBMIT_SALE",
      `${finalSale.receiptNo} ID'li reddedilen satış düzenlenerek tekrar gönderildi.`
    );

    return finalSale;
  }
};

// ---------------------------------------------------------------------------
// MOCK (LOCALSTORAGE) İMPLEMENTASYONU
// ---------------------------------------------------------------------------
const mockSalesRepository: SalesRepository = {
  async getAll(role, userId) {
    const all = getLocalData<Sale>("takip_sales").sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    if (role === "sales" && userId) {
      return all.filter((s) => s.salespersonId === userId);
    }
    return all;
  },

  async add(saleData, actor) {
    const prefix = `TS-${new Date().getFullYear()}-`;
    const sales = getLocalData<Sale>("takip_sales");
    const products = getLocalData<Product>("takip_products");

    for (const item of saleData.items) {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) throw new Error(`Ürün bulunamadı: ${item.productName}`);
      if (prod.stock < item.quantity) {
        throw new Error(`Yetersiz stok: ${item.productName} (Mevcut: ${prod.stock}, İstenen: ${item.quantity})`);
      }
    }
    for (const item of saleData.items) {
      const idx = products.findIndex((p) => p.id === item.productId);
      if (idx !== -1) products[idx].stock -= item.quantity;
    }
    setLocalData("takip_products", products);

    const matchSales = sales.filter((s) => s.receiptNo && s.receiptNo.startsWith(prefix));
    let lastNum = 0;
    if (matchSales.length > 0) {
      lastNum = Math.max(...matchSales.map((s) => parseInt(s.receiptNo.replace(prefix, ""), 10)));
    }

    let receiptNo = "";
    for (let attempts = 0; attempts < 100; attempts++) {
      const candidate = formatReceiptNo(new Date().getFullYear(), lastNum + 1 + attempts);
      if (!sales.some((s) => s.receiptNo === candidate)) {
        receiptNo = candidate;
        break;
      }
    }
    if (!receiptNo) throw new Error("Fiş numarası üretilemedi (çakışma). Lütfen tekrar deneyin.");

    const totals = computeSaleTotals(saleData.items, saleData.discountAmount);
    const newSale: Sale = {
      id: randomId("sale"),
      salespersonId: saleData.salespersonId,
      salespersonName: saleData.salespersonName,
      customerId: saleData.customerId,
      customerName: saleData.customerName,
      customerCompany: saleData.customerCompany,
      items: saleData.items,
      notes: saleData.notes,
      discountAmount: saleData.discountAmount,
      ...totals,
      receiptNo,
      status: "pending_accounting",
      accountingProcessed: false,
      processedAt: null,
      processedBy: null,
      createdAt: new Date().toISOString(),
      date: new Date().toISOString()
    };

    sales.unshift(newSale);
    setLocalData("takip_sales", sales);

    await logsRepository.add(
      actor,
      "CREATE_SALE",
      `${receiptNo} numaralı satış fişi oluşturuldu (Tutar: ${newSale.netAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL).`
    );

    return newSale;
  },

  async editItems(saleId, newItems, discountAmount, actor) {
    const sales = getLocalData<Sale>("takip_sales");
    const idx = sales.findIndex((s) => s.id === saleId);
    if (idx === -1) throw new Error("Satış kaydı bulunamadı!");
    const oldSale = sales[idx];

    if (oldSale.status !== "pending_accounting") {
      throw new Error("Sadece onay bekleyen satışların kalemleri düzenlenebilir!");
    }

    const deltas = computeStockDeltas(oldSale.items || [], newItems);
    const products = getLocalData<Product>("takip_products");

    for (const productId of Object.keys(deltas)) {
      const pIdx = products.findIndex((p) => p.id === productId);
      if (pIdx === -1) throw new Error(`Ürün bulunamadı: ${productId}`);
      const newStock = products[pIdx].stock + deltas[productId];
      if (newStock < 0) {
        throw new Error(`Yetersiz stok: ${products[pIdx].name} (Mevcut: ${products[pIdx].stock})`);
      }
    }
    for (const productId of Object.keys(deltas)) {
      const pIdx = products.findIndex((p) => p.id === productId);
      products[pIdx].stock += deltas[productId];
    }
    setLocalData("takip_products", products);

    const totals = computeSaleTotals(newItems, discountAmount);
    sales[idx] = { ...oldSale, items: newItems, discountAmount, ...totals };
    setLocalData("takip_sales", sales);

    await logsRepository.add(
      actor,
      "UPDATE_SALE",
      `${oldSale.receiptNo} numaralı satış kaydının kalemleri düzenlendi (stok senkronize edildi).`
    );

    return sales[idx];
  },

  async processApproval(saleId, status, notes, isMicroProcessed, actor) {
    const sales = getLocalData<Sale>("takip_sales");
    const idx = sales.findIndex((s) => s.id === saleId);
    if (idx === -1) throw new Error("Satış kaydı bulunamadı!");

    const oldSale = sales[idx];
    if (oldSale.status !== "pending_accounting") {
      throw new Error(`Bu satış zaten işlenmiş! (Mevcut durum: ${oldSale.status})`);
    }

    if (status === "rejected") {
      const products = getLocalData<Product>("takip_products");
      for (const item of oldSale.items || []) {
        const pIdx = products.findIndex((p) => p.id === item.productId);
        if (pIdx !== -1) products[pIdx].stock += item.quantity;
      }
      setLocalData("takip_products", products);
    }

    sales[idx] = {
      ...oldSale,
      status,
      accountingProcessed: isMicroProcessed,
      processedAt: new Date().toISOString(),
      processedBy: actor.currentUserName
    };
    setLocalData("takip_sales", sales);

    const approvals = getLocalData<Record<string, unknown>>("takip_approvals");
    approvals.push({
      id: randomId("appr"),
      saleId,
      status,
      userId: actor.currentUserId,
      userName: actor.currentUserName,
      notes,
      createdAt: new Date().toISOString()
    });
    setLocalData("takip_approvals", approvals);

    const actionType = status === "approved" ? "APPROVE_SALE" : "REJECT_SALE";
    const detailMsg =
      status === "approved"
        ? `${oldSale.receiptNo} numaralı satış onaylandı. (Mikro'ya işlendi: ${isMicroProcessed ? "Evet" : "Hayır"})`
        : `${oldSale.receiptNo} numaralı satış reddedildi, stok iade edildi. Nedeni: ${notes}`;
    await logsRepository.add(actor, actionType, detailMsg);

    const notifMsg =
      status === "approved"
        ? `${oldSale.receiptNo} numaralı satışınız onaylandı.`
        : `${oldSale.receiptNo} numaralı satışınız reddedildi. Neden: ${notes}`;
    await notificationsRepository.add(
      oldSale.salespersonId,
      notifMsg,
      status === "approved" ? "success" : "error",
      { saleId, receiptNo: oldSale.receiptNo }
    );

    return sales[idx];
  },

  async resubmit(saleId, updatedItems, updatedNotes, updatedDiscount, actor) {
    const sales = getLocalData<Sale>("takip_sales");
    const idx = sales.findIndex((s) => s.id === saleId);
    if (idx === -1) throw new Error("Satış kaydı bulunamadı!");
    const oldSale = sales[idx];
    if (oldSale.status !== "rejected") throw new Error("Sadece reddedilmiş satışlar yeniden gönderilebilir!");

    const products = getLocalData<Product>("takip_products");
    for (const item of updatedItems) {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) throw new Error(`Ürün bulunamadı: ${item.productName}`);
      if (prod.stock < item.quantity) {
        throw new Error(`Yetersiz stok: ${item.productName} (Mevcut: ${prod.stock}, İstenen: ${item.quantity})`);
      }
    }
    for (const item of updatedItems) {
      const pIdx = products.findIndex((p) => p.id === item.productId);
      if (pIdx !== -1) products[pIdx].stock -= item.quantity;
    }
    setLocalData("takip_products", products);

    const totals = computeSaleTotals(updatedItems, updatedDiscount);
    sales[idx] = {
      ...oldSale,
      items: updatedItems,
      notes: updatedNotes,
      discountAmount: updatedDiscount,
      ...totals,
      status: "pending_accounting",
      accountingProcessed: false,
      processedAt: null,
      processedBy: null,
      resubmittedAt: new Date().toISOString(),
      resubmittedBy: actor.currentUserName
    };
    setLocalData("takip_sales", sales);

    await logsRepository.add(
      actor,
      "RESUBMIT_SALE",
      `${oldSale.receiptNo} numaralı reddedilen satış düzenlenerek tekrar gönderildi.`
    );

    return sales[idx];
  }
};

export const salesRepository: SalesRepository = isFirebaseActive
  ? firebaseSalesRepository
  : mockSalesRepository;
