-- Çetinler Merch kullanıcı tipi: profiles.role için 'merch' değerine izin ver.
-- Mevcut role CHECK kısıtını (adı ne olursa olsun) kaldırıp tüm rollerle yeniden oluşturur.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'profiles' and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'bsy', 'sup', 'jr', 'manager', 'ik', 'merch'));
