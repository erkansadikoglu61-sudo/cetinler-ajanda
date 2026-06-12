# Resend Email Kurulum

## 1. Resend Hesabı Oluştur

1. https://resend.com/signup adresine git
2. Email ile kayıt ol: **erkansadikoglu61@gmail.com**
3. Email'i doğrula

## 2. API Key Al

1. Dashboard > API Keys
2. "Create API Key" tıkla
3. Name: "Cetinler Ajanda Production"
4. Permission: "Sending access"
5. **API Key'i kopyala** (re_... ile başlayan)

## 3. Vercel'e Ekle

```bash
vercel env add RESEND_API_KEY production
# API key'i yapıştır
```

## 4. Domain Ayarları (Opsiyonel - Sonra)

Resend başlangıçta `onboarding@resend.dev` domain'i veriyor.
100 email/gün limit var.

Kendi domain'iniz için:
1. Resend > Domains > Add Domain
2. DNS kayıtlarını ekle
3. Sınırsız email

Şimdilik onboarding domain yeterli - test için!
