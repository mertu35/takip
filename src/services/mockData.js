// Takip Sistemi - Yerel Simülasyon (Mock) Veri Tabanı Başlangıç Verileri

export const INITIAL_USERS = [
  {
    uid: "mock-sysadmin-id",
    email: "sysadmin@takip.com",
    displayName: "Ahmet Sistem Yöneticisi",
    role: "sysadmin",
    createdAt: new Date().toISOString()
  },
  {
    uid: "mock-admin-id",
    email: "admin@takip.com",
    displayName: "Ömer Yönetici (Patron)",
    role: "admin",
    createdAt: new Date().toISOString()
  },
  {
    uid: "mock-sales-id",
    email: "satis@takip.com",
    displayName: "Ali Satışçı",
    role: "sales",
    createdAt: new Date().toISOString()
  },
  {
    uid: "mock-accounting-id",
    email: "muhasebe@takip.com",
    displayName: "Canan Muhasebeci",
    role: "accounting",
    createdAt: new Date().toISOString()
  }
];

export const INITIAL_CATEGORIES = [
  { id: "cat-1", name: "Ofis Malzemeleri", description: "Klasörler, kağıtlar ve masaüstü gereçler", createdAt: new Date().toISOString() },
  { id: "cat-2", name: "Elektronik", description: "Bilgisayarlar, çevre birimleri ve telefonlar", createdAt: new Date().toISOString() },
  { id: "cat-3", name: "Gıda & Tüketim", description: "Çay, kahve, temizlik ürünleri vb.", createdAt: new Date().toISOString() },
  { id: "cat-4", name: "Mobilya", description: "Çalışma masaları, sandalyeler ve dolaplar", createdAt: new Date().toISOString() }
];

export const INITIAL_PRODUCTS = [
  {
    id: "prod-1",
    code: "OFIS-001",
    name: "A4 Fotokopi Kağıdı (80gr)",
    categoryId: "cat-1",
    categoryName: "Ofis Malzemeleri",
    price: 180,
    stock: 75,
    criticalStock: 20,
    unit: "Adet",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-2",
    code: "OFIS-002",
    name: "Pilot Kalem (Mavi)",
    categoryId: "cat-1",
    categoryName: "Ofis Malzemeleri",
    price: 35,
    stock: 12,
    criticalStock: 25, // Kritik stokta! (12 < 25)
    unit: "Adet",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-3",
    code: "ELK-001",
    name: "Kablosuz Optik Mouse",
    categoryId: "cat-2",
    categoryName: "Elektronik",
    price: 450,
    stock: 15,
    criticalStock: 5,
    unit: "Adet",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-4",
    code: "ELK-002",
    name: "24\" LED Monitör",
    categoryId: "cat-2",
    categoryName: "Elektronik",
    price: 4200,
    stock: 4,
    criticalStock: 5, // Kritik stokta! (4 < 5)
    unit: "Adet",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-5",
    code: "GIDA-001",
    name: "Rize Çayı (1 Kg)",
    categoryId: "cat-3",
    categoryName: "Gıda & Tüketim",
    price: 220,
    stock: 3,
    criticalStock: 10, // Kritik stokta! (3 < 10)
    unit: "Adet",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-6",
    code: "MOB-001",
    name: "Ergonomik Çalışma Sandalyesi",
    categoryId: "cat-4",
    categoryName: "Mobilya",
    price: 2950,
    stock: 18,
    criticalStock: 4,
    unit: "Adet",
    createdAt: new Date().toISOString()
  }
];

export const INITIAL_CUSTOMERS = [
  {
    id: "cust-1",
    name: "Ahmet Yılmaz",
    company: "Yılmaz İnşaat Taahhüt Ltd. Şti.",
    phone: "0532 111 22 33",
    email: "ahmet@yilmazinsaat.com",
    taxOffice: "Maslak",
    taxNumber: "9876543210",
    address: "Büyükdere Cad. No:123/4 Sarıyer/İstanbul",
    createdAt: new Date().toISOString()
  },
  {
    id: "cust-2",
    name: "Mehmet Kaya",
    company: "Kaya Teknoloji ve Bilişim San. Tic. A.Ş.",
    phone: "0212 555 44 33",
    email: "satinalma@kayatech.com",
    taxOffice: "Kadıköy",
    taxNumber: "1234567890",
    address: "Atatürk Cad. No:45 Kat:3 Kadıköy/İstanbul",
    createdAt: new Date().toISOString()
  },
  {
    id: "cust-3",
    name: "Ayşe Demir",
    company: "Demir Lojistik Hizmetleri A.Ş.",
    phone: "0544 333 22 11",
    email: "ademir@demirlojistik.com",
    taxOffice: "Tuzla",
    taxNumber: "5556667778",
    address: "Orhanlı Mah. Lojistik Sok. No:12 Tuzla/İstanbul",
    createdAt: new Date().toISOString()
  }
];

// Satış geçmişi
const d1 = new Date();
d1.setDate(d1.getDate() - 3);
const d2 = new Date();
d2.setDate(d2.getDate() - 1);
const d3 = new Date(); // Bugün

export const INITIAL_SALES = [
  {
    id: "sale-1",
    salespersonId: "mock-sales-id",
    salespersonName: "Ali Satışçı",
    customerId: "cust-1",
    customerName: "Ahmet Yılmaz",
    customerCompany: "Yılmaz İnşaat Taahhüt Ltd. Şti.",
    date: d1.toISOString(),
    status: "approved",
    totalAmount: 14750,
    taxAmount: 2950,
    discountAmount: 750,
    netAmount: 16950,
    notes: "İnşaat ofisi için mobilya ve kırtasiye malzemeleri teslim edildi.",
    receiptNo: "TS-2026-00001",
    createdAt: d1.toISOString(),
    accountingProcessed: true,
    processedAt: d2.toISOString(),
    processedBy: "Canan Muhasebeci",
    items: [
      { productId: "prod-6", productName: "Ergonomik Çalışma Sandalyesi", productCode: "MOB-001", quantity: 4, price: 2950, taxRate: 20, total: 11800 },
      { productId: "prod-1", productName: "A4 Fotokopi Kağıdı (80gr)", productCode: "OFIS-001", quantity: 10, price: 180, taxRate: 20, total: 1800 },
      { productId: "prod-3", productName: "Kablosuz Optik Mouse", productCode: "ELK-001", quantity: 2, price: 450, taxRate: 20, total: 900 }
    ]
  },
  {
    id: "sale-2",
    salespersonId: "mock-sales-id",
    salespersonName: "Ali Satışçı",
    customerId: "cust-2",
    customerName: "Mehmet Kaya",
    customerCompany: "Kaya Teknoloji ve Bilişim San. Tic. A.Ş.",
    date: d2.toISOString(),
    status: "pending_accounting",
    totalAmount: 5100,
    taxAmount: 1020,
    discountAmount: 0,
    netAmount: 6120,
    notes: "Monitör ve mouse satışı. Acil onay bekliyor.",
    receiptNo: "TS-2026-00002",
    createdAt: d2.toISOString(),
    accountingProcessed: false,
    processedAt: null,
    processedBy: null,
    items: [
      { productId: "prod-4", productName: "24\" LED Monitör", productCode: "ELK-002", quantity: 1, price: 4200, taxRate: 20, total: 4200 },
      { productId: "prod-3", productName: "Kablosuz Optik Mouse", productCode: "ELK-001", quantity: 2, price: 450, taxRate: 20, total: 900 }
    ]
  },
  {
    id: "sale-3",
    salespersonId: "mock-sales-id",
    salespersonName: "Ali Satışçı",
    customerId: "cust-3",
    customerName: "Ayşe Demir",
    customerCompany: "Demir Lojistik Hizmetleri A.Ş.",
    date: d3.toISOString(),
    status: "pending_accounting",
    totalAmount: 1260,
    taxAmount: 252,
    discountAmount: 60,
    netAmount: 1452,
    notes: "Lojistik deposu mutfak ve ofis giderleri.",
    receiptNo: "TS-2026-00003",
    createdAt: d3.toISOString(),
    accountingProcessed: false,
    processedAt: null,
    processedBy: null,
    items: [
      { productId: "prod-5", productName: "Rize Çayı (1 Kg)", productCode: "GIDA-001", quantity: 3, price: 220, taxRate: 20, total: 660 },
      { productId: "prod-1", productName: "A4 Fotokopi Kağıdı (80gr)", productCode: "OFIS-001", quantity: 3, price: 180, taxRate: 20, total: 540 },
      { productId: "prod-2", productName: "Pilot Kalem (Mavi)", productCode: "OFIS-002", quantity: 2, price: 35, taxRate: 20, total: 70 }
    ]
  }
];

export const INITIAL_LOGS = [
  {
    id: "log-1",
    userId: "mock-admin-id",
    userName: "Ömer Yönetici (Patron)",
    userRole: "admin",
    action: "ADD_PRODUCT",
    details: "Ergonomik Çalışma Sandalyesi (MOB-001) stok kartı oluşturuldu.",
    createdAt: d1.toISOString()
  },
  {
    id: "log-2",
    userId: "mock-sales-id",
    userName: "Ali Satışçı",
    userRole: "sales",
    action: "CREATE_SALE",
    details: "TS-2026-00001 numaralı satış oluşturuldu (Tutar: 16,950.00 TL).",
    createdAt: d1.toISOString()
  },
  {
    id: "log-3",
    userId: "mock-accounting-id",
    userName: "Canan Muhasebeci",
    userRole: "accounting",
    action: "APPROVE_SALE",
    details: "TS-2026-00001 numaralı satış onaylandı ve Mikro sistemine işlendi.",
    createdAt: d2.toISOString()
  }
];
