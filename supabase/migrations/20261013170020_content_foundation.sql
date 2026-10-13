-- Фаза 1: основа моделі змісту (SPEC 6.1, 6.2).
-- Схема private не відкрита через Data API: тут налаштування і функції-помічники для політик.

create schema if not exists private;
revoke all on schema private from public;
-- Політики RLS викликають функції з private з правами того, хто робить запит, тому ролям API
-- потрібен USAGE на схему (самі об'єкти схеми через API недоступні — її немає в exposed schemas).
grant usage on schema private to anon, authenticated, service_role;

-- ── Налаштування застосунку ──────────────────────────────────────────────────────────────
-- show_demo вмикає показ демо-змісту (is_demo) гостям і учням. На prod — false; true ставить
-- лише supabase/seed.sql (локально й у CI). Міграції демо-рядків не вставляють (SPEC 6.1, 15).
create table private.settings (
  id boolean primary key default true check (id), -- рівно один рядок
  show_demo boolean not null default false
);
insert into private.settings (id, show_demo) values (true, false);
revoke all on private.settings from public, anon, authenticated;

-- ── Функції-помічники для політик ────────────────────────────────────────────────────────
-- Гість квізу (Supabase Anonymous Sign-ins) має роль authenticated, тому вчительські політики
-- явно його виключають (SPEC 9.1).
create function private.is_anonymous()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

-- Читає private.settings, до якої ролі API доступу не мають, тому security definer.
-- Лише повертає прапорець, без аргументів і без доступу до даних користувачів.
create function private.show_demo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.show_demo from private.settings s where s.id), false)
$$;

revoke execute on function private.is_anonymous() from public;
revoke execute on function private.show_demo() from public;
grant execute on function private.is_anonymous() to anon, authenticated, service_role;
grant execute on function private.show_demo() to anon, authenticated, service_role;

-- updated_at для всіх таблиць змісту
create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── Школи й вчителі ──────────────────────────────────────────────────────────────────────
-- Підготовка до кількох вчителів (SPEC 5): на старті одна школа. Рядки вчителів створює Фаза 2
-- (вхід вчителя); у Фазі 1 — лише демо-вчитель у локальному seed.
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.teachers (
  id uuid primary key references auth.users (id) on delete cascade,
  school_id uuid not null references public.schools (id),
  display_name text not null default '',
  created_at timestamptz not null default now()
);
create index teachers_school_id_idx on public.teachers (school_id);

-- Школа вчителя, від імені якого йде запит (для school_id у нових рядках змісту)
create function private.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.school_id from public.teachers t where t.id = (select auth.uid())
$$;
revoke execute on function private.current_school_id() from public;
grant execute on function private.current_school_id() to authenticated, service_role;

-- Вчитель — це користувач з рядком у teachers і не анонімний
create function private.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not private.is_anonymous()
     and exists (select 1 from public.teachers t where t.id = (select auth.uid()))
$$;
revoke execute on function private.is_teacher() from public;
grant execute on function private.is_teacher() to anon, authenticated, service_role;

alter table public.schools enable row level security;
alter table public.teachers enable row level security;

grant select on public.schools, public.teachers to authenticated;

-- Вчитель бачить свій рядок і свою школу; створення й зміну робить Фаза 2 (Edge Function / адмін)
create policy teachers_select_own on public.teachers
  for select to authenticated
  using (id = (select auth.uid()) and not (select private.is_anonymous()));

create policy schools_select_own on public.schools
  for select to authenticated
  using (id = (select private.current_school_id()));
