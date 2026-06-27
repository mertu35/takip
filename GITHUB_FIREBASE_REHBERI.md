# GitHub & Firebase CI/CD Otomatik Canlıya Alma Rehberi 🚀

Bu rehber, Özkon Çelik Takip Sistemini GitHub'a yüklemeyi ve her kod güncellediğinizde otomatik olarak Firebase'e (Hosting, Firestore ve Storage kuralları dahil) yüklenmesini (CI/CD) sağlayacak adımları içerir.

---

## 1. Adım: Projeyi GitHub'a Yükleme (Git Kurulumu)

Eğer projede henüz Git başlatılmadıysa, terminalden şu adımları izleyin:

```bash
# Proje ana dizinindeyken git deposu başlatın
git init

# Tüm dosyaları hazırlık alanına ekleyin (Gereksiz dosyalar .gitignore ile engellenmiştir)
git add .

# İlk commit'i yapın
git commit -m "ilk: ozkon celik takip sistemi ve github actions"

# GitHub üzerinde oluşturduğunuz boş depoyu (repository) ekleyin
git remote add origin https://github.com/KULLANICI_ADINIZ/DEPO_ADINIZ.git

# Kodu ana dallardan birine (main veya master) gönderin
git branch -M main
git push -u origin main
```

---

## 2. Adım: Firebase CI Token Alma (GitHub Yetkilendirmesi)

GitHub Actions'ın sizin adınıza Firebase'e yükleme yapabilmesi için bir erişim anahtarı (token) almalısınız:

1. Kendi bilgisayarınızda terminali açın ve şu komutu çalıştırın:
   ```bash
   npx firebase-tools login:ci
   ```
2. Tarayıcı penceresi açılacaktır. Projenizin bağlı olduğu Google/Firebase hesabıyla giriş yapın ve izin verin.
3. Giriş yaptıktan sonra terminalinizde uzun bir şifreli metin (Token) belirecektir. Örnek: `1//0gXF...`
4. Bu token bilgisini kopyalayın ve güvenli bir yerde tutun.

---

## 3. Adım: GitHub Secrets (Sırlar) Tanımlama

Projeyi canlıya alırken Firebase API anahtarlarınızın güvenliği için bu anahtarlar koda açık yazılmaz. GitHub Secrets alanına eklenir.

1. GitHub'da projenizin sayfasına gidin.
2. **Settings (Ayarlar) > Secrets and variables > Actions** menüsüne tıklayın.
3. **New repository secret** butonunu kullanarak aşağıdaki değişkenleri tek tek ekleyin:

| Secret Adı | Değer (Nereden Alınır?) |
| :--- | :--- |
| `FIREBASE_TOKEN` | 2. Adımda terminalden aldığınız `login:ci` token değeri |
| `VITE_FIREBASE_API_KEY` | Firebase Konsolu > Proje Ayarları > apiKey |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Konsolu > Proje Ayarları > authDomain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Konsolu > Proje Ayarları > projectId |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Konsolu > Proje Ayarları > storageBucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Konsolu > Proje Ayarları > messagingSenderId |
| `VITE_FIREBASE_APP_ID` | Firebase Konsolu > Proje Ayarları > appId |

---

## 4. Adım: Otomatik Yayına Alma Süreci

Her şey hazır! Artık GitHub'da `main` veya `master` dalına (branch) yeni bir kod gönderdiğinizde (`git push` yaptığınızda):

1. GitHub Actions otomatik olarak tetiklenir.
2. Node.js ortamını kurar ve bağımlılıkları yükler.
3. Sizin belirlediğiniz GitHub Secrets değerlerini kullanarak uygulamayı production için build eder.
4. Firebase CLI kullanarak web sitenizi (Hosting), veritabanı kurallarını (`firestore.rules`) ve depolama kurallarını (`storage.rules`) otomatik olarak canlıya alır.

İşlemin durumunu GitHub sayfanızdaki **Actions** sekmesinden anlık olarak izleyebilirsiniz.
