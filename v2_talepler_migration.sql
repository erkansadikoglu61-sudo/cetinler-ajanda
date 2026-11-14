-- Çetinler Ajanda v2 — Talepler (eksik şube talebi, hatalı bilgi bildirimi)
-- Supabase SQL Editor'da bir kez çalıştırın.
-- Yetki kontrolü uygulama tarafında (/api/v2/talepler) yapılır.

create table if not exists public.v2_talepler (
  id            uuid primary key default gen_random_uuid(),
  tip           text not null check (tip in ('eksik_sube', 'hatali_bilgi')),
  olusturan_id  uuid not null references public.profiles(id) on delete cascade,
  ilgili_id     uuid references public.profiles(id) on delete set null,  -- kimin adına (ör. Jr'ın şubesi)
  cari_adi      text,
  sube_adi      text,
  aciklama      text not null,
  durum         text not null default 'acik' check (durum in ('acik', 'cozuldu', 'reddedildi')),
  cevap         text,
  cozen_id      uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_v2_talepler_durum on public.v2_talepler (durum, created_at desc);
create index if not exists idx_v2_talepler_olusturan on public.v2_talepler (olusturan_id);

alter table public.v2_talepler enable row level security;

drop policy if exists "v2_talepler_auth" on public.v2_talepler;
create policy "v2_talepler_auth"
  on public.v2_talepler for all
  to authenticated
  using (true)
  with check (true);
