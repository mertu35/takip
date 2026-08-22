// Takip Sistemi - Teklif Mektubu (Proposals) Repository
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  orderBy,
  runTransaction,
  deleteDoc,
  updateDoc
} from "firebase/firestore";
import { firestore, isFirebaseActive } from "../firebase";
import type { ActorInfo, Proposal, ProposalItem, ProposalStatus } from "../../types";
import { getLocalData, setLocalData, randomId } from "./localStorageUtils";
import { logsRepository } from "./logsRepository";

export interface NewProposalInput {
  date: string;
  validUntil: string;
  salespersonId: string;
  salespersonName: string;
  salespersonPhone?: string;
  customerId?: string;
  customerName: string;
  customerCompany?: string;
  customerPhone?: string;
  customerAddress?: string;
  items: ProposalItem[];
  discountAmount?: number;
  notes?: string;
  termsAndConditions?: string;
  status?: ProposalStatus;
}

export interface ProposalsRepository {
  getAll(role?: string, userId?: string): Promise<Proposal[]>;
  getById(id: string): Promise<Proposal | null>;
  add(input: NewProposalInput, actor: ActorInfo): Promise<Proposal>;
  update(id: string, updatedFields: Partial<Proposal>, actor: ActorInfo): Promise<Proposal>;
  updateStatus(id: string, status: ProposalStatus, actor: ActorInfo): Promise<void>;
  remove(id: string, actor: ActorInfo): Promise<void>;
}

export const formatProposalNo = (year: number, seq: number): string => {
  return `TKL-${year}-${String(seq).padStart(4, "0")}`;
};

export const computeProposalTotals = (items: ProposalItem[], discount: number = 0) => {
  let subtotal = 0;
  let taxAmount = 0;

  for (const item of items) {
    const itemTotal = (item.quantity || 0) * (item.price || 0);
    subtotal += itemTotal;
    taxAmount += itemTotal * ((item.taxRate ?? 20) / 100);
  }

  const netAfterDiscount = Math.max(0, subtotal - discount);
  const totalAmount = netAfterDiscount + taxAmount;

  return {
    subtotal,
    discountAmount: discount,
    taxAmount,
    totalAmount
  };
};

const firebaseProposalsRepository: ProposalsRepository = {
  async getAll() {
    const col = collection(firestore!, "proposals");
    const q = query(col, orderBy("createdAt", "desc"));

    try {
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Proposal, "id">) }));
    } catch (_err: any) {
      // Index henüz oluşmadıysa fallback sıralamasız sorgu
      const fallbackSnap = await getDocs(col);
      const docs = fallbackSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Proposal, "id">) }));
      return docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  },

  async getById(id) {
    const docRef = doc(firestore!, "proposals", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<Proposal, "id">) };
  },

  async add(input, actor) {
    const col = collection(firestore!, "proposals");
    const newDocRef = doc(col);
    const counterDocRef = doc(firestore!, "counters", "proposals");

    let finalProposal!: Proposal;

    await runTransaction(firestore!, async (transaction) => {
      const counterDoc = await transaction.get(counterDocRef);
      const lastNum = counterDoc.exists() ? counterDoc.data().lastNo || 0 : 0;
      const nextNum = lastNum + 1;
      const proposalNo = formatProposalNo(new Date().getFullYear(), nextNum);

      const totals = computeProposalTotals(input.items, input.discountAmount || 0);

      finalProposal = {
        id: newDocRef.id,
        proposalNo,
        date: input.date || new Date().toISOString().split("T")[0],
        validUntil: input.validUntil || new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
        salespersonId: input.salespersonId,
        salespersonName: input.salespersonName,
        salespersonPhone: input.salespersonPhone || "",
        customerId: input.customerId || "",
        customerName: input.customerName || "",
        customerCompany: input.customerCompany || "",
        customerPhone: input.customerPhone || "",
        customerAddress: input.customerAddress || "",
        items: input.items,
        ...totals,
        status: input.status || "sent",
        notes: input.notes || "",
        termsAndConditions: input.termsAndConditions || "1. Fiyatlarımıza KDV dahil değildir.\n2. Teklifimiz belirtilen geçerlilik tarihine kadar geçerlidir.\n3. Nakliye ve montaj şartları teklif detayında belirtilmiştir.",
        createdAt: new Date().toISOString()
      };

      transaction.set(counterDocRef, { lastNo: nextNum }, { merge: true });
      const { id: _, ...proposalData } = finalProposal;
      transaction.set(newDocRef, proposalData);
    });

    await logsRepository.add(
      actor,
      "CREATE_PROPOSAL",
      `${finalProposal.proposalNo} numaralı Teklif Mektubu hazırlandı (${finalProposal.customerName || finalProposal.customerCompany} - ${finalProposal.totalAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL).`
    );

    return finalProposal;
  },

  async update(id, updatedFields, actor) {
    if (actor.currentUserRole === "sales") {
      throw new Error("Güvenlik Kısıtlaması: Teklif mektupları oluşturulduktan sonra satış elemanları tarafından düzenlenemez. Yalnızca Yönetici (Patron) düzenleyebilir.");
    }

    const docRef = doc(firestore!, "proposals", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error("Teklif bulunamadı!");

    const currentData = snap.data() as Proposal;
    let totals = {
      subtotal: currentData.subtotal,
      discountAmount: currentData.discountAmount,
      taxAmount: currentData.taxAmount,
      totalAmount: currentData.totalAmount
    };

    if (updatedFields.items) {
      totals = computeProposalTotals(
        updatedFields.items,
        updatedFields.discountAmount !== undefined ? updatedFields.discountAmount : currentData.discountAmount
      );
    }

    const payload = {
      ...updatedFields,
      ...totals,
      updatedAt: new Date().toISOString()
    };

    await updateDoc(docRef, payload);

    await logsRepository.add(
      actor,
      "UPDATE_PROPOSAL",
      `${currentData.proposalNo} numaralı Teklif Mektubu güncellendi.`
    );

    return { ...currentData, id, ...payload };
  },

  async updateStatus(id, status, actor) {
    const docRef = doc(firestore!, "proposals", id);
    await updateDoc(docRef, { status, updatedAt: new Date().toISOString() });
    await logsRepository.add(actor, "UPDATE_PROPOSAL_STATUS", `Teklif durumu güncellendi: ${status}`);
  },

  async remove(id, actor) {
    if (actor.currentUserRole === "sales") {
      throw new Error("Güvenlik Kısıtlaması: Satış elemanları oluşturulmuş teklifleri silemez. Yalnızca Yönetici (Patron) silebilir.");
    }

    const docRef = doc(firestore!, "proposals", id);
    const snap = await getDoc(docRef);
    const proposalNo = snap.exists() ? (snap.data() as Proposal).proposalNo : id;

    await deleteDoc(docRef);
    await logsRepository.add(actor, "DELETE_PROPOSAL", `${proposalNo} numaralı Teklif Mektubu silindi.`);
  }
};

const mockProposalsRepository: ProposalsRepository = {
  async getAll() {
    const list = getLocalData<Proposal>("takip_proposals");
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getById(id) {
    const list = getLocalData<Proposal>("takip_proposals");
    return list.find((p) => p.id === id) || null;
  },

  async add(input, actor) {
    const list = getLocalData<Proposal>("takip_proposals");
    const seq = list.length + 1;
    const proposalNo = formatProposalNo(new Date().getFullYear(), seq);
    const totals = computeProposalTotals(input.items, input.discountAmount || 0);

    const newProposal: Proposal = {
      id: randomId("tkl"),
      proposalNo,
      date: input.date || new Date().toISOString().split("T")[0],
      validUntil: input.validUntil || new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
      salespersonId: input.salespersonId,
      salespersonName: input.salespersonName,
      salespersonPhone: input.salespersonPhone || "",
      customerId: input.customerId || "",
      customerName: input.customerName || "",
      customerCompany: input.customerCompany || "",
      customerPhone: input.customerPhone || "",
      customerAddress: input.customerAddress || "",
      items: input.items,
      ...totals,
      status: input.status || "sent",
      notes: input.notes || "",
      termsAndConditions: input.termsAndConditions || "1. Fiyatlarımıza KDV dahil değildir.\n2. Teklifimiz 7 gün geçerlidir.",
      createdAt: new Date().toISOString()
    };

    list.unshift(newProposal);
    setLocalData("takip_proposals", list);
    await logsRepository.add(actor, "CREATE_PROPOSAL", `${newProposal.proposalNo} oluşturuldu.`);
    return newProposal;
  },

  async update(id, updatedFields, actor) {
    const list = getLocalData<Proposal>("takip_proposals");
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Teklif bulunamadı!");

    const current = list[idx];
    const totals = updatedFields.items
      ? computeProposalTotals(
          updatedFields.items,
          updatedFields.discountAmount !== undefined ? updatedFields.discountAmount : current.discountAmount
        )
      : {};

    const updated = { ...current, ...updatedFields, ...totals, updatedAt: new Date().toISOString() };
    list[idx] = updated;
    setLocalData("takip_proposals", list);
    await logsRepository.add(actor, "UPDATE_PROPOSAL", `${current.proposalNo} güncellendi.`);
    return updated;
  },

  async updateStatus(id, status, actor) {
    const list = getLocalData<Proposal>("takip_proposals");
    const idx = list.findIndex((p) => p.id === id);
    if (idx !== -1) {
      list[idx].status = status;
      list[idx].updatedAt = new Date().toISOString();
      setLocalData("takip_proposals", list);
      await logsRepository.add(
        actor,
        "UPDATE_PROPOSAL_STATUS",
        `${list[idx].proposalNo} numaralı teklif mektubunun durumu "${status}" olarak güncellendi.`
      );
    }
  },

  async remove(id, actor) {
    let list = getLocalData<Proposal>("takip_proposals");
    list = list.filter((p) => p.id !== id);
    setLocalData("takip_proposals", list);
    await logsRepository.add(actor, "DELETE_PROPOSAL", `Teklif silindi.`);
  }
};

export const proposalsRepository: ProposalsRepository = isFirebaseActive
  ? firebaseProposalsRepository
  : mockProposalsRepository;
