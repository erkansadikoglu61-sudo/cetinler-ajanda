-- "Listede Görünmesin" özelliği için merch_destek_flag tablosuna gizle kolonu ekle.
-- Supabase SQL editöründe bir kez çalıştırın.
alter table public.merch_destek_flag
  add column if not exists gizle boolean not null default false;
