# Manager Kullanıcılarını Oluşturma

## Yöntem 1: Supabase Dashboard (Önerilen)

### Adım 1: Kullanıcıları Oluştur

1. **Supabase Dashboard** açın: https://supabase.com/dashboard
2. **Authentication** > **Users** sayfasına gidin
3. **Add User** butonuna tıklayın
4. Her manager için:

#### Hakan Çetinkaya
- **Email**: `hakancetinkaya@cetinlerltd.com.tr`
- **Password**: `hakan123`
- **Auto Confirm User**: ✅ (işaretli olsun)

#### Hüseyin Çetinkaya
- **Email**: `h.cetinkaya@cetinlerltd.com.tr`
- **Password**: `huseyin123`
- **Auto Confirm User**: ✅

#### Emir Çetinkaya
- **Email**: `e.cetinkaya@cetinlerltd.com.tr`
- **Password**: `emir123`
- **Auto Confirm User**: ✅

### Adım 2: Profile Kayıtlarını Ekle

Her kullanıcı oluşturduktan sonra **UUID**'sini kopyalayın ve SQL Editor'de çalıştırın:

```sql
-- Hakan Çetinkaya
INSERT INTO profiles (id, full_name, role, color, email)
VALUES (
  'BURAYA_HAKAN_UUID_YAPISTIR',
  'Hakan Çetinkaya',
  'manager',
  '#10B981',
  'hakancetinkaya@cetinlerltd.com.tr'
);

-- Hüseyin Çetinkaya
INSERT INTO profiles (id, full_name, role, color, email)
VALUES (
  'BURAYA_HUSEYIN_UUID_YAPISTIR',
  'Hüseyin Çetinkaya',
  'manager',
  '#3B82F6',
  'h.cetinkaya@cetinlerltd.com.tr'
);

-- Emir Çetinkaya
INSERT INTO profiles (id, full_name, role, color, email)
VALUES (
  'BURAYA_EMIR_UUID_YAPISTIR',
  'Emir Çetinkaya',
  'manager',
  '#8B5CF6',
  'e.cetinkaya@cetinlerltd.com.tr'
);
```

---

## Yöntem 2: SQL Script ile Toplu Oluşturma

Eğer SQL ile toplu işlem yapmak isterseniz (tüm auth + profile):

1. **Supabase Dashboard** > **SQL Editor**
2. Aşağıdaki SQL'i çalıştırın:

```sql
-- NOT: Bu script sadece profile'ları oluşturur
-- Auth kullanıcılarını manuel olarak Dashboard'dan ekleyin

-- Mevcut kullanıcıların UUID'lerini buraya yazın
DO $$
DECLARE
  hakan_uuid UUID := 'BURAYA_HAKAN_UUID';
  huseyin_uuid UUID := 'BURAYA_HUSEYIN_UUID';
  emir_uuid UUID := 'BURAYA_EMIR_UUID';
BEGIN
  -- Hakan
  INSERT INTO profiles (id, full_name, role, color, email)
  VALUES (hakan_uuid, 'Hakan Çetinkaya', 'manager', '#10B981', 'hakancetinkaya@cetinlerltd.com.tr')
  ON CONFLICT (id) DO UPDATE SET role = 'manager';

  -- Hüseyin
  INSERT INTO profiles (id, full_name, role, color, email)
  VALUES (huseyin_uuid, 'Hüseyin Çetinkaya', 'manager', '#3B82F6', 'h.cetinkaya@cetinlerltd.com.tr')
  ON CONFLICT (id) DO UPDATE SET role = 'manager';

  -- Emir
  INSERT INTO profiles (id, full_name, role, color, email)
  VALUES (emir_uuid, 'Emir Çetinkaya', 'manager', '#8B5CF6', 'e.cetinkaya@cetinlerltd.com.tr')
  ON CONFLICT (id) DO UPDATE SET role = 'manager';
END $$;
```

---

## Test

Oluşturulduktan sonra test edin:

1. **Logout** yapın
2. Manager email/şifresi ile login olun
3. Otomatik olarak **Dashboard** sekmesi açılmalı
4. Başka hiçbir sekme görünmemeli
5. Sağ üstte isim ve çıkış butonu olmalı
