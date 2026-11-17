-- Şube yetkisi (elle): B2B'de merch personeli olmadığı için hiçbir rapora düşmeyen
-- şubelerin süpervizör / Jr ataması. Şube Takibi, görev penceresi ve v2 Şubelerim kullanır.
-- Supabase SQL Editor'da bir kez çalıştırın. Yazma yalnızca yönetici (/api/sube-yetki).

create table if not exists public.sube_yetki (
  sube_kod    text primary key,          -- B2B şube kodu
  cari_adi    text,
  sube_adi    text,
  sup_adi     text,
  jr_adi      text,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);

alter table public.sube_yetki enable row level security;
drop policy if exists "sube_yetki_auth" on public.sube_yetki;
create policy "sube_yetki_auth" on public.sube_yetki for all to authenticated using (true) with check (true);
