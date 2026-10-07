-- Primler ▸ Diğer — manuel prim hakediş girişleri
-- Her satır: bir dönem (YYYY-MM) için kullanıcı / cari-şube / görev / şube adedi / hakediş.
-- Yalnızca admin okur ve yazar (yetki kontrolü /api/diger-prim route'unda; service role ile yazılır).

create table if not exists public.diger_prim (
  id            uuid primary key default gen_random_uuid(),
  donem         text not null,                 -- 'YYYY-MM'
  kullanici_adi text not null default '',
  cari_adi      text not null default '',
  sube_adi      text not null default '',
  gorev         text not null default '',
  sube_adet     numeric not null default 0,
  hakedis       numeric not null default 0,
  updated_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists diger_prim_donem_idx on public.diger_prim (donem);

alter table public.diger_prim enable row level security;
-- Politika yok: tüm okuma/yazma service role (API route) üzerinden yapılır.
