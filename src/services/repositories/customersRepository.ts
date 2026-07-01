// Takip Sistemi - Müşteri (Customers) Repository
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, where } from "firebase/firestore";
import { firestore, isFirebaseActive } from "../firebase";
import type { Customer, ActorInfo, Sale } from "../../types";
import { getLocalData, setLocalData, randomId } from "./localStorageUtils";
import { logsRepository } from "./logsRepository";

export interface CustomersRepository {
  getAll(): Promise<Customer[]>;
  add(customer: Omit<Customer, "id" | "createdAt">, actor: ActorInfo): Promise<Customer>;
  update(customerId: string, fields: Partial<Customer>, actor: ActorInfo): Promise<Customer>;
  remove(customerId: string, actor: ActorInfo): Promise<boolean>;
}

const firebaseCustomersRepository: CustomersRepository = {
  async getAll() {
    const q = query(collection(firestore!, "customers"), orderBy("name"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Customer, "id">) }));
  },
  async add(customer, actor) {
    const docRef = await addDoc(collection(firestore!, "customers"), {
      ...customer,
      createdAt: new Date().toISOString()
    });
    await logsRepository.add(
      actor,
      "ADD_CUSTOMER",
      `${customer.name} (${customer.company}) müşterisi eklendi.`
    );
    return { id: docRef.id, ...customer } as Customer;
  },
  async update(customerId, fields, actor) {
    const docRef = doc(firestore!, "customers", customerId);
    await updateDoc(docRef, fields as Record<string, unknown>);
    await logsRepository.add(actor, "UPDATE_CUSTOMER", `${fields.name || customerId} müşteri bilgileri güncellendi.`);
    return { id: customerId, ...fields } as Customer;
  },
  async remove(customerId, actor) {
    const docRef = doc(firestore!, "customers", customerId);
    await deleteDoc(docRef);
    await logsRepository.add(actor, "DELETE_CUSTOMER", `${customerId} ID'li müşteri silindi.`);
    return true;
  }
};

const mockCustomersRepository: CustomersRepository = {
  async getAll() {
    return getLocalData<Customer>("takip_customers").sort((a, b) => a.name.localeCompare(b.name, "tr"));
  },
  async add(customer, actor) {
    const customers = getLocalData<Customer>("takip_customers");
    const newCustomer: Customer = { id: randomId("cust"), ...customer, createdAt: new Date().toISOString() };
    customers.push(newCustomer);
    setLocalData("takip_customers", customers);
    await logsRepository.add(
      actor,
      "ADD_CUSTOMER",
      `${customer.name} (${customer.company}) müşterisi eklendi.`
    );
    return newCustomer;
  },
  async update(customerId, fields, actor) {
    const customers = getLocalData<Customer>("takip_customers");
    const idx = customers.findIndex((c) => c.id === customerId);
    if (idx === -1) throw new Error("Müşteri bulunamadı!");
    customers[idx] = { ...customers[idx], ...fields };
    setLocalData("takip_customers", customers);
    await logsRepository.add(actor, "UPDATE_CUSTOMER", `${customers[idx].name} müşteri bilgileri güncellendi.`);
    return customers[idx];
  },
  async remove(customerId, actor) {
    const customers = getLocalData<Customer>("takip_customers");
    const target = customers.find((c) => c.id === customerId);
    const filtered = customers.filter((c) => c.id !== customerId);
    setLocalData("takip_customers", filtered);
    await logsRepository.add(actor, "DELETE_CUSTOMER", `${target ? target.name : customerId} müşterisi silindi.`);
    return true;
  }
};

export const customersRepository: CustomersRepository = isFirebaseActive
  ? firebaseCustomersRepository
  : mockCustomersRepository;

// Bir müşterinin geçmiş satışlarını getirir (Customers.jsx sayfası tarafından kullanılır)
export async function getSalesByCustomer(customerId: string): Promise<Sale[]> {
  if (isFirebaseActive) {
    const q = query(collection(firestore!, "sales"), where("customerId", "==", customerId));
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, "id">) }));
    docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return docs;
  } else {
    return getLocalData<Sale>("takip_sales")
      .filter((s) => s.customerId === customerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}
