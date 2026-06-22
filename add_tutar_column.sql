-- Tahsilat planım tablosuna tutar kolonu ekle
ALTER TABLE tahsilat_planim
ADD COLUMN IF NOT EXISTS tutar NUMERIC DEFAULT NULL;
