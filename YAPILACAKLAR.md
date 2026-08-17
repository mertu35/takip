# 📋 Özkon Takip - Geliştirme Yol Haritası ve Yapılacaklar Listesi (ROADMAP)

Bu doküman, **Özkon Yapı & Çelik Takip Sistemi** için planlanan sonraki aşama özelliklerini, öncelik sırasını ve teknik gereksinimlerini içerir.

---

## 🚀 1. Aşama: Müşteri Cari Hesap & Tahsilat Yönetimi (Yüksek Öncelik)
- [ ] **Satışta Ödeme Tipi Seçimi:**
  - Satış oluştururken ödeme yöntemi seçimi: *Nakit*, *Kredi Kartı / POS*, *Banka Havalesi / EFT*, *Açık Hesap (Veresiye)*, *Çek / Senet*.
- [ ] **Müşteri Cari Bakiye Takibi:**
  - Müşteri profilinde güncel borç/alacak bakiyesi kartı.
  - Açık hesap satışların müşterinin cari borcuna otomatik yansıması.
- [ ] **Tahsilat / Ödeme Girişi:**
  - Müşteriden para tahsil edildiğinde (Nakit, Havale, Kart) "Tahsilat Ekle" formu.
  - Tahsilat makbuzu yazdırma & PDF çıktısı.
- [ ] **Cari Hesap Ekstresi (PDF & Excel):**
  - İki tarih arası müşterinin tüm alışveriş ve ödeme geçmişini gösteren profesyonel hesap ekstresi.

---

## 📲 2. Aşama: WhatsApp & E-Posta Entegrasyonu (Yüksek Öncelik)
- [ ] **WhatsApp ile Bilgi Fişi Gönderme:**
  - Satış tamamlandığında "📱 WhatsApp ile Gönder" butonu.
  - Müşterinin kayıtlı telefon numarasına tek tıkla kurumsal sipariş özeti ve fiş detay linki gönderimi (`https://wa.me/...`).
- [ ] **WhatsApp ile Fatura / Ekstre Paylaşımı:**
  - Müşteri ekstresini veya bilgi fişi PDF'ini WhatsApp üzerinden doğrudan müşteriye iletme.

---

## 📦 3. Aşama: Depo Sayım & Stok Düzeltme Modülü (Orta Öncelik)
- [ ] **Hızlı Depo Sayım Ekranı:**
  - Mobil cihazdan veya barkod okuyucuyla rafları gezerek seri barkod okutma modu (her okutmada sayacı +1 artırma).
- [ ] **Sayım Karşılaştırma & Sayım Farkı:**
  - Sistemdeki teorik stok ile raftaki fiili sayımı yan yana listeleme.
  - Artı / eksi çıkan farkların maliyet analizi.
- [ ] **Tek Tıkla Stok Eşitleme (Sayım Fişi):**
  - Yönetici onayı ile sistem stoğunu sayım sonucuna eşitleme ve otomatik log kaydı oluşturma.

---

## 📊 4. Aşama: Gelişmiş Patron & Yönetici Raporları (Orta Öncelik)
- [ ] **Satışçı Performans & Prim Raporu:**
  - Hangi satış temsilcisi ay içinde kaç adet satış yaptı, ne kadar ciro ve kâr üretti?
- [ ] **Ürün Bazlı Kârlılık ve ABC Analizi:**
  - En çok satan ve en çok kâr bırakan ilk 10 ürün grafiği.
  - Son 6 aydır hiç satılmayan "ölü / hareketsiz stok" listesi.
- [ ] **Kasa / Banka Günlük Gelir-Gider Özeti:**
  - Günlük kasaya giren nakit, bankaya gelen havaleler ve rutin şirket giderleri (kira, fatura, personel vb.).

---

## ⚡ 5. Aşama: Hızlı POS Terminali & Kısayollar (Kullanım Kolaylığı)
- [ ] **Favori / Hızlı Ürün Butonları:**
  - Satış ekranında en çok satılan 8-12 ürünü buton olarak gösterme (barkod okutmadan tek tıkla sepete ekleme).
- [ ] **Klavye Kısayolları (POS Mode):**
  - `F2`: Barkod arama alanına odaklan
  - `F4`: Müşteri seçimi
  - `F8`: İndirim / İskonto uygula
  - `F9` / `Ctrl+Enter`: Satışı onaya gönder & Fiş yazdır
- [ ] **Hızlı Miktar Değiştirme:**
  - Sepetteki ürün adetlerini `+` / `-` butonlarıyla tek tıkla artırıp azaltma.

---

## 🔔 6. Aşama: Akıllı Bildirimler & Uyarılar (Otomasyon)
- [ ] **Kritik Stok Uyarısı:**
  - Stok kritik limitin altına indiğinde yönetici paneline ve zil simgesine anlık bildirim düşmesi.
- [ ] **Otomatik Tedarik Sipariş Önerisi:**
  - Tükenen ürünler için tedarikçiye verilmek üzere tek tıkla "Satın Alma Sipariş Listesi" Excel'i üretme.

---

*Son Güncelleme: 17 Ağustos 2026*  
*Takip Sistemi Proje Ekibi*
