# 🔔 Push Notifications - Kurulum Özeti

## ✅ Tamamlanan İşlemler

### 1. Veritabanı
- ✅ `profiles` tablosuna `push_token` alanı eklendi (migration çalıştırıldı)
- ✅ Push token için index oluşturuldu

### 2. Backend (API)
- ✅ Firebase ve Firebase Admin paketleri kuruldu
- ✅ `/api/send-push-notification` endpoint'i oluşturuldu
- ✅ Firebase Cloud Messaging entegrasyonu tamamlandı

### 3. Frontend
- ✅ Firebase client SDK kuruldu
- ✅ `src/lib/firebase.ts` - Firebase yapılandırması oluşturuldu
- ✅ `src/hooks/usePushNotifications.ts` - Push notification hook'u oluşturuldu
- ✅ Ana uygulama sayfasına push notification entegrasyonu eklendi
- ✅ Service Worker (`public/firebase-messaging-sw.js`) oluşturuldu

### 4. Not Ekleme Fonksiyonu
- ✅ `src/hooks/useTasks.ts` - `addNote` fonksiyonu güncellendi
- ✅ Not eklendiğinde görev sahibine otomatik push notification gönderiliyor

### 5. TypeScript
- ✅ `Profile` interface'ine `push_token` alanı eklendi
- ✅ Tüm TypeScript hataları çözüldü

## 📋 Yapılması Gerekenler

### 1. Firebase Projesi Oluştur ve Yapılandır

**Detaylı adımlar için `FIREBASE_SETUP.md` dosyasına bakın.**

Kısaca:
1. Firebase Console'da yeni proje oluştur
2. Web app ekle
3. Cloud Messaging'i aktif et ve VAPID key al
4. Service Account key oluştur (JSON dosyası)

### 2. Environment Variables Ekle

`.env.local` dosyanıza şunları ekleyin:

```bash
# Firebase Web Config
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your-vapid-key

# Firebase Admin (Service Account JSON'u tek satıra çevirin)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

### 3. Service Worker Dosyasını Güncelle

`public/firebase-messaging-sw.js` dosyasındaki placeholder'ları gerçek Firebase config değerlerinizle değiştirin.

### 4. Production'a Deploy

Vercel'de environment variables'ları production için de ekleyin.

## 🎯 Nasıl Çalışıyor?

```
1. Kullanıcı giriş yapar
   ↓
2. 2 saniye sonra push notification izni istenir
   ↓
3. Kullanıcı "İzin Ver" der
   ↓
4. Firebase token alınır ve Supabase'e kaydedilir
   ↓
5. Başka biri göreve not eklediğinde:
   - Not eklendi
   - Görev sahibinin push token'ı alınır
   - /api/send-push-notification çağrılır
   - Firebase Admin SDK ile push notification gönderilir
   ↓
6. Kullanıcı bildirim alır! 🎉
```

## 📱 Test Etme

1. Uygulamayı başlatın: `npm run dev`
2. Tarayıcıda giriş yapın
3. Notification izni verin
4. Konsolda "Push token kaydedildi" mesajını görün
5. Başka bir kullanıcıyla giriş yapıp bir göreve not ekleyin
6. İlk kullanıcı push notification almalı!

## 🐛 Sorun Giderme

### "Firebase yapılandırması eksik" hatası
- Environment variables doğru mu kontrol edin
- `FIREBASE_SERVICE_ACCOUNT` JSON formatı geçerli mi?

### Push izni gelmiyor
- HTTPS kullanın (localhost'ta çalışır)
- Tarayıcı console'da hata var mı kontrol edin

### Bildirim gelmiyor
- Push token Supabase'e kaydedildi mi?
- Firebase Console'dan test notification gönderin
- Service Worker çalışıyor mu: `chrome://serviceworker-internals/`

## 📚 İlgili Dosyalar

```
cetinler-ajanda/
├── src/
│   ├── lib/
│   │   ├── firebase.ts                    # Firebase client config
│   │   └── supabase.ts                     # Profile interface güncellendi
│   ├── hooks/
│   │   ├── usePushNotifications.ts         # Push notification hook
│   │   └── useTasks.ts                     # addNote güncellendi
│   ├── app/
│   │   ├── app/page.tsx                    # Push notification entegrasyonu
│   │   └── api/
│   │       └── send-push-notification/
│   │           └── route.ts                # Push notification API
├── public/
│   └── firebase-messaging-sw.js            # Service Worker
├── add_push_token_migration.sql            # Veritabanı migration
├── FIREBASE_SETUP.md                       # Detaylı kurulum rehberi
└── .env.local.example                      # Environment variables örneği
```

## ✨ Özellikler

- ✅ Gerçek zamanlı push notifications
- ✅ Browser açık olmasa bile bildirim gelir
- ✅ Otomatik token yenileme
- ✅ Sadece görev sahibine bildirim gider
- ✅ Bildirimde görev detayları ve not içeriği gösterilir
- ✅ Not ekleyen kişinin adı gösterilir

## 🔒 Güvenlik

- Service Account key'i **asla** Git'e eklemeyin
- `.env.local` dosyası `.gitignore`'da olmalı
- Production'da Vercel environment variables kullanın
