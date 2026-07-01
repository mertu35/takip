// Takip Sistemi - Veritabanı Servisi (İnce Facade)
//
// Bu dosya, sayfaların (`pages/*`) kullandığı eski fonksiyon imzalarını
// olduğu gibi korur; gerçek iş mantığı artık `services/repositories/*`
// altındaki repository modüllerinde yaşıyor (bkz. proje incelemesi:
// "dual-mode kod tekrarı" eleştirisi). Firebase/Mock ayrımı artık her
// fonksiyonun içinde tekrar tekrar değil, her repository modülünde TEK
// SEFER yapılıyor.
import { isFirebaseActive } from "./firebase";
import type {
  Product,
  Category,
  Customer,
  Sale,
  SaleItem,
  AppNotification,
  NotificationType,
  LogEntry,
  Announcement,
  CompanyProfile,
  Role,
  ActorInfo
} from "../types";

import { productsRepository } from "./repositories/productsRepository";
import { categoriesRepository } from "./repositories/categoriesRepository";
import { customersRepository, getSalesByCustomer as _getSalesByCustomer } from "./repositories/customersRepository";
import { salesRepository } from "./repositories/salesRepository";
import { notificationsRepository } from "./repositories/notificationsRepository";
import { logsRepository } from "./repositories/logsRepository";
import { announcementsRepository } from "./repositories/announcementsRepository";
import {
  settingsRepository,
  exportBackupData as _exportBackupData,
  importBackupData as _importBackupData
} from "./repositories/settingsRepository";
import { getLocalData, setLocalData } from "./repositories/localStorageUtils";
import {
  INITIAL_CUSTOMERS,
  INITIAL_PRODUCTS,
  INITIAL_CATEGORIES,
  INITIAL_SALES,
  INITIAL_LOGS
} from "./mockData";

// --- YEREL SİMÜLASYON İLKLENDİRME ---
function initLocalStorage() {
  if (!localStorage.getItem("takip_customers")) setLocalData("takip_customers", INITIAL_CUSTOMERS);
  if (!localStorage.getItem("takip_products")) setLocalData("takip_products", INITIAL_PRODUCTS);
  if (!localStorage.getItem("takip_categories")) setLocalData("takip_categories", INITIAL_CATEGORIES);
  if (!localStorage.getItem("takip_sales")) setLocalData("takip_sales", INITIAL_SALES);
  if (!localStorage.getItem("takip_logs")) setLocalData("takip_logs", INITIAL_LOGS);
  if (!localStorage.getItem("takip_announcements")) {
    setLocalData("takip_announcements", [
      { id: "ann-1", text: "Özkon Çelik Takip Sistemine Hoş Geldiniz! İyi çalışmalar dileriz.", active: true, createdAt: new Date().toISOString() }
    ]);
  }
}
if (!isFirebaseActive) {
  initLocalStorage();
}

const actorOf = (currentUserId: string, currentUserName: string, currentUserRole: Role | string): ActorInfo => ({
  currentUserId,
  currentUserName,
  currentUserRole
});

// --- LOG ---
export const addLog = (
  userId: string,
  userName: string,
  userRole: Role | string,
  action: string,
  details: string
) => logsRepository.add(actorOf(userId, userName, userRole), action, details);

export const getLogs = (): Promise<LogEntry[]> => logsRepository.getRecent();

// --- MÜŞTERİLER ---
export const getCustomers = (): Promise<Customer[]> => customersRepository.getAll();

export const addCustomer = (
  customer: Omit<Customer, "id" | "createdAt">,
  currentUserId: string,
  currentUserName: string,
  currentUserRole: Role | string
) => customersRepository.add(customer, actorOf(currentUserId, currentUserName, currentUserRole));

export const updateCustomer = (
  customerId: string,
  updatedFields: Partial<Customer>,
  currentUserId: string,
  currentUserName: string,
  currentUserRole: Role | string
) => customersRepository.update(customerId, updatedFields, actorOf(currentUserId, currentUserName, currentUserRole));

export const deleteCustomer = (
  customerId: string,
  currentUserId: string,
  currentUserName: string,
  currentUserRole: Role | string
) => customersRepository.remove(customerId, actorOf(currentUserId, currentUserName, currentUserRole));

export const getSalesByCustomer = (customerId: string): Promise<Sale[]> => _getSalesByCustomer(customerId);

// --- KATEGORİLER ---
export const getCategories = (): Promise<Category[]> => categoriesRepository.getAll();

export const addCategory = (
  category: Omit<Category, "id" | "createdAt">,
  currentUserId: string,
  currentUserName: string,
  currentUserRole: Role | string
) => categoriesRepository.add(category, actorOf(currentUserId, currentUserName, currentUserRole));

// --- ÜRÜNLER ---
export const getProducts = (): Promise<Product[]> => productsRepository.getAll();

export const addProduct = (
  product: Omit<Product, "id" | "createdAt">,
  currentUserId: string,
  currentUserName: string,
  currentUserRole: Role | string
) => productsRepository.add(product, actorOf(currentUserId, currentUserName, currentUserRole));

export const updateProduct = (
  productId: string,
  updatedFields: Partial<Product>,
  currentUserId: string,
  currentUserName: string,
  currentUserRole: Role | string
) => productsRepository.update(productId, updatedFields, actorOf(currentUserId, currentUserName, currentUserRole));

export const deleteProduct = (
  productId: string,
  currentUserId: string,
  currentUserName: string,
  currentUserRole: Role | string
) => productsRepository.remove(productId, actorOf(currentUserId, currentUserName, currentUserRole));

// --- SATIŞLAR ---
export const getSales = (role?: Role | string, userId?: string): Promise<Sale[]> =>
  salesRepository.getAll(role, userId);

export const addSale = (
  saleData: {
    salespersonId: string;
    salespersonName: string;
    customerId: string;
    customerName: string;
    customerCompany: string;
    items: SaleItem[];
    discountAmount: number;
    notes?: string;
  },
  currentUserId: string,
  currentUserName: string,
  currentUserRole: Role | string
) => salesRepository.add(saleData, actorOf(currentUserId, currentUserName, currentUserRole));

/**
 * Satış kalemlerini düzenler (muhasebe "Miktarları Düzenle" akışı).
 * Eskiden `updateSale(saleId, updatedFields, ...)` adıyla genel amaçlı bir
 * güncelleme fonksiyonuydu ve stoğu HİÇ senkronize etmiyordu. Artık
 * `salesRepository.editItems` üzerinden stok farkını da uyguluyor.
 * Geriye dönük uyumluluk için aynı çağrı imzası (updatedFields objesi)
 * korunmuştur; sadece `items` ve `discountAmount` alanları kullanılır,
 * totalAmount/taxAmount/netAmount repository tarafından yeniden hesaplanır.
 */
export const updateSale = (
  saleId: string,
  updatedFields: { items: SaleItem[]; discountAmount: number; [key: string]: unknown },
  currentUserId: string,
  currentUserName: string,
  currentUserRole: Role | string
) =>
  salesRepository.editItems(
    saleId,
    updatedFields.items,
    updatedFields.discountAmount,
    actorOf(currentUserId, currentUserName, currentUserRole)
  );

export const processApproval = (
  saleId: string,
  status: "approved" | "rejected",
  notes: string,
  isMicroProcessed: boolean,
  currentUserId: string,
  currentUserName: string,
  currentUserRole: Role | string
) =>
  salesRepository.processApproval(
    saleId,
    status,
    notes,
    isMicroProcessed,
    actorOf(currentUserId, currentUserName, currentUserRole)
  );

export const resubmitSale = (
  saleId: string,
  updatedItems: SaleItem[],
  updatedNotes: string,
  updatedDiscount: number,
  currentUserId: string,
  currentUserName: string,
  currentUserRole: Role | string
) =>
  salesRepository.resubmit(
    saleId,
    updatedItems,
    updatedNotes,
    updatedDiscount,
    actorOf(currentUserId, currentUserName, currentUserRole)
  );

// --- BİLDİRİMLER ---
export const addNotification = (
  userId: string,
  message: string,
  type: NotificationType = "info",
  meta: Partial<AppNotification> = {}
) => notificationsRepository.add(userId, message, type, meta);

export const getNotifications = (userId: string): Promise<AppNotification[]> =>
  notificationsRepository.getForUser(userId);

export const markNotificationsRead = (userId: string) => notificationsRepository.markRead(userId);

// --- YEDEKLEME ---
export const exportBackupData = (): string => _exportBackupData();
export const importBackupData = (jsonString: string): boolean => _importBackupData(jsonString);

// --- DUYURULAR ---
export const getAnnouncements = (): Promise<Announcement[]> => announcementsRepository.getAll();

export const addAnnouncement = (
  text: string,
  currentUserId: string,
  currentUserName: string,
  currentUserRole: Role | string
) => announcementsRepository.add(text, actorOf(currentUserId, currentUserName, currentUserRole));

export const deleteAnnouncement = (
  annId: string,
  currentUserId: string,
  currentUserName: string,
  currentUserRole: Role | string
) => announcementsRepository.remove(annId, actorOf(currentUserId, currentUserName, currentUserRole));

// --- ŞİRKET PROFİLİ ---
export const getCompanyProfile = (): Promise<CompanyProfile> => settingsRepository.getCompanyProfile();

export const updateCompanyProfile = (
  profileData: CompanyProfile,
  currentUserId: string,
  currentUserName: string,
  currentUserRole: Role | string
) => settingsRepository.updateCompanyProfile(profileData, actorOf(currentUserId, currentUserName, currentUserRole));

// --- FİREBASE SEED (Login.jsx tarafından kullanılıyor) ---
export { isDatabaseInitialized, initializeFirebaseDatabase } from "./seed";
