# Firebase Push Notifications Kurulum Rehberi

Bu projede Firebase Cloud Messaging (FCM) kullanarak web push notifications sistemi kurulmuştur.

## 🔧 Kurulum Adımları

### 1. Firebase Projesi Oluştur

1. [Firebase Console](https://console.firebase.google.com/) adresine git
2. "Add project" veya "Proje ekle" butonuna tıkla
3. Proje ismi gir (örn: "Cetinler Ajanda")
4. Google Analytics'i istersen aktif et (opsiyonel)
5. Projeyi oluştur

### 2. Firebase Web App Ekle

1. Firebase Console'da projenize girin
2. Sol üst köşedeki ⚙️ (Settings) ikonuna tıklayın
3. "Project settings" seçeneğine tıklayın
4. "General" tab'inde, "Your apps" bölümünde </> (Web) ikonuna tıklayın
5. App nickname girin (örn: "Web App")
6. "Register app" butonuna tıklayın
7. **Firebase config değerlerini kopyalayın** - bunları `.env.local` dosyasına ekleyeceğiz

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc..."
};
```

### 3. Cloud Messaging'i Aktif Et

1. Firebase Console'da sol menüden **"Cloud Messaging"** seçeneğine git
2. "Get started" butonuna tıkla
3. **Web Push certificates** bölümüne git
4. "Generate key pair" butonuna tıkla
5. **VAPID Key'i kopyala** - bunu da `.env.local` dosyasına ekleyeceğiz

### 4. Service Account Key Oluştur

1. Firebase Console'da ⚙️ > "Project settings" > "Service accounts" tab'ine git
2. "Generate new private key" butonuna tıkla
3. Onaylayın ve JSON dosyasını indirin
4. **Bu JSON dosyasını GİZLİ tutun!** (Git'e eklemeyin)

### 5. Environment Variables Ayarla

`.env.local` dosyanızı açın ve şu değerleri ekleyin:

```bash
# Firebase Web App Config (Adım 2'den)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc...

# Firebase VAPID Key (Adım 3'ten)
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BNcE...

# Firebase Admin SDK (Adım 4'ten - JSON dosyasının içeriğini tek satıra çevirin)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
```

**Not:** `FIREBASE_SERVICE_ACCOUNT` değeri için JSON dosyasını tek satıra çevirin:

```bash
# Mac/Linux
cat your-service-account.json | jq -c

# Veya manuel olarak tüm satır sonlarını kaldırın
```

### 6. Service Worker'ı Güncelle

`public/firebase-messaging-sw.js` dosyasındaki placeholder değerleri gerçek Firebase config değerlerinizle değiştirin:

```javascript
firebase.initializeApp({
  apiKey: 'GERÇEK_API_KEY',
  authDomain: 'GERÇEK_AUTH_DOMAIN',
  projectId: 'GERÇEK_PROJECT_ID',
  storageBucket: 'GERÇEK_STORAGE_BUCKET',
  messagingSenderId: 'GERÇEK_SENDER_ID',
  appId: 'GERÇEK_APP_ID',
})
```

### 7. Uygulamayı Test Et

1. Uygulamayı başlatın:
```bash
npm run dev
```

2. Tarayıcıda `http://localhost:3000` adresine gidin
3. Giriş yapın
4. 2 saniye sonra push notification izni isteyecek - **Allow** deyin
5. Konsola "Push token kaydedildi" mesajı gelecek

### 8. Test Notification Gönder

Firebase Console'dan test notification gönderin:

1. Firebase Console > Cloud Messaging
2. "Send your first message" veya "New campaign"
3. Notification başlığı ve içeriği girin
4. "Send test message" butonuna tıklayın
5. Push token'ınızı girin (tarayıcı konsolundan kopyalayın)
6. Test butonuna tıklayın

## 🎯 Nasıl Çalışır?

1. Kullanıcı giriş yapar
2. 2 saniye sonra push notification izni istenir
3. Kullanıcı izin verirse, Firebase token alınır
4. Token Supabase `profiles` tablosuna kaydedilir
5. Başka biri göreve not eklediğinde:
   - Backend API (`/api/send-push-notification`) çağrılır
   - Firebase Admin SDK ile push notification gönderilir
   - Kullanıcı bildirim alır (browser açık olsun veya olmasın)

## 🔒 Güvenlik

- `FIREBASE_SERVICE_ACCOUNT` değerini **asla** Git'e eklemeyin
- Production'da Vercel environment variables kullanın
- Service account key'i güvenli bir şekilde saklayın

## 🚨 Sorun Giderme

### "Firebase yapılandırması eksik" hatası
- `.env.local` dosyasındaki tüm değerlerin doğru girildiğinden emin olun
- `FIREBASE_SERVICE_ACCOUNT` JSON formatının geçerli olduğunu kontrol edin

### Push izni gelmiyor
- HTTPS kullandığınızdan emin olun (localhost'ta çalışır)
- Tarayıcı bildirimlere izin veriyor mu kontrol edin
- Tarayıcı konsolunda hata var mı bakın

### Bildirim gelmiyor
- Push token'ın Supabase'e kaydedildiğini kontrol edin
- Firebase Console > Cloud Messaging'de test mesajı gönderin
- Service Worker'ın doğru çalıştığını kontrol edin: `chrome://serviceworker-internals/`

## 📚 Daha Fazla Bilgi

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Web Push Notifications Guide](https://firebase.google.com/docs/cloud-messaging/js/client)
