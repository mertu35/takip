# 📋 Özkon Takip - Geliştirme Yol Haritası ve Yapılacaklar Listesi (ROADMAP)

Bu doküman, **Özkon Yapı & Çelik Takip Sistemi** için planlanan sonraki aşama özelliklerini, öncelik sırasını ve teknik gereksinimlerini içerir.

---

## ⚡ 1. Aşama: İş Akışı & Hızlandırma (Workflow & Efficiency) *(TAMAMLANDI ✅)*
- [x] **Toplu Satış Onayı (Muhasebe):**
  - Muhasebeci ekranında bekleyen fişler için çoklu seçim kutusu (checkbox) ve "Seçilenleri Toplu Onayla" butonu eklendi.
  - Yoğun günlerde düşük riskli veya standart limit altındaki fişleri tek tıkla onaylama ve Mikro'ya işlendi işaretleme imkânı sağlandı.
- [x] **Özel Tarih Aralığı Filtresi (Dashboard & Muhasebe):**
  - "Bugün / Bu Hafta / Bu Ay" filtrelerine ek olarak "Başlangıç - Bitiş Tarihi" seçebileceğimiz dinamik tarih aralığı filtresi (Dashboard & Muhasebe) eklendi.
- [x] **Cari Bazlı Sabit İskonto & Özel Fiyat:**
  - Müşteri kartında müşteriye özel sabit iskonto oranı (%) tanımlama eklendi.
  - Satış ekranında müşteri seçildiğinde bu oranın otomatik olarak sepete indirim olarak yansıması ve tek tıkla yeniden uygulama butonu sağlandı.
- [x] **Geçmiş Satışı Tekrar Oluştur (Şablon Sipariş):**
  - Müşteri detay geçmişinde ve Satış ekranı geçmiş tablosunda "Tekrarla / Sepete Aktar" (RotateCcw) butonu eklendi.
  - Sürekli aynı ürünleri alan müşteriler için sepetin tek tıkla otomatik doldurulması ve güncel fiyatlarla senkronize edilmesi sağlandı.
- [x] **Profesyonel Boş Durumlar (Empty States) & Skeleton:**
  - Reusable `EmptyState` ve `SkeletonTable` bileşenleri tüm tablolara entegre edildi.
- [x] **Sayı ve Para Formatlama Tutarlılığı:**
  - Tüm sayfalarda tutarlı para birimi formatı (`formatCurrency`: `1.250,50 ₺`) ve tarih formatları (`formatDate`, `formatDateTime`) devreye alındı.

---

## 💳 2. Aşama: Müşteri Cari Hesap & Tahsilat Yönetimi *(TAMAMLANDI ✅)*
- [x] **Satışta Ödeme Tipi Seçimi:**
  - Satış oluştururken ödeme yöntemi: *Açık Hesap (Cari / Veresiye)*, *Nakit*, *Kredi Kartı / POS*, *Banka Havalesi / EFT*, *Çek / Senet*.
  - Çek seçildiğinde Çek/Senet numarası ve vade tarihi tanımlama.
  - Satış fişinde ve muhasebe onay ekranında ödeme yönteminin net gösterilmesi.
- [x] **Müşteri Cari Bakiye Takibi:**
  - Müşteri kartında ve tablosunda anlık borç/alacak bakiyesi göstergesi (Borçlu: Kırmızı rozet / Dengeli / Alacaklı).
  - Satış onaylandığında açık hesap ve vadeli satışların müşteri cari borcuna otomatik yansıması.
- [x] **Tahsilat / Ödeme Girişi & Tahsilat Makbuzu:**
  - Müşteri kartından ve tablosundan tek tıkla "Tahsilat Al" modalı (Nakit, Kart, Havale, Çek).
  - Tahsilat yapıldığında müşteri borcundan anında düşülmesi ve otomatik makbuz no (`THS-2026-00001`).
  - Antetli, teslim alan / teslim eden imzalı A5 boyutunda profesyonel **Tahsilat Makbuzu PDF** çıktısı.
- [x] **Cari Hesap Ekstresi (PDF & Excel):**
  - Müşteri detayında satışlar (Borç) ve tahsilatların (Alacak) kronolojik yürüyen bakiye ile listelenmesi.
  - İki tarih arası dinamik filtreleme.
  - Tek tıkla **Cari Hesap Ekstresi PDF İndir** (`generateStatementPDF`) ve **Excel'e Aktar** (`.xlsx`).
- [x] **Dashboard Finansal Özet:**
  - Toplam tahsilat ve toplam piyasa alacağı (bekleyen cari borç) KPI kartları.

---

## 🎨 3. Aşama: Tasarım, Görsellik & Mobil Deneyim (UI & Polish) *(TAMAMLANDI ✅)*
- [x] **Profesyonel Boş Durumlar (Empty States):**
  - "Kayıt bulunamadı" düz yazıları yerine ilgili konuya özel ikon, açıklayıcı metin ve hızlı işlem butonu (Örn: Sepet Boş, Müşteri Bulunamadı, Bekleyen Onay Yok vb.).
- [x] **Skeleton Loading Standardizasyonu:**
  - Düz "Yükleniyor..." yazıları yerine kart, form ve tabloların hatlarını simüle eden modern, hafif parlayan skeleton yükleme animasyonları (Dashboard, Satış POS, Müşteriler, Envanter, Muhasebe, Loglar, Ayarlar).
- [x] **Sayı ve Para Formatlama Tutarlılığı:**
  - Tüm sayfalarda tutarlı para birimi formatı (`1.250,50 ₺`, standart `formatCurrency` utility fonksiyonu ile her yerde aynı format).
- [x] **Mobil Sepet & Hızlı Adet (`+` / `-`) Butonları:**
  - Satış ekranında sepetteki ürünler için tek tıkla miktar artırma/azaltma (`+` / `-`) butonları, stok limit kontrolleri ve ferah mobil sepet optimizasyonu.

---

## 📲 4. Aşama: WhatsApp & E-Posta Entegrasyonu *(Yüksek Öncelik)*
- [ ] **WhatsApp ile Bilgi Fişi Gönderme:**
  - Satış tamamlandığında "📱 WhatsApp ile Gönder" butonu.
  - Müşterinin kayıtlı telefon numarasına tek tıkla kurumsal sipariş özeti ve fiş detay linki gönderimi (`https://wa.me/...`).
- [ ] **WhatsApp ile Fatura / Ekstre Paylaşımı:**
  - Müşteri ekstresini veya bilgi fişi PDF'ini WhatsApp üzerinden doğrudan müşteriye iletme.

---

## 📦 5. Aşama: Depo Sayım & Stok Düzeltme Modülü *(Orta Öncelik)*
- [ ] **Hızlı Depo Sayım Ekranı:**
  - Mobil cihazdan veya barkod okuyucuyla rafları gezerek seri barkod okutma modu (her okutmada sayacı +1 artırma).
- [ ] **Sayım Karşılaştırma & Sayım Farkı:**
  - Sistemdeki teorik stok ile raftaki fiili sayımı yan yana listeleme.
  - Artı / eksi çıkan farkların maliyet analizi.
- [ ] **Tek Tıkla Stok Eşitleme (Sayım Fişi):**
  - Yönetici onayı ile sistem stoğunu sayım sonucuna eşitleme ve otomatik log kaydı oluşturma.

---

## 👑 6. Aşama: Gelişmiş Patron & Yönetici Raporları *(TAMAMLANDI ✅)*
- [x] **Patron Finansal KPI Şeridi:**
  - Dönem Net Cirosu, Brüt Kâr & Marj (%), Dönem Tahsilatı, Piyasadaki Alacak (Cari Borç) ve Depodaki Stok Maliyet Sermayesi metrikleri.
- [x] **Satışçı Performans & Prim Masası:**
  - Satışçı ciro ve kâr katkısı liderlik podyumu (🥇 1., 🥈 2., 🥉 3. madalyalar).
  - Ayarlanabilir dinamik prim oranı (%1..%10) ve anında hesaplanan prim tutarları.
- [x] **Ürün Kârlılık & Ölü Stok Alarmı (Depoda Yatan Para):**
  - En çok satan ve kâr getiren Top 10 ürün analizi.
  - Seçilen dönem boyunca hiç satılmamış ürünler ve depoda kilitlenen sermaye tutarı alarmı.
- [x] **Nakit Akışı & Çek Vade Takvimi:**
  - Kasa, Banka, POS ve Çek tahsilat dağılımı.
  - Vadesi geçmiş ve yaklaşan müşteri çeklerinin renkli gün sayacı ve takip tablosu.
- [x] **Dışa Aktarma & Raporlama (PDF & Excel):**
  - Tek tıkla antetli **Patron Yönetici Özeti PDF İndir** (`generateExecutivePDF`) ve çok sayfalı detaylı **Excel İndir** (`.xlsx`).

---

## ⚡ 7. Aşama: Hızlı POS Terminali & Kısayollar *(TAMAMLANDI ✅)*
- [x] **Favori / Hızlı Ürün Butonları (Hızlı Satış Izgarası):**
  - Satış ekranında en çok satılan veya popüler ürünleri kategori filtre sekmeleriyle buton olarak gösterme (tek tıkla sepete ekleme, tekrar tıklandığında +1 artırma).
- [x] **Klavye Kısayolları (POS Mode & Global Keydown):**
  - `F1` / `?`: Klavye Kısayolları Yardım Modalı.
  - `F2`: Barkod / Ürün arama alanına anında odaklan (focus).
  - `F4`: Müşteri seçimi alanına odaklan.
  - `F8`: İndirim / İskonto alanına odaklan.
  - `F9` / `Ctrl+Enter`: Satış kaydını onaya gönder & tamamla.
  - `ESC`: Açık modalları kapat / aramayı temizle.
- [x] **Seri Barkod Okuyucu Modu:**
  - Barkod okutulduğunda veya arama alanında Enter'a basıldığında ürünü anında sepete ekleme ve arama alanını bir sonraki okumaya hazır sıfırlama.
- [x] **Ekran Başı Kısayol Bilgi Şeridi:**
  - Satış ekranının en üstünde kısayol tuşlarını gösteren etkileşimli rozet çubuğu.
- [x] **Hızlı Sepeti Boşaltma:**
  - Tek tıkla onaylı sepeti temizleme butonu.

---

## 🔔 8. Aşama: Akıllı Bildirimler & Uyarılar *(Otomasyon)*
- [ ] **Kritik Stok Uyarısı:**
  - Stok kritik limitin altına indiğinde yönetici paneline ve zil simgesine anlık bildirim düşmesi.
- [ ] **Otomatik Tedarik Sipariş Önerisi:**
  - Tükenen ürünler için tedarikçiye verilmek üzere tek tıkla "Satın Alma Sipariş Listesi" Excel'i üretme.

---

*Son Güncelleme: 18 Ağustos 2026*  
*Özkon Yapı Takip Sistemi Proje Ekibi*
