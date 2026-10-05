-- Sellout ▸ Süpervizör / Jr. Süpervizör / Merch sekmeleri — aylık açıklama notu
-- Her satır: bir dönem (YYYY-MM) + sekme için tek not. Sayfayı gören herkes okur;
-- yalnızca admin yazar (yetki kontrolü /api/sellout-aciklama route'unda; service role ile yazılır).

create table if not exists public.sellout_aciklama (
  donem      text not null,                                   -- 'YYYY-MM'
  sekme      text not null check (sekme in ('sup', 'jr', 'merch')),
  metin      text not null default '',
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (donem, sekme)
);

alter table public.sellout_aciklama enable row level security;

-- Okuma: giriş yapmış tüm kullanıcılar.
drop policy if exists "sellout_aciklama_select" on public.sellout_aciklama;
create policy "sellout_aciklama_select"
  on public.sellout_aciklama for select
  to authenticated
  using (true);

-- Yazma işlemleri service role (API route) üzerinden yapılır; RLS bypass edilir.
