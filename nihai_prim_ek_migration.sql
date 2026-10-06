-- Nihai Prim Listesi — Ek (performans) primi
-- Hesaplanan prime ek olarak, admin/İK'nın elle girdiği tutar (kişi + yıl + ay).
-- Tabloda hesaplanan prim + ek prim toplamı gösterilir; ek içeren hücre ayrı renkte.
-- Yazma: /api/nihai-prim-ek (service role, admin/İK rol doğrulaması).

create table if not exists public.nihai_prim_ek (
  id             uuid primary key default gen_random_uuid(),
  yil            integer not null,
  ay             integer not null check (ay between 1 and 12),
  kullanici_tipi text    not null,   -- 'BSY' | 'Süpervizör' | 'Jr. Süpervizör' | 'Çetinler Merch'
  kullanici_adi  text    not null,
  tutar          numeric not null default 0,
  aciklama       text    not null default '',
  updated_by     uuid,
  updated_at     timestamptz not null default now(),
  unique (yil, ay, kullanici_tipi, kullanici_adi)
);

create index if not exists idx_nihai_prim_ek_yil on public.nihai_prim_ek (yil);

alter table public.nihai_prim_ek enable row level security;

drop policy if exists "nihai_prim_ek_select" on public.nihai_prim_ek;
create policy "nihai_prim_ek_select"
  on public.nihai_prim_ek for select
  to authenticated
  using (true);

-- İlk kayıtlar (2026-10-06): Eylül 2026 performans primleri
insert into public.nihai_prim_ek (yil, ay, kullanici_tipi, kullanici_adi, tutar, aciklama)
values
  (2026, 9, 'BSY', 'Mustafa CETİNKAYA', 30000, 'Performans primi'),
  (2026, 9, 'BSY', 'Mutlu TOPAY',       35000, 'Performans primi')
on conflict (yil, ay, kullanici_tipi, kullanici_adi) do update
  set tutar = excluded.tutar, aciklama = excluded.aciklama, updated_at = now();

notify pgrst, 'reload schema';
