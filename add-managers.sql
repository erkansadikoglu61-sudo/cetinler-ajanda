-- Yönetici kullanıcıları ekle
-- Bu script'i Supabase Dashboard > SQL Editor'de çalıştır

-- 1. Hakan Çetinkaya
-- Email: hakancetinkaya@cetinlerltd.com.tr
-- Şifre: hakan123
-- Auth kullanıcısını manuel olarak Supabase Dashboard > Authentication'dan ekle
-- Sonra bu profil kaydını çalıştır:

INSERT INTO profiles (id, full_name, role, color, email)
VALUES (
  'HAKAN_USER_UUID_BURAYA', -- Supabase'de oluşturulan user id'yi buraya yapıştır
  'Hakan Çetinkaya',
  'manager',
  '#10B981', -- Yeşil
  'hakancetinkaya@cetinlerltd.com.tr'
)
ON CONFLICT (id) DO UPDATE
SET role = 'manager', full_name = 'Hakan Çetinkaya', email = 'hakancetinkaya@cetinlerltd.com.tr';

-- 2. Hüseyin Çetinkaya
-- Email: h.cetinkaya@cetinlerltd.com.tr
-- Şifre: huseyin123

INSERT INTO profiles (id, full_name, role, color, email)
VALUES (
  'HUSEYIN_USER_UUID_BURAYA',
  'Hüseyin Çetinkaya',
  'manager',
  '#3B82F6', -- Mavi
  'h.cetinkaya@cetinlerltd.com.tr'
)
ON CONFLICT (id) DO UPDATE
SET role = 'manager', full_name = 'Hüseyin Çetinkaya', email = 'h.cetinkaya@cetinlerltd.com.tr';

-- 3. Emir Çetinkaya
-- Email: e.cetinkaya@cetinlerltd.com.tr
-- Şifre: emir123

INSERT INTO profiles (id, full_name, role, color, email)
VALUES (
  'EMIR_USER_UUID_BURAYA',
  'Emir Çetinkaya',
  'manager',
  '#8B5CF6', -- Mor
  'e.cetinkaya@cetinlerltd.com.tr'
)
ON CONFLICT (id) DO UPDATE
SET role = 'manager', full_name = 'Emir Çetinkaya', email = 'e.cetinkaya@cetinlerltd.com.tr';
