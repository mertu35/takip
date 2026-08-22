// Takip Sistemi - Tahsilat / Ödeme (Payments) Repository
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  runTransaction,
  getDoc
} from "firebase/firestore";
import { firestore, isFirebaseActive } from "../firebase";
import type { Payment, ActorInfo, Customer, Sale } from "../../types";
import { formatPaymentReceiptNo } from "../../utils/salesMath";
import { getLocalData, setLocalData, randomId } from "./localStorageUtils";
import { logsRepository } from "./logsRepository";
import { notificationsRepository } from "./notificationsRepository";

export interface NewPaymentInput {
  customerId: string;
  customerName: string;
  customerCompany: string;
  amount: number;
  paymentMethod: Payment["paymentMethod"];
  date: string;
  notes?: string;
  checkNumber?: string;
  dueDate?: string;
  saleId?: string;
}

export interface PaymentsRepository {
  getAll(): Promise<Payment[]>;
  getByCustomer(customerId: string): Promise<Payment[]>;
  add(input: NewPaymentInput, actor: ActorInfo): Promise<Payment>;
  remove(paymentId: string, actor: ActorInfo): Promise<boolean>;
  collectSaleCheck(saleId: string, actor: ActorInfo, notes?: string): Promise<{ payment: Payment; sale: Sale }>;
  bounceSaleCheck(saleId: string, actor: ActorInfo, notes?: string): Promise<Sale>;
}

// ---------------------------------------------------------------------------
// FIREBASE IMPLEMENTASYONU
// ---------------------------------------------------------------------------
const firebasePaymentsRepository: PaymentsRepository = {
  async getAll() {
    const snap = await getDocs(collection(firestore!, "payments"));
    const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Payment, "id">) }));
    docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return docs;
  },

  async getByCustomer(customerId: string) {
    const q = query(
      collection(firestore!, "payments"),
      where("customerId", "==", customerId)
    );
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Payment, "id">) }));
    docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return docs;
  },

  async add(input, actor) {
    const paymentsCol = collection(firestore!, "payments");
    const newDocRef = doc(paymentsCol);
    const counterDocRef = doc(firestore!, "counters", "payments");
    const customerDocRef = doc(firestore!, "customers", input.customerId);

    let finalPayment!: Payment;

    await runTransaction(firestore!, async (transaction) => {
      // 1. TÜM OKUMALAR (READS)
      const currentYear = new Date(input.date || Date.now()).getFullYear();
      const counterSnap = await transaction.get(counterDocRef);
      const custSnap = await transaction.get(customerDocRef);

      let nextSequence = 1;
      if (counterSnap.exists()) {
        const data = counterSnap.data() as { sequence?: number; year?: number };
        if (data.year === currentYear && typeof data.sequence === "number") {
          nextSequence = data.sequence + 1;
        }
      }
      const receiptNo = formatPaymentReceiptNo(currentYear, nextSequence);

      // 2. TÜM YAZMALAR (WRITES)
      transaction.set(counterDocRef, { sequence: nextSequence, year: currentYear });

      if (custSnap.exists()) {
        const custData = custSnap.data() as Customer;
        const oldBalance = typeof custData.currentBalance === "number" ? custData.currentBalance : 0;
        const newBalance = oldBalance - input.amount;
        transaction.update(customerDocRef, { currentBalance: newBalance });
      }

      // 3. Tahsilat kaydını oluştur
      const paymentDocData: Omit<Payment, "id"> = {
        receiptNo,
        customerId: input.customerId,
        customerName: input.customerName,
        customerCompany: input.customerCompany,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        date: input.date || new Date().toISOString(),
        notes: input.notes || "",
        checkNumber: input.checkNumber || "",
        dueDate: input.dueDate || "",
        createdById: actor.currentUserId,
        createdByName: actor.currentUserName,
        createdByRole: actor.currentUserRole,
        createdAt: new Date().toISOString()
      };

      transaction.set(newDocRef, paymentDocData);
      finalPayment = { id: newDocRef.id, ...paymentDocData };
    });

    // 4. Log ve Bildirimler
    await logsRepository.add(
      actor,
      "ADD_PAYMENT",
      `${input.customerCompany} firmasından ${input.amount.toLocaleString("tr-TR")} ₺ tahsilat alındı (${finalPayment.receiptNo}).`
    );

    // Muhasebe ve admin rolündeki kullanıcılara bildirim gönder
    try {
      const usersSnap = await getDocs(collection(firestore!, "users"));
      const notifyTargets = usersSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as { role?: string }) }))
        .filter((u) => (u.role === "accounting" || u.role === "admin") && u.id !== actor.currentUserId);

      for (const target of notifyTargets) {
        await notificationsRepository.add(
          target.id,
          `Yeni tahsilat: ${input.customerCompany} - ${input.amount.toLocaleString("tr-TR")} ₺ (${finalPayment.receiptNo})`,
          "success"
        );
      }
    } catch {
      // Bildirim hatası kritik değil
    }

    return finalPayment;
  },

  async remove(paymentId, actor) {
    const paymentDocRef = doc(firestore!, "payments", paymentId);
    const snap = await getDoc(paymentDocRef);
    if (!snap.exists()) throw new Error("Tahsilat kaydı bulunamadı.");

    const payment = snap.data() as Payment;
    const customerDocRef = doc(firestore!, "customers", payment.customerId);
    const saleDocRef = payment.saleId ? doc(firestore!, "sales", payment.saleId) : null;

    await runTransaction(firestore!, async (t) => {
      // Firestore transaction kuralı: TÜM okumalar TÜM yazmalardan önce
      // yapılmalıdır. Önceden müşteri okunup hemen güncelleniyor, ardından
      // satış okunuyordu; bu sıralama yüzünden çeke bağlı bir tahsilatın
      // iptali her seferinde hata veriyordu (saleId boş olan tahsilatlarda
      // ikinci okuma hiç yapılmadığı için sorun görünmüyordu).
      //
      // --- ÖNCE OKUMALAR ---
      const custSnap = await t.get(customerDocRef);
      const saleSnap = saleDocRef ? await t.get(saleDocRef) : null;

      // --- SONRA YAZMALAR ---
      // 1. Müşterinin bakiyesine iptal edilen tahsilatı geri ekle
      if (custSnap.exists()) {
        const custData = custSnap.data() as Customer;
        const oldBalance = typeof custData.currentBalance === "number" ? custData.currentBalance : 0;
        t.update(customerDocRef, { currentBalance: oldBalance + payment.amount });
      }

      // 2. Eğer bu tahsilat bir satış çekine bağlıysa satışın durumunu tekrar 'portfolio' yap
      if (saleDocRef && saleSnap && saleSnap.exists()) {
        t.update(saleDocRef, { checkStatus: "portfolio" });
      }

      // 3. Tahsilat kaydını sil
      t.delete(paymentDocRef);
    });

    await logsRepository.add(
      actor,
      "DELETE_PAYMENT",
      `${payment.receiptNo} numaralı ${payment.amount.toLocaleString("tr-TR")} ₺ tutarındaki tahsilat silindi/iptal edildi.${payment.saleId ? " (Bağlı satış çeki tekrar 'Portföyde' durumuna alındı.)" : ""}`
    );

    return true;
  },

  async collectSaleCheck(saleId, actor, notes) {
    const saleDocRef = doc(firestore!, "sales", saleId);
    const paymentsCol = collection(firestore!, "payments");
    const newPaymentDocRef = doc(paymentsCol);
    const counterDocRef = doc(firestore!, "counters", "payments");

    let finalPayment!: Payment;
    let finalSale!: Sale;

    await runTransaction(firestore!, async (transaction) => {
      // 1. TÜM OKUMALAR (READS)
      const saleSnap = await transaction.get(saleDocRef);
      if (!saleSnap.exists()) throw new Error("Satış kaydı bulunamadı!");
      const saleData = saleSnap.data() as Sale;

      if (saleData.checkStatus === "collected") {
        throw new Error("Bu çek zaten tahsil edilmiş!");
      }

      const currentYear = new Date().getFullYear();
      const counterSnap = await transaction.get(counterDocRef);
      const customerDocRef = doc(firestore!, "customers", saleData.customerId);
      const custSnap = await transaction.get(customerDocRef);

      let nextSequence = 1;
      if (counterSnap.exists()) {
        const data = counterSnap.data() as { sequence?: number; year?: number };
        if (data.year === currentYear && typeof data.sequence === "number") {
          nextSequence = data.sequence + 1;
        }
      }
      const receiptNo = formatPaymentReceiptNo(currentYear, nextSequence);

      // 2. TÜM YAZMALAR (WRITES)
      transaction.set(counterDocRef, { sequence: nextSequence, year: currentYear });

      if (custSnap.exists()) {
        const custData = custSnap.data() as Customer;
        const oldBalance = typeof custData.currentBalance === "number" ? custData.currentBalance : 0;
        transaction.update(customerDocRef, { currentBalance: oldBalance - saleData.netAmount });
      }

      transaction.update(saleDocRef, { checkStatus: "collected" });
      finalSale = { ...saleData, id: saleSnap.id, checkStatus: "collected" };

      // 4. Tahsilat (Payment) kaydı oluştur
      const paymentDocData: Omit<Payment, "id"> = {
        receiptNo,
        customerId: saleData.customerId,
        customerName: saleData.customerName,
        customerCompany: saleData.customerCompany,
        amount: saleData.netAmount,
        paymentMethod: "check",
        date: new Date().toISOString(),
        notes: notes || `${saleData.receiptNo} numaralı satış çeki tahsil edildi.`,
        checkNumber: saleData.checkNumber || "",
        dueDate: saleData.paymentDueDate || "",
        saleId: saleData.id,
        checkStatus: "collected",
        createdById: actor.currentUserId,
        createdByName: actor.currentUserName,
        createdByRole: actor.currentUserRole,
        createdAt: new Date().toISOString()
      };

      transaction.set(newPaymentDocRef, paymentDocData);
      finalPayment = { id: newPaymentDocRef.id, ...paymentDocData };
    });

    await logsRepository.add(
      actor,
      "COLLECT_CHECK",
      `${finalSale.customerCompany} firmasına ait ${finalSale.receiptNo} numaralı satışın çeki tahsil edildi (${finalPayment.amount.toLocaleString("tr-TR")} ₺, Makbuz: ${finalPayment.receiptNo}).`
    );

    return { payment: finalPayment, sale: finalSale };
  },

  async bounceSaleCheck(saleId, actor, _notes) {
    const saleDocRef = doc(firestore!, "sales", saleId);
    let finalSale!: Sale;

    await runTransaction(firestore!, async (transaction) => {
      const saleSnap = await transaction.get(saleDocRef);
      if (!saleSnap.exists()) throw new Error("Satış kaydı bulunamadı!");
      const saleData = saleSnap.data() as Sale;

      transaction.update(saleDocRef, { checkStatus: "bounced" });
      finalSale = { ...saleData, id: saleSnap.id, checkStatus: "bounced" };
    });

    await logsRepository.add(
      actor,
      "BOUNCE_CHECK",
      `${finalSale.customerCompany} firmasına ait ${finalSale.receiptNo} numaralı satışın çeki KARŞILIKSIZ / PROTESTOLU olarak işaretlendi (${finalSale.netAmount.toLocaleString("tr-TR")} ₺).`
    );

    return finalSale;
  }
};

// ---------------------------------------------------------------------------
// LOCALSTORAGE / MOCK IMPLEMENTASYONU
// ---------------------------------------------------------------------------
function generateMockPaymentReceiptNo(payments: Payment[], dateStr?: string): string {
  const currentYear = new Date(dateStr || Date.now()).getFullYear();
  const prefix = `THS-${currentYear}-`;

  const matchPayments = payments.filter((p) => p.receiptNo && p.receiptNo.startsWith(prefix));
  let lastNum = 0;
  if (matchPayments.length > 0) {
    lastNum = Math.max(...matchPayments.map((p) => parseInt(p.receiptNo.replace(prefix, ""), 10) || 0));
  }

  let receiptNo = "";
  for (let attempts = 0; attempts < 100; attempts++) {
    const candidate = formatPaymentReceiptNo(currentYear, lastNum + 1 + attempts);
    if (!payments.some((p) => p.receiptNo === candidate)) {
      receiptNo = candidate;
      break;
    }
  }
  if (!receiptNo) throw new Error("Tahsilat makbuz numarası üretilemedi (çakışma). Lütfen tekrar deneyin.");
  return receiptNo;
}

const mockPaymentsRepository: PaymentsRepository = {
  async getAll() {
    return getLocalData<Payment>("takip_payments").sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  },

  async getByCustomer(customerId: string) {
    return getLocalData<Payment>("takip_payments")
      .filter((p) => p.customerId === customerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async add(input, actor) {
    const payments = getLocalData<Payment>("takip_payments");
    const receiptNo = generateMockPaymentReceiptNo(payments, input.date);

    const newPayment: Payment = {
      id: randomId("pay"),
      receiptNo,
      customerId: input.customerId,
      customerName: input.customerName,
      customerCompany: input.customerCompany,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      date: input.date || new Date().toISOString(),
      notes: input.notes || "",
      checkNumber: input.checkNumber || "",
      dueDate: input.dueDate || "",
      saleId: input.saleId,
      createdById: actor.currentUserId,
      createdByName: actor.currentUserName,
      createdByRole: actor.currentUserRole,
      createdAt: new Date().toISOString()
    };

    payments.push(newPayment);
    setLocalData("takip_payments", payments);

    // Müşteri bakiyesini güncelle
    const customers = getLocalData<Customer>("takip_customers");
    const custIdx = customers.findIndex((c) => c.id === input.customerId);
    if (custIdx !== -1) {
      const oldBalance = typeof customers[custIdx].currentBalance === "number" ? customers[custIdx].currentBalance : 0;
      customers[custIdx].currentBalance = oldBalance - input.amount;
      setLocalData("takip_customers", customers);
    }

    await logsRepository.add(
      actor,
      "ADD_PAYMENT",
      `${input.customerCompany} firmasından ${input.amount.toLocaleString("tr-TR")} ₺ tahsilat alındı (${newPayment.receiptNo}).`
    );

    return newPayment;
  },

  async remove(paymentId, actor) {
    const payments = getLocalData<Payment>("takip_payments");
    const target = payments.find((p) => p.id === paymentId);
    if (!target) throw new Error("Tahsilat kaydı bulunamadı.");

    const filtered = payments.filter((p) => p.id !== paymentId);
    setLocalData("takip_payments", filtered);

    // Müşteri bakiyesine geri ekle
    const customers = getLocalData<Customer>("takip_customers");
    const custIdx = customers.findIndex((c) => c.id === target.customerId);
    if (custIdx !== -1) {
      const oldBalance = typeof customers[custIdx].currentBalance === "number" ? customers[custIdx].currentBalance : 0;
      customers[custIdx].currentBalance = oldBalance + target.amount;
      setLocalData("takip_customers", customers);
    }

    // Eğer bu tahsilat bir satış çekine bağlıysa satışın durumunu tekrar 'portfolio' yap
    if (target.saleId) {
      const sales = getLocalData<Sale>("takip_sales");
      const saleIdx = sales.findIndex((s) => s.id === target.saleId);
      if (saleIdx !== -1) {
        sales[saleIdx].checkStatus = "portfolio";
        setLocalData("takip_sales", sales);
      }
    }

    await logsRepository.add(
      actor,
      "DELETE_PAYMENT",
      `${target.receiptNo} numaralı ${target.amount.toLocaleString("tr-TR")} ₺ tutarındaki tahsilat silindi/iptal edildi.${target.saleId ? " (Bağlı satış çeki tekrar 'Portföyde' durumuna alındı.)" : ""}`
    );

    return true;
  },

  async collectSaleCheck(saleId, actor, notes) {
    const sales = getLocalData<Sale>("takip_sales");
    const saleIdx = sales.findIndex((s) => s.id === saleId);
    if (saleIdx === -1) throw new Error("Satış kaydı bulunamadı!");
    const saleData = sales[saleIdx];

    if (saleData.checkStatus === "collected") {
      throw new Error("Bu çek zaten tahsil edilmiş!");
    }

    const payments = getLocalData<Payment>("takip_payments");
    const receiptNo = generateMockPaymentReceiptNo(payments);

    // Müşteri bakiyesi
    const customers = getLocalData<Customer>("takip_customers");
    const custIdx = customers.findIndex((c) => c.id === saleData.customerId);
    if (custIdx !== -1) {
      customers[custIdx].currentBalance = (customers[custIdx].currentBalance || 0) - saleData.netAmount;
      setLocalData("takip_customers", customers);
    }

    // Satış çek durumu
    sales[saleIdx].checkStatus = "collected";
    setLocalData("takip_sales", sales);

    // Payment kaydı
    const newPayment: Payment = {
      id: randomId("pay"),
      receiptNo,
      customerId: saleData.customerId,
      customerName: saleData.customerName,
      customerCompany: saleData.customerCompany,
      amount: saleData.netAmount,
      paymentMethod: "check",
      date: new Date().toISOString(),
      notes: notes || `${saleData.receiptNo} numaralı satış çeki tahsil edildi.`,
      checkNumber: saleData.checkNumber || "",
      dueDate: saleData.paymentDueDate || "",
      saleId: saleData.id,
      checkStatus: "collected",
      createdById: actor.currentUserId,
      createdByName: actor.currentUserName,
      createdByRole: actor.currentUserRole,
      createdAt: new Date().toISOString()
    };

    payments.push(newPayment);
    setLocalData("takip_payments", payments);

    await logsRepository.add(
      actor,
      "COLLECT_CHECK",
      `${saleData.customerCompany} firmasına ait ${saleData.receiptNo} numaralı satışın çeki tahsil edildi (${newPayment.amount.toLocaleString("tr-TR")} ₺, Makbuz: ${newPayment.receiptNo}).`
    );

    return { payment: newPayment, sale: sales[saleIdx] };
  },

  async bounceSaleCheck(saleId, actor, _notes) {
    const sales = getLocalData<Sale>("takip_sales");
    const saleIdx = sales.findIndex((s) => s.id === saleId);
    if (saleIdx === -1) throw new Error("Satış kaydı bulunamadı!");

    sales[saleIdx].checkStatus = "bounced";
    setLocalData("takip_sales", sales);

    await logsRepository.add(
      actor,
      "BOUNCE_CHECK",
      `${sales[saleIdx].customerCompany} firmasına ait ${sales[saleIdx].receiptNo} numaralı satışın çeki KARŞILIKSIZ / PROTESTOLU olarak işaretlendi (${sales[saleIdx].netAmount.toLocaleString("tr-TR")} ₺).`
    );

    return sales[saleIdx];
  }
};

export const paymentsRepository: PaymentsRepository = isFirebaseActive
  ? firebasePaymentsRepository
  : mockPaymentsRepository;
