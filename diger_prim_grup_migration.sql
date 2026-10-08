-- Primler ▸ Diğer — "Grubu" kolonu (Bayi Merch / Çetinler Merch / Destek Personeli / Diğer)
alter table public.diger_prim add column if not exists grup text not null default '';
