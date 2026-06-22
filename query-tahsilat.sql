SELECT 
  bsy_adi,
  cari_kod,
  cari_isim,
  tahsilat_haftasi,
  tahsilat_turu,
  updated_at
FROM tahsilat_planim
WHERE yil = 2026 AND ay = 6
  AND (tahsilat_haftasi IS NOT NULL OR tahsilat_turu IS NOT NULL)
ORDER BY updated_at DESC
LIMIT 20;
