-- Görevi oluşturan kişiyi takip etmek için created_by alanı ekle
-- Eğer kolon oluşturulduysa önce sil
ALTER TABLE tasks DROP COLUMN IF EXISTS created_by;

-- UUID tipinde oluştur
ALTER TABLE tasks ADD COLUMN created_by UUID REFERENCES profiles(id);

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);

-- Mevcut görevler için created_by'ı pid olarak ayarla
UPDATE tasks SET created_by = pid WHERE created_by IS NULL;
