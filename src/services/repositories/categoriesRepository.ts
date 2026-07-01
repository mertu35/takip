// Takip Sistemi - Kategori (Categories) Repository
import { collection, getDocs, addDoc, query, orderBy } from "firebase/firestore";
import { firestore, isFirebaseActive } from "../firebase";
import type { Category, ActorInfo } from "../../types";
import { getLocalData, setLocalData, randomId } from "./localStorageUtils";
import { logsRepository } from "./logsRepository";

export interface CategoriesRepository {
  getAll(): Promise<Category[]>;
  add(category: Omit<Category, "id" | "createdAt">, actor: ActorInfo): Promise<Category>;
}

const firebaseCategoriesRepository: CategoriesRepository = {
  async getAll() {
    const q = query(collection(firestore!, "categories"), orderBy("name"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Category, "id">) }));
  },
  async add(category, actor) {
    const docRef = await addDoc(collection(firestore!, "categories"), {
      ...category,
      createdAt: new Date().toISOString()
    });
    await logsRepository.add(actor, "ADD_CATEGORY", `${category.name} kategorisi oluşturuldu.`);
    return { id: docRef.id, ...category } as Category;
  }
};

const mockCategoriesRepository: CategoriesRepository = {
  async getAll() {
    return getLocalData<Category>("takip_categories").sort((a, b) => a.name.localeCompare(b.name, "tr"));
  },
  async add(category, actor) {
    const categories = getLocalData<Category>("takip_categories");
    const newCategory: Category = { id: randomId("cat"), ...category, createdAt: new Date().toISOString() };
    categories.push(newCategory);
    setLocalData("takip_categories", categories);
    await logsRepository.add(actor, "ADD_CATEGORY", `${category.name} kategorisi oluşturuldu.`);
    return newCategory;
  }
};

export const categoriesRepository: CategoriesRepository = isFirebaseActive
  ? firebaseCategoriesRepository
  : mockCategoriesRepository;
