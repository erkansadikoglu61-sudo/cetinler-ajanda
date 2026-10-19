-- Adet Prim Tablosu — elle eklenen ürünlerin kategorisi (SAHA.xlsx'te olmayan stoklar için)
-- Boşsa kategori SAHA.xlsx'ten gelir.
alter table public.adet_prim_override add column if not exists kategori text;
