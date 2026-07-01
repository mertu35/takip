// Takip Sistemi - Ortak Domain Tipleri
// Bu dosya, tüm servis/repository katmanı ve bileşenler tarafından paylaşılan
// veri şekillerini tanımlar. Firestore ve LocalStorage (mock) modlarının
// ikisi de aynı tiplere uymalıdır.

export type Role = "admin" | "sysadmin" | "sales" | "accounting";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  disabled?: boolean;
  createdAt?: string;
  password?: string; // Sadece mock modda kullanılır, Firebase modunda asla saklanmaz
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  price: number;
  costPrice?: number;
  taxRate?: number;
  barcode?: string;
  stock: number;
  criticalStock: number;
  unit: string;
  createdAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  company: string;
  phone?: string;
  email?: string;
  taxOffice?: string;
  taxNumber?: string;
  address?: string;
  createdAt?: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  productCode?: string;
  quantity: number;
  price: number;
  taxRate: number;
  total: number;
  unit?: string;
  costPrice?: number;
}

export type SaleStatus = "pending_accounting" | "approved" | "rejected";

export interface Sale {
  id: string;
  salespersonId: string;
  salespersonName: string;
  customerId: string;
  customerName: string;
  customerCompany: string;
  date: string;
  status: SaleStatus;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  netAmount: number;
  notes?: string;
  receiptNo: string;
  accountingProcessed: boolean;
  processedAt: string | null;
  processedBy: string | null;
  items: SaleItem[];
  resubmittedAt?: string | null;
  resubmittedBy?: string | null;
  createdAt?: string;
}

export interface LogEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: Role | string;
  action: string;
  details: string;
  createdAt: string;
}

export type NotificationType = "info" | "warning" | "success" | "error";

export interface AppNotification {
  id: string;
  userId: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  saleId?: string;
  receiptNo?: string;
}

export interface Announcement {
  id: string;
  text: string;
  active: boolean;
  createdAt: string;
}

export interface CompanyProfile {
  companyName: string;
  address: string;
  phone: string;
  fax?: string;
  taxOffice: string;
  taxNumber: string;
  updatedAt?: string;
  updatedBy?: string;
}

// Yardımcı: iş mantığı fonksiyonlarının (loglama gibi) ihtiyaç duyduğu
// çağıran-kullanıcı bilgisi. Fonksiyon imzalarını tek tek uzatmak yerine
// tek bir parametre nesnesi olarak taşınır.
export interface ActorInfo {
  currentUserId: string;
  currentUserName: string;
  currentUserRole: Role | string;
}
