-- ============================================================
-- Sellout Hedef Tabloları
-- Supabase SQL Editor'de çalıştırın
-- ============================================================

-- Süpervizör / Jr.Süpervizör hedefleri (profile bazlı)
CREATE TABLE IF NOT EXISTS sellout_targets_profile (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donem       text NOT NULL,                         -- '2026-05'
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  grup        text NOT NULL,                         -- 'IPL Grubu' vb.
  hedef       int  NOT NULL DEFAULT 0,
  entered_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT NOW(),
  updated_at  timestamptz DEFAULT NOW(),
  UNIQUE(donem, profile_id, grup)
);

-- Merch hedefleri (isim bazlı, profil tablosunda yok)
CREATE TABLE IF NOT EXISTS sellout_targets_merch (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donem           text NOT NULL,
  merch_name      text NOT NULL,
  supervisor_name text,
  grup            text NOT NULL,
  hedef           int  NOT NULL DEFAULT 0,
  entered_by      uuid REFERENCES profiles(id),
  created_at      timestamptz DEFAULT NOW(),
  updated_at      timestamptz DEFAULT NOW(),
  UNIQUE(donem, merch_name, grup)
);

-- RLS
ALTER TABLE sellout_targets_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellout_targets_merch   ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir, yazabilir (dahili uygulama — dış erişim yok)
CREATE POLICY "stp_all" ON sellout_targets_profile FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "stm_all" ON sellout_targets_merch   FOR ALL USING (true) WITH CHECK (true);

-- Auto-update trigger (opsiyonel)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stp_updated_at
  BEFORE UPDATE ON sellout_targets_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER stm_updated_at
  BEFORE UPDATE ON sellout_targets_merch
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
