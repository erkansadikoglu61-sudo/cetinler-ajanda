-- ============================================================
-- BSY Hedef Tablosu — Supabase SQL Editor'de çalıştırın
-- ============================================================

CREATE TABLE IF NOT EXISTS bsy_hedef (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yil         int  NOT NULL,
  ay          int  NOT NULL,
  brand       text NOT NULL,   -- 'ELECTROLUX' | 'RELUX' | 'ELECTROLUX BEYAZ EŞYA'
  hedef_ciro  numeric NOT NULL DEFAULT 0,
  toplam_prim numeric NOT NULL DEFAULT 0,
  entered_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT NOW(),
  updated_at  timestamptz DEFAULT NOW(),
  UNIQUE(yil, ay, brand)
);

ALTER TABLE bsy_hedef ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bsy_hedef_all" ON bsy_hedef FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bsy_hedef_updated_at
  BEFORE UPDATE ON bsy_hedef
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- BSY Kişi Bazlı Hedef Tablosu (ay >= 5 için yeni layout)
-- ============================================================

CREATE TABLE IF NOT EXISTS bsy_kisi_hedef (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yil            int  NOT NULL,
  ay             int  NOT NULL,
  bsy_adi        text NOT NULL,
  brand          text NOT NULL,
  hedef_ciro     numeric NOT NULL DEFAULT 0,
  hakedilen_prim numeric,
  created_at     timestamptz DEFAULT NOW(),
  updated_at     timestamptz DEFAULT NOW(),
  UNIQUE(yil, ay, bsy_adi, brand)
);

ALTER TABLE bsy_kisi_hedef ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bsy_kisi_hedef_all" ON bsy_kisi_hedef FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER bsy_kisi_hedef_updated_at
  BEFORE UPDATE ON bsy_kisi_hedef
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- BSY Kişi Bazlı Extra Parametreler Tablosu
-- ============================================================

CREATE TABLE IF NOT EXISTS bsy_kisi_extra (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yil          int  NOT NULL,
  ay           int  NOT NULL,
  bsy_adi      text NOT NULL,
  marka_carp   numeric,
  tahsiat_carp numeric,
  created_at   timestamptz DEFAULT NOW(),
  updated_at   timestamptz DEFAULT NOW(),
  UNIQUE(yil, ay, bsy_adi)
);

ALTER TABLE bsy_kisi_extra ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bsy_kisi_extra_all" ON bsy_kisi_extra FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER bsy_kisi_extra_updated_at
  BEFORE UPDATE ON bsy_kisi_extra
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
