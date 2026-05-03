-- Kullanıcı profilleri (Supabase Auth ile bağlantılı)
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin','bsy','sup','jr')),
  color       TEXT NOT NULL DEFAULT '#1D9E75',
  manager_id  UUID REFERENCES profiles(id),
  email       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- BSY ↔ Süpervizör/Jr bağlantı tablosu
CREATE TABLE IF NOT EXISTS bsy_supervisors (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bsy_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sup_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(bsy_id, sup_id)
);

-- Görevler
CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pid          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  time         TIME,
  type         TEXT NOT NULL,
  customer     TEXT,
  description  TEXT,
  checkin_ts   TIMESTAMPTZ,
  checkin_lat  DOUBLE PRECISION,
  checkin_lng  DOUBLE PRECISION,
  checkin_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Notlar
CREATE TABLE IF NOT EXISTS task_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES profiles(id),
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS aktif et
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bsy_supervisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_notes       ENABLE ROW LEVEL SECURITY;

-- RLS politikaları
CREATE POLICY "profiles_select"    ON profiles        FOR SELECT USING (true);
CREATE POLICY "profiles_update"    ON profiles        FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "bsy_sup_all"        ON bsy_supervisors FOR ALL   USING (true);
CREATE POLICY "tasks_select"       ON tasks           FOR SELECT USING (true);
CREATE POLICY "tasks_insert"       ON tasks           FOR INSERT WITH CHECK (
  auth.uid() = pid OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "tasks_update"       ON tasks           FOR UPDATE USING (
  auth.uid() = pid OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "tasks_delete"       ON tasks           FOR DELETE USING (
  auth.uid() = pid OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "notes_select"       ON task_notes      FOR SELECT USING (true);
CREATE POLICY "notes_insert"       ON task_notes      FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ÖRNEK VERİ — Supabase Auth üzerinden kullanıcılar oluşturulduktan sonra
-- aşağıdaki SQL'i kendi Auth UID'lerinizle çalıştırın.
-- ============================================================
-- Admin: Erkan SADIKOĞLU
-- INSERT INTO profiles (id, full_name, role, color, email)
-- VALUES ('AUTH_UID_ERKAN', 'Erkan SADIKOĞLU', 'admin', '#083325', 'erkan@cetinler.com');

-- BSY'ler
-- INSERT INTO profiles (id, full_name, role, color, email) VALUES
-- ('AUTH_UID_ATILLA_BSY', 'Atilla YILMAZ', 'bsy', '#085041', 'atilla.yilmaz@cetinler.com'),
-- ('AUTH_UID_BURAK_BSY',  'Burak KILIÇ',   'bsy', '#1D6B4E', 'burak.kilic@cetinler.com'),
-- ...

-- Süpervizörler
-- INSERT INTO profiles (id, full_name, role, color, email) VALUES
-- ('AUTH_UID_ATILLA_SUP', 'Atilla Yılmaz', 'sup', '#993C1D', 'atilla.yilmaz.sup@cetinler.com'),
-- ...

-- BSY bağlantıları
-- INSERT INTO bsy_supervisors (bsy_id, sup_id) VALUES
-- ('AUTH_UID_ATILLA_BSY', 'AUTH_UID_ATILLA_SUP'),
-- ...
