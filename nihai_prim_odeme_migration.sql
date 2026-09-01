-- Nihai Prim Listesi — Ödendi bilgisi kalıcılığı
-- Her satır: bir kişinin belirli yıl+ay için ödeme durumu.
-- Ödendi bilgisi yalnızca admin ve İnsan Kaynakları tarafından girilir
-- (yetki kontrolü uygulama/route tarafında yapılır; service role ile yazılır).

create table if not exists public.nihai_prim_odeme (
  id             uuid primary key default gen_random_uuid(),
  yil            integer not null,
  ay             integer not null check (ay between 1 and 12),
  kullanici_tipi text    not null,   -- 'BSY' | 'Süpervizör' | 'Jr. Süpervizör' | 'Çetinler Merch'
  kullanici_adi  text    not null,
  odendi         boolean not null default false,
  odeme_tarihi   date,
  updated_by     uuid,
  updated_at     timestamptz not null default now(),
  unique (yil, ay, kullanici_tipi, kullanici_adi)
);

create index if not exists idx_nihai_prim_odeme_yil on public.nihai_prim_odeme (yil);

alter table public.nihai_prim_odeme enable row level security;

-- Okuma: giriş yapmış tüm kullanıcılar okuyabilir (görünürlük uygulama tarafında filtrelenir).
drop policy if exists "nihai_prim_odeme_select" on public.nihai_prim_odeme;
create policy "nihai_prim_odeme_select"
  on public.nihai_prim_odeme for select
  to authenticated
  using (true);

-- Yazma işlemleri service role (API route) üzerinden yapılır; RLS bypass edilir.
