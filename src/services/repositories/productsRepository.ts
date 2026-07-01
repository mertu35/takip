// Takip Sistemi - Ürün (Products) Repository
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy
} from "firebase/firestore";
import { firestore, isFirebaseActive } from "../firebase";
import type { Product, ActorInfo } from "../../types";
import { getLocalData, setLocalData, randomId } from "./localStorageUtils";
import { logsRepository } from "./logsRepository";

export interface ProductsRepository {
  getAll(): Promise<Product[]>;
  add(product: Omit<Product, "id" | "createdAt">, actor: ActorInfo): Promise<Product>;
  update(productId: string, fields: Partial<Product>, actor: ActorInfo): Promise<Product>;
  remove(productId: string, actor: ActorInfo): Promise<boolean>;
}

const firebaseProductsRepository: ProductsRepository = {
  async getAll() {
    const q = query(collection(firestore!, "products"), orderBy("name"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, "id">) }));
  },

  async add(product, actor) {
    const docRef = await addDoc(collection(firestore!, "products"), {
      ...product,
      createdAt: new Date().toISOString()
    });
    await logsRepository.add(
      actor,
      "ADD_PRODUCT",
      `${product.name} (${product.code}) ürünü eklendi.`
    );
    return { id: docRef.id, ...product } as Product;
  },

  async update(productId, fields, actor) {
    const docRef = doc(firestore!, "products", productId);
    await updateDoc(docRef, fields as Record<string, unknown>);
    await logsRepository.add(actor, "UPDATE_PRODUCT", `${fields.name || productId} ürünü güncellendi.`);
    return { id: productId, ...fields } as Product;
  },

  async remove(productId, actor) {
    const docRef = doc(firestore!, "products", productId);
    await deleteDoc(docRef);
    await logsRepository.add(actor, "DELETE_PRODUCT", `${productId} ID'li ürün silindi.`);
    return true;
  }
};

const mockProductsRepository: ProductsRepository = {
  async getAll() {
    return getLocalData<Product>("takip_products").sort((a, b) => a.name.localeCompare(b.name, "tr"));
  },

  async add(product, actor) {
    const products = getLocalData<Product>("takip_products");
    const newProduct: Product = {
      id: randomId("prod"),
      ...product,
      createdAt: new Date().toISOString()
    };
    products.push(newProduct);
    setLocalData("takip_products", products);
    await logsRepository.add(
      actor,
      "ADD_PRODUCT",
      `${product.name} (${product.code}) ürünü eklendi.`
    );
    return newProduct;
  },

  async update(productId, fields, actor) {
    const products = getLocalData<Product>("takip_products");
    const idx = products.findIndex((p) => p.id === productId);
    if (idx === -1) throw new Error("Ürün bulunamadı!");
    products[idx] = { ...products[idx], ...fields };
    setLocalData("takip_products", products);
    await logsRepository.add(actor, "UPDATE_PRODUCT", `${products[idx].name} ürünü güncellendi.`);
    return products[idx];
  },

  async remove(productId, actor) {
    const products = getLocalData<Product>("takip_products");
    const filtered = products.filter((p) => p.id !== productId);
    setLocalData("takip_products", filtered);
    await logsRepository.add(actor, "DELETE_PRODUCT", `${productId} ID'li ürün silindi.`);
    return true;
  }
};

export const productsRepository: ProductsRepository = isFirebaseActive
  ? firebaseProductsRepository
  : mockProductsRepository;
