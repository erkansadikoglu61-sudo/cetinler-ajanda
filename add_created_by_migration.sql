-- Görevi oluşturan kişiyi takip etmek için created_by alanı ekle
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES profiles(id);

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);

-- Mevcut görevler için created_by'ı pid olarak ayarla (geçici çözüm)
UPDATE tasks SET created_by = pid WHERE created_by IS NULL;
