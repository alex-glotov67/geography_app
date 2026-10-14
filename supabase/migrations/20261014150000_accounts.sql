-- Фаза 2: акаунти, класи, учні, журнал дій (SPEC 5, 6.2, 14).
-- Зворотно сумісна: лише нові таблиці, нові стовпці з типовими значеннями і нові функції.
-- Створення акаунтів учнів, скидання паролів і архівація — лише Edge Function manage-students
-- (сервісний ключ), тому вставки в students і audit_log з клієнта немає.

-- ── Налаштування вчителя (SPEC 5.1, 8.2 «Налаштування») ──────────────────────────────────
alter table public.teachers
  add column login_prefix text not null default ''
    check (login_prefix ~ '^([a-z0-9]{1,6})?$'),
  add column students_can_change_password boolean not null default false;

comment on column public.teachers.login_prefix is
  'Префікс логінів учнів, якщо в школі кілька вчителів (напр. «hl» → hl-8b-07); порожній — без префікса';

-- Вчитель змінює лише свої налаштування; school_id і id — ні
grant update (display_name, login_prefix, students_can_change_password) on public.teachers to authenticated;
create policy teachers_update_own on public.teachers
  for update to authenticated
  using (id = (select auth.uid()) and not (select private.is_anonymous()))
  with check (id = (select auth.uid()));

-- Назва школи — на картках входу (SPEC 5.1); змінює вчитель цієї школи
grant update (name) on public.schools to authenticated;
create policy schools_update_own on public.schools
  for update to authenticated
  using (id = (select private.current_school_id()) and (select private.is_teacher()))
  with check (id = (select private.current_school_id()));

-- ── Класи ────────────────────────────────────────────────────────────────────────────────
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references public.teachers (id) on delete cascade,
  school_id uuid not null default private.current_school_id() references public.schools (id),
  name text not null check (name ~ '^[6-9]-[АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЮЯ]$'),           -- «8-Б»
  grade smallint not null check (grade between 6 and 9),
  school_year text not null check (school_year ~ '^\d{4}-\d{4}$'), -- «2026-2027»
  login_prefix text not null check (login_prefix ~ '^[6-9][a-z]{1,4}$'), -- «8b» (lib/translit.ts)
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (teacher_id, school_year, name),
  check (left(name, 1)::smallint = grade)
);
create index classes_school_id_idx on public.classes (school_id);

-- Вчитель цього класу (для політик students і функцій)
create function private.teaches_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not private.is_anonymous()
     and exists (select 1 from public.classes c where c.id = p_class_id and c.teacher_id = (select auth.uid()))
$$;
revoke execute on function private.teaches_class(uuid) from public;
grant execute on function private.teaches_class(uuid) to authenticated, service_role;

-- ── Учні ─────────────────────────────────────────────────────────────────────────────────
-- Лише прізвище й ініціал (SPEC 14); пароль ніде не зберігається (його знає лише Supabase Auth).
create table public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete restrict,
  school_id uuid not null references public.schools (id),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  number smallint not null check (number between 1 and 99),                -- № у списку класу
  last_name text not null check (length(btrim(last_name)) between 1 and 60),
  first_initial text not null check (first_initial ~ '^[АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЮЯA-Z]$'),
  display_name text generated always as (btrim(last_name) || ' ' || first_initial || '.') stored,
  -- для збігу при повторному імпорті: без регістру, апострофи зведено до одного знака
  name_key text generated always as (
    lower(translate(btrim(last_name), '''’`', 'ʼʼʼ')) || ' ' || lower(first_initial)
  ) stored,
  login text not null unique check (login ~ '^([a-z0-9]{1,6}-)?[6-9][a-z]{1,4}-\d{2}$'),
  simplified_mode boolean not null default false,
  archived boolean not null default false,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  unique (class_id, number)
);
create index students_class_id_idx on public.students (class_id);
create index students_school_id_idx on public.students (school_id);

-- Учень — користувач із рядком у students, не архівований і не анонімний
create function private.is_student()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not private.is_anonymous()
     and exists (select 1 from public.students s where s.auth_user_id = (select auth.uid()) and not s.archived)
$$;
revoke execute on function private.is_student() from public;
grant execute on function private.is_student() to anon, authenticated, service_role;

-- ── Журнал дій з акаунтами (SPEC 14) ─────────────────────────────────────────────────────
create table public.audit_log (
  id bigint generated always as identity primary key,
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  action text not null check (action in (
    'students.create', 'students.reset_password', 'students.archive', 'students.unarchive'
  )),
  details jsonb not null default '{}',
  at timestamptz not null default now()
);
create index audit_log_teacher_id_at_idx on public.audit_log (teacher_id, at desc);

-- ── Доступ ───────────────────────────────────────────────────────────────────────────────
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.audit_log enable row level security;

grant select, insert on public.classes to authenticated;
grant update (name, grade, login_prefix, archived) on public.classes to authenticated;
grant select on public.students to authenticated;
grant update (last_name, first_initial, simplified_mode) on public.students to authenticated;
grant select on public.audit_log to authenticated;
-- Видалення класів і учнів з клієнта немає: учень, що вибув, — архів (SPEC 5.2);
-- видалення акаунтів — «Закрити рік» (SPEC 14) з окремим погодженням.
grant all on public.classes, public.students, public.audit_log to service_role;

-- Вчитель бачить свої класи; учень — лише свій клас (назву для шапки кабінету)
create policy classes_select on public.classes
  for select to authenticated
  using (
    not (select private.is_anonymous())
    and (
      teacher_id = (select auth.uid())
      or exists (
        select 1 from public.students s
        where s.class_id = classes.id and s.auth_user_id = (select auth.uid()) and not s.archived
      )
    )
  );

create policy classes_teacher_insert on public.classes
  for insert to authenticated
  with check (
    teacher_id = (select auth.uid())
    and (select private.is_teacher())
    and school_id = (select private.current_school_id())
  );

create policy classes_teacher_update on public.classes
  for update to authenticated
  using (teacher_id = (select auth.uid()) and not (select private.is_anonymous()))
  with check (teacher_id = (select auth.uid()));

-- Вчитель бачить учнів своїх класів; учень — лише свій рядок (ім'я, «спрощений режим» для вигляду уроку)
create policy students_select on public.students
  for select to authenticated
  using (
    (select private.teaches_class(class_id))
    or (auth_user_id = (select auth.uid()) and not archived and not (select private.is_anonymous()))
  );

create policy students_teacher_update on public.students
  for update to authenticated
  using ((select private.teaches_class(class_id)))
  with check ((select private.teaches_class(class_id)));

create policy audit_log_teacher_select on public.audit_log
  for select to authenticated
  using (teacher_id = (select auth.uid()) and not (select private.is_anonymous()));

-- ── Останній вхід учня ───────────────────────────────────────────────────────────────────
-- Учень не має права update на students; функція змінює лише last_login_at свого рядка.
create function private.touch_last_login_impl()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.students set last_login_at = now()
  where auth_user_id = (select auth.uid()) and not archived and not private.is_anonymous()
$$;
revoke execute on function private.touch_last_login_impl() from public;
grant execute on function private.touch_last_login_impl() to authenticated;

create function public.touch_last_login()
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.touch_last_login_impl()
$$;
revoke execute on function public.touch_last_login() from public, anon;
grant execute on function public.touch_last_login() to authenticated;
