# Takip - Satış, Muhasebe Onay ve Yönetim Takip Sistemi

TAKİP, küçük ve orta ölçekli işletmeler (KOBİ) için geliştirilmiş, satış süreçlerini, muhasebe onay mekanizmalarını ve stok hareketlerini tek bir platformdan yönetmeyi sağlayan profesyonel bir web otomasyonudur.

---

## 1. Sistem Mimarisi ve Teknolojiler

Sistem, modern SPA (Single Page Application) standartlarına göre tasarlanmış hibrid bir veritabanı mimarisi kullanır.

- **Frontend**: React 19 (Vite tabanlı, HMR destekli)
- **Tasarım & Arayüz**: Vanilla CSS (CSS Variables, Açık/Karanlık tema geçişi, Cam Morfizmleri, Responsive Tasarım)
- **İkon Seti**: Lucide React
- **Raporlama**: XLSX (Excel dışa aktarımı için)
- **Veritabanı ve Auth**: Firebase (Authentication, Firestore, Storage, Hosting) veya Firebase ayarları olmadığında **%100 Yerel Simülasyon (LocalStorage) Modu**.

---

## 2. Klasör Yapısı

```
/
├── public/                 # Statik varlıklar (Favicon vb.)
├── src/
│   ├── assets/             # CSS stilleri
│   ├── components/         # Ortak UI Bileşenleri
│   │   ├── Layout.jsx         # Sol Sidebar ve Header içeren ortak düzen
│   │   ├── Sidebar.jsx        # Rol bazlı menü, tema anahtarı ve çıkış düğmesi
│   │   └── ProtectedRoute.jsx # Rol tabanlı rota koruma mekanizması
│   ├── context/            # React Global State Yönetimleri
│   │   ├── AuthContext.jsx    # Oturum durumu, giriş/çıkış ve şifre sıfırlama
│   │   └── ThemeContext.jsx   # Açık/Karanlık tema yönetimi
│   ├── pages/              # Sayfa Bileşenleri
│   │   ├── Login.jsx          # Şık giriş ekranı (Demo hızlı giriş rozetleri ile)
│   │   ├── Dashboard.jsx      # SVG grafikli, ciro kartlı yönetici paneli
│   │   ├── Sales.jsx          # Sepetli satış paneli, yeni müşteri ekleme modalı
│   │   ├── Accounting.jsx     # Onay/Red, miktar düzenleme ve "Mikro'ya işlendi" butonu
│   │   ├── Inventory.jsx      # Ürün/Kategori CRUD ve kritik stok uyarıları
│   │   ├── Logs.jsx           # Kronolojik sistem işlem günlükleri (Audit Trail)
│   │   └── Settings.jsx       # Personel kayıt formu, Excel çıktı ve JSON yedek/geri yükleme
│   ├── services/           # Servis Katmanı
│   │   ├── firebase.js        # Firebase SDK ilklendirme ve otomatik simülasyon kontrolü
│   │   ├── auth.js            # Firebase & Mock kimlik doğrulama köprüsü
│   │   ├── db.js              # Firestore & LocalStorage veritabanı köprüsü
│   │   └── mockData.js        # İlk açılış için varsayılan ürün, müşteri, satış ve log verileri
│   ├── App.css
│   ├── App.jsx             # React Router rotalama ve context sağlayıcıları
│   ├── index.css           # Küresel stil şablonu ve CSS Değişkenleri
│   └── main.jsx            # Giriş noktası
├── firebase.json           # Firebase Hosting ve Yönlendirme ayarları
├── firestore.rules         # Rol tabanlı Firestore güvenlik kuralları
├── storage.rules           # Firebase Storage güvenlik kuralları
├── package.json            # Proje bağımlılıkları
└── README.md               # Detaylı kullanım ve kurulum rehberi
```

---

## 3. Firestore Veri Modeli

Firestore koleksiyonları ve veritabanı şeması aşağıdaki şekildedir:

### `users` Koleksiyonu
- `uid` (string): Firebase Auth UID
- `email` (string): Kullanıcı e-postası
- `displayName` (string): Personel adı
- `role` (string): `admin` (Patron), `accounting` (Muhasebeci), `sales` (Satışçı)
- `createdAt` (string/timestamp): Kayıt tarihi

### `customers` Koleksiyonu
- `id` (string): Benzersiz kimlik
- `name` (string): Ad Soyad
- `company` (string): Firma Unvanı
- `phone` (string): İletişim numarası
- `email` (string): E-posta adresi
- `taxOffice` (string): Vergi dairesi
- `taxNumber` (string): Vergi numarası
- `address` (string): Açık adres
- `createdAt` (string/timestamp)

### `products` Koleksiyonu
- `id` (string): Benzersiz kimlik
- `code` (string): Barkod/SKU kodu
- `name` (string): Ürün ismi
- `categoryId` (string): Kategori referansı
- `categoryName` (string): Kategori ismi (sorgu optimizasyonu için)
- `price` (number): Birim satış fiyatı (KDV hariç)
- `stock` (number): Mevcut envanter miktarı
- `criticalStock` (number): Kritik stok uyarı eşiği
- `unit` (string): `Adet`, `Kg`, `Litre`, `Metre`, `Kutu`
- `createdAt` (string/timestamp)

### `categories` Koleksiyonu
- `id` (string)
- `name` (string)
- `description` (string)
- `createdAt` (string/timestamp)

### `sales` Koleksiyonu
- `id` (string): Satış ID
- `salespersonId` (string): Satışı yapan kullanıcı ID
- `salespersonName` (string): Satışçı adı
- `customerId` (string): Müşteri ID
- `customerName` (string): Müşteri adı
- `customerCompany` (string): Firma adı
- `date` (string/timestamp): Satış tarihi
- `status` (string): `pending_accounting` (Onay bekliyor), `approved` (Onaylandı), `rejected` (Reddedildi)
- `totalAmount` (number): Ara Toplam (KDV hariç)
- `taxAmount` (number): Toplam KDV tutarı (%20)
- `discountAmount` (number): Yapılan indirim tutarı
- `netAmount` (number): Genel Toplam (Ödenecek net tutar)
- `notes` (string): Sipariş notları
- `receiptNo` (string): Benzersiz Fiş Numarası (`TS-YYYY-XXXXX` formatında otomatik artan)
- `accountingProcessed` (boolean): Mikro muhasebeye işlendi mi?
- `processedAt` (string/null): Onaylama/reddedilme zamanı
- `processedBy` (string/null): Onaylayan/reddeden muhasebeci adı
- `items` (array): Satış kalemleri dizisi
  - `productId` (string), `productName` (string), `productCode` (string), `quantity` (number), `price` (number), `taxRate` (number), `total` (number)

### `logs` Koleksiyonu (Audit Trail)
- `id` (string)
- `userId` (string): İşlemi gerçekleştiren personel ID
- `userName` (string): Personel adı
- `userRole` (string): Personel rolü
- `action` (string): `CREATE_SALE`, `APPROVE_SALE`, `REJECT_SALE`, `ADD_PRODUCT`, `UPDATE_PRODUCT`, `DELETE_PRODUCT`, `ADD_CUSTOMER` vb.
- `details` (string): İşlemin detaylı Türkçe açıklaması
- `createdAt` (string/timestamp)

---

## 4. Kurulum Rehberi

### Gereksinimler
- Node.js (v18+)
- npm (v9+)

### Adım 1: Projeyi Kopyalayın ve Bağımlılıkları Yükleyin
Proje klasörünün içerisinde aşağıdaki komutu çalıştırarak bağımlılıkları yükleyin:
```bash
npm install
```

### Adım 2: Yerel Geliştirme Sunucusunu Başlatın
Uygulamayı yerel test modunda çalıştırmak için:
```bash
npm run dev
```
Uygulama varsayılan olarak tarayıcınızda açılacaktır (Genellikle `http://localhost:5173`).
*Not: Firebase ayarları yapılmadığında sistem otomatik olarak LocalStorage tabanlı yerel veri simülasyonunu başlatır. Giriş ekranındaki hazır butonları tıklayarak anında test yapabilirsiniz.*

### Adım 3: Firebase Bağlantısını Kurun (Canlı Mod için)
Eğer sistemi canlı Firebase sunucunuza bağlamak isterseniz:
1. Proje ana dizininde `.env` (veya `.env.local`) adında bir dosya oluşturun.
2. Aşağıdaki şablonu kendi Firebase projenizin SDK parametrelerine göre doldurun:
```env
VITE_FIREBASE_API_KEY=AIzaSyA1...
VITE_FIREBASE_AUTH_DOMAIN=projeniz.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=projeniz
VITE_FIREBASE_STORAGE_BUCKET=projeniz.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456:web:123456
```
3. Uygulamayı yeniden başlatın (`npm run dev`). Sistem otomatik olarak `.env` içindeki anahtarları algılayıp Firebase'e bağlanacaktır.

---

## 5. Firebase Canlıya Yayınlama Rehberi

### Adım 1: Firebase CLI Kurulumu ve Giriş
1. Bilgisayarınızda Firebase araçlarının kurulu olduğundan emin olun:
```bash
npm install -g firebase-tools
```
2. Firebase hesabınıza terminalden giriş yapın:
```bash
firebase login
```

### Adım 2: Firebase Projesini Seçin
Projeyi Firebase ile eşleştirmek için proje kök dizininde çalıştırın:
```bash
firebase init
```
- Listeden **Hosting** ve **Firestore** (gerekiyorsa **Storage**) seçin.
- Projeniz için mevcut bir Firebase projesini (Use an existing project) seçin.
- Sorulan soruları şu şekilde yanıtlayın:
  - *What do you want to use as your public directory?* **dist**
  - *Configure as a single-page app (rewrite all urls to /index.html)?* **Yes**
  - *Set up automatic builds and deploys with GitHub?* **No**
  - *File firestore.rules already exists. Overwrite?* **No** (Mevcut olanı koruyun)
  - *File storage.rules already exists. Overwrite?* **No** (Mevcut olanı koruyun)

### Adım 3: Projeyi Derleyin ve Yayına Alın
1. React uygulamasını Vite ile derleyin:
```bash
npm run build
```
2. Derlenen dosyaları ve güvenlik kurallarını tek komutla Firebase'e yükleyin:
```bash
firebase deploy
```
İşlem tamamlandığında size canlı sitenizin URL'i verilecektir (Örn: `https://projeniz.web.app`).

---

## 6. Test Senaryoları (Adım Adım Test Rehberi)

Sistemin kararlılığını test etmek için aşağıdaki 3 farklı rol senaryosunu sırasıyla uygulayabilirsiniz:

### Senaryo A: Satışçı (Ali Satışçı)
1. Giriş ekranındaki **"Satış Temsilcisi Girişi"** düğmesine tıklayarak giriş yapın.
2. Sol menüden **Satış Paneli**'ne gidin.
3. **Yeni Müşteri Ekle** butonuna tıklayarak "Maslak Vergi Dairesi, 1234567890 Vergi Numaralı Test A.Ş." bilgilerini girip kaydedin. Yeni müşteri otomatik seçilecektir.
4. Sağ paneldeki ürün listesinden **"Kablosuz Optik Mouse"** ürününü arayın. Miktar olarak `2` yazıp sepete ekleyin.
5. İndirim (İskonto) kutusuna `50` yazın. Sistem KDV dahil net toplam tutardan 50 TL iskonto düşecektir.
6. Sipariş notuna *"İlk test siparişidir."* yazıp **"Satış Kaydını Gönder"** butonuna basın.
7. Ekrana fiş önizleme modalı açılacaktır. **"Yazdır / PDF Kaydet"** butonuna basarak fişin PDF çıktısını alın veya tarayıcıda inceleyin. Modalı kapatın.
8. Sol menüden **"Ürün & Stok"** sayfasına giderek "Kablosuz Optik Mouse" stoğunun 2 adet düştüğünü teyit edin.
9. Çıkış yapın.

### Senaryo B: Muhasebeci (Canan Muhasebeci)
> **İş Kuralı:** Muhasebeci depoda çalışmaz. Stok düşürme işlemi **sadece onay (approved) anında** yapılır. Reddedilen satışlarda stok hiç düşmez (çünkü addSale'de düşürülmüyor). Miktar değişikliği yalnızca evrak üzerinde yapılır, stoğu etkilemez.

1. Giriş ekranındaki **"Muhasebeci Girişi"** düğmesine tıklayarak giriş yapın.
2. Karşınıza **Bekleyen Onaylar** listesi gelecektir. Satışçının oluşturduğu en son fişin durumunu inceleyin.
3. Satır sonundaki **"İncele"** butonuna tıklayın. Satış detay penceresi açılacaktır.
4. **"Miktarları Düzenle"** seçeneğini kullanarak satışı yapılan ürün miktarını `2` yerine `3` olarak değiştirin ve kaydedin. Tutarların otomatik olarak yeniden hesaplandığını gözlemleyin. **Stok henüz değişmedi** (stok onay anında düşecek).
5. **"Mikro Muhasebe programına işlendi"** kutusunu işaretleyin.
6. Onay/İşlem notuna *"Mikro ERP sistemine 1024 no'lu mahsup fişiyle işlenmiştir."* yazıp **"Onayla"** butonuna basın. **Onay anında ilgili ürünlerin stokları otomatik düşer** (transaction'lı, atomik işlem).
7. Sayfadaki **"Arşivlenmiş Kayıtlar"** sekmesine tıklayarak kaydın başarıyla arşivlendiğini ve "Mikro'ya İşlendi" ifadesinin yeşil renkle belirtildiğini teyit edin.
8. Çıkış yapın.

> **Not:** Eğer onay anında stoğun yeterli olmadığı anlaşılırsa (ör. satıcı ile muhasebeci arasında geçen sürede başka bir hareket olduysa), onaylama başarısız olur ve satış hâlâ "Bekleyen Onaylar"da kalır. Stok veya durum değişmez, muhasebeci depoyla konuşup tekrar deneyebilir. Aynı satışı iki kez onaylamaya çalışmak da idempotent koruma sayesinde hata verir.

### Senaryo C: Yönetici / Patron (Ömer Yönetici)
1. Giriş ekranındaki **"Yönetici (Patron) Girişi"** düğmesine tıklayarak giriş yapın.
2. **Dashboard** ekranında; toplam ciro kartındaki artışı, SVG çizgi grafiğindeki günlük satış trendini ve Ali Satışçı'nın performans çubuğunun yükseldiğini gözlemleyin.
3. Sol menüden **"İşlem Logları"** sayfasına gidin. Satışçının fiş oluşturması, muhasebecinin miktar güncellemesi ve faturayı onaylamasına dair tüm hareketlerin kronolojik olarak Türkçe detaylarla loglandığını teyit edin.
4. Sol menüden **"Sistem Ayarları"** sayfasına gidin.
   - **Excel Raporu İndir** düğmesine basarak sistemdeki tüm tabloları tek bir `.xlsx` dosyasında indirin.
   - **Yedek Dosyası İndir** düğmesine basarak sistem durumunu JSON olarak indirin.
5. Menüden **"Ürün & Stok"** sayfasına gidin. Ürünlerin stok durumlarını ve kritik limitlerin (stok limitin altına düştüğünde kırmızı renkle uyarı vermesi) çalıştığını kontrol edin.
6. Üst kısımdan **"Yeni Ürün Ekle"** butonunu kullanarak yeni ürün tanımlayın.

---

## 7. İleride Yapılacak Mikro API Entegrasyonu Mimari Önerisi

Uygulamanın `src/services/db.js` dosyasında bulunan `processApproval` fonksiyonu, gelecekteki API entegrasyonu için ideal bir kanca (hook) sunmaktadır.

Mikro Yazılım programına doğrudan API entegrasyonu yapmak için aşağıdaki mimari yol haritası uygulanmalıdır:

1. **Firebase Functions Katmanı**: Firebase projesinde Node.js tabanlı bir Cloud Function tetikleyicisi yazılmalıdır.
2. **Tetikleme (Trigger)**: Muhasebeci "Onayla" butonuna bastığında Firestore'daki satış dökümanının `status` alanı `"approved"`, `accountingProcessed` alanı `true` olarak güncellenir.
3. **Cloud Function Entegrasyonu**: Firestore update tetikleyicisi (`onDocumentUpdated`) bu değişikliği yakalar:
   ```javascript
   exports.sendToMicroERP = onDocumentUpdated("sales/{saleId}", async (event) => {
     const newValue = event.data.after.data();
     const previousValue = event.data.before.data();
     
     // Sadece onaylandığında ve Mikro'ya işlenmek istendiğinde tetikle
     if (newValue.status === "approved" && newValue.accountingProcessed && !previousValue.accountingProcessed) {
       const microAPIUrl = "https://firma-mikro-servisi.com/api/v1/invoice";
       const apiKey = process.env.MICRO_API_KEY;
       
       // Satış ve Müşteri verilerini Mikro API şemasına göre haritalandır (Map)
       const payload = {
         cariKod: newValue.customerTaxNumber,
         evrakSeri: "TS",
         tarih: newValue.date,
         satirlar: newValue.items.map(item => ({
           stokKod: item.productCode,
           miktar: item.quantity,
           fiyat: item.price,
           kdv: item.taxRate
         }))
       };
       
       // Mikro API'sine POST isteği gönder
       await axios.post(microAPIUrl, payload, { headers: { Authorization: `Bearer ${apiKey}` } });
     }
   });
   ```
4. Bu servis-merkezli yaklaşım sayesinde frontend uygulamanız hiçbir şekilde Mikro veritabanı şifrelerini veya sunucu bilgilerini barındırmaz, güvenlik maksimum düzeyde kalır.
