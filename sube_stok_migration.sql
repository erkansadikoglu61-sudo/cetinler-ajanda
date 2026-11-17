-- Sellout ▸ Şube Takibi — şube stok (milat) ve sevk kayıtları
-- Supabase SQL Editor'da bir kez çalıştırın.
-- Kalan = milat stoğu + milattan sonraki sevkler − milattan sonraki satışlar
-- Yazma yalnızca yönetici (/api/sube-stok sunucu tarafında kontrol eder).

create table if not exists public.sube_stok (
  id          uuid primary key default gen_random_uuid(),
  sube_key    text not null,            -- B2B şube kodu (Şube Takibi ile aynı)
  cari_adi    text,
  sube_adi    text,
  stok_kodu   text not null,
  stok_adi    text,
  kalan       integer not null default 0,
  bekleyen    integer not null default 0,
  milat       date not null,
  yukleyen    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (sube_key, stok_kodu)
);
create index if not exists idx_sube_stok_sube on public.sube_stok (sube_key);

create table if not exists public.sube_sevk (
  id          uuid primary key default gen_random_uuid(),
  yukleme_id  uuid not null,
  sube_key    text not null,
  cari_adi    text,
  sube_adi    text,
  stok_kodu   text not null,
  stok_adi    text,
  adet        integer not null,
  tarih       date not null,
  yukleyen    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_sube_sevk_sube on public.sube_sevk (sube_key);
create index if not exists idx_sube_sevk_yukleme on public.sube_sevk (yukleme_id);

alter table public.sube_stok enable row level security;
alter table public.sube_sevk enable row level security;
drop policy if exists "sube_stok_auth" on public.sube_stok;
create policy "sube_stok_auth" on public.sube_stok for all to authenticated using (true) with check (true);
drop policy if exists "sube_sevk_auth" on public.sube_sevk;
create policy "sube_sevk_auth" on public.sube_sevk for all to authenticated using (true) with check (true);

-- Sevk belge no (sipariş / irsaliye no): aynı belge iki kez yüklenmesin
alter table public.sube_sevk add column if not exists belge_no text;
create index if not exists idx_sube_sevk_belge on public.sube_sevk (belge_no);

-- Sevkin stok sayımına girip girmediği (teslim edildi). false = teslim edilmemiş → Kalan'a eklenir
alter table public.sube_sevk add column if not exists sayimda boolean not null default false;
