-- Çetinler Ajanda v2 — Çetinler Merch görev şubeleri (elle seçim)
-- Supabase SQL Editor'da bir kez çalıştırın.
-- Bir merch için kayıt varsa v2'de B2B merch kaydı yerine bu şubeler esas alınır;
-- kayıt yoksa B2B'deki merch kaydı geçerlidir. Prim / satış hesapları B2B'den
-- gelmeye devam eder, bu tablodan etkilenmez.
-- Yetki kontrolü uygulama tarafında (/api/v2/merch-sube) yapılır:
-- merch'in kendisi, bağlı olduğu Jr / süpervizör ve yönetici değiştirebilir.

create table if not exists public.v2_merch_sube (
  merch_id    uuid not null references public.profiles(id) on delete cascade,
  sube_key    text not null,          -- v2 nokta anahtarı (K:<şube kodu> ya da A:<cari>||<şube>)
  sube_kod    text,
  cari_adi    text,
  sube_adi    text,
  ekleyen_id  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (merch_id, sube_key)
);

alter table public.v2_merch_sube enable row level security;

drop policy if exists "v2_merch_sube_auth" on public.v2_merch_sube;
create policy "v2_merch_sube_auth"
  on public.v2_merch_sube for all
  to authenticated
  using (true)
  with check (true);
