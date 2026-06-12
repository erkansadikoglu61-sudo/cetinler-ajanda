-- Push token alanını profiles tablosuna ekle
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Push token için index oluştur (hızlı arama için)
CREATE INDEX IF NOT EXISTS idx_profiles_push_token ON profiles(push_token) WHERE push_token IS NOT NULL;
