-- Tahsilat Planım tablosu
CREATE TABLE IF NOT EXISTS tahsilat_planim (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bsy_adi TEXT NOT NULL,
  cari_kod TEXT NOT NULL,
  cari_isim TEXT NOT NULL,
  yil INTEGER NOT NULL,
  ay INTEGER NOT NULL,
  onceki NUMERIC DEFAULT 0,
  kasim NUMERIC DEFAULT 0,
  aralik NUMERIC DEFAULT 0,
  ocak NUMERIC DEFAULT 0,
  subat NUMERIC DEFAULT 0,
  mart NUMERIC DEFAULT 0,
  nisan NUMERIC DEFAULT 0,
  mayis NUMERIC DEFAULT 0,
  haziran NUMERIC DEFAULT 0,
  toplam NUMERIC DEFAULT 0,
  tahsilat_haftasi TEXT,  -- Tahsilat haftası seçimi (örn: "22-27 Haziran")
  tahsilat_turu TEXT,     -- Tahsilat türü: Çek, Nakit, Kredi Kartı
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bsy_adi, cari_kod, yil, ay)
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_tahsilat_planim_bsy ON tahsilat_planim(bsy_adi);
CREATE INDEX IF NOT EXISTS idx_tahsilat_planim_yil_ay ON tahsilat_planim(yil, ay);

-- RLS politikaları
ALTER TABLE tahsilat_planim ENABLE ROW LEVEL SECURITY;

-- Admin tüm verilere erişebilir
CREATE POLICY tahsilat_planim_admin_all ON tahsilat_planim
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- BSY kullanıcıları sadece kendi verilerini görebilir
CREATE POLICY tahsilat_planim_bsy_select ON tahsilat_planim
  FOR SELECT
  USING (
    bsy_adi IN (
      SELECT full_name FROM profiles
      WHERE user_id = auth.uid() AND role = 'bsy'
    )
  );

-- BSY kullanıcıları sadece kendi verilerini güncelleyebilir
CREATE POLICY tahsilat_planim_bsy_update ON tahsilat_planim
  FOR UPDATE
  USING (
    bsy_adi IN (
      SELECT full_name FROM profiles
      WHERE user_id = auth.uid() AND role = 'bsy'
    )
  );

-- BSY kullanıcıları sadece kendi verileri için insert yapabilir
CREATE POLICY tahsilat_planim_bsy_insert ON tahsilat_planim
  FOR INSERT
  WITH CHECK (
    bsy_adi IN (
      SELECT full_name FROM profiles
      WHERE user_id = auth.uid() AND role = 'bsy'
    )
  );
