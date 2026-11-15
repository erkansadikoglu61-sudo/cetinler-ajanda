-- Çetinler Ajanda v2 — Telefona bildirim (web push) abonelikleri
-- Supabase SQL Editor'da bir kez çalıştırın.

create table if not exists public.v2_push_abonelik (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  cihaz       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_v2_push_profile on public.v2_push_abonelik (profile_id);

alter table public.v2_push_abonelik enable row level security;

drop policy if exists "v2_push_auth" on public.v2_push_abonelik;
create policy "v2_push_auth"
  on public.v2_push_abonelik for all
  to authenticated
  using (true)
  with check (true);
