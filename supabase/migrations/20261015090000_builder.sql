-- Фаза 3: конструктор змісту (SPEC 10). Зворотно сумісно: нові стовпці з типовими значеннями,
-- нові функції й view; publish_lesson_impl замінено (дозвіл вчителя 15.10.2026) — додано
-- перевірку TODO(teacher). Стара public.publish_lesson лишається (скрипти seed).

-- ── Ревізії робочих копій: виявлення конфлікту двох вкладок (SPEC 10.7) ──────────────────
-- Ревізія зростає лише від правки змісту — не від публікації, статусу чи позначки перевірки,
-- тож відкритий конструктор після публікації не отримує хибного конфлікту.
alter table public.lessons add column revision integer not null default 1 check (revision >= 1);
alter table public.tasks add column revision integer not null default 1 check (revision >= 1);

create function private.bump_lesson_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.slug, new.grade, new.section_id, new.number, new.title, new.textbook_ref, new.ktp_ref,
      new.blocks, new.homework, new.simplified, new.quiz_pool)
     is distinct from
     (old.slug, old.grade, old.section_id, old.number, old.title, old.textbook_ref, old.ktp_ref,
      old.blocks, old.homework, old.simplified, old.quiz_pool) then
    new.revision := old.revision + 1;
  else
    new.revision := old.revision; -- клієнт не може підробити ревізію
  end if;
  -- Адреса /lesson/<slug> уже надрукована в QR — після першої публікації не змінюється (SPEC 6.1)
  if new.slug is distinct from old.slug and old.published_version is not null then
    raise exception 'Адресу опублікованого уроку змінити не можна: вона вже в QR-кодах'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger lessons_bump_revision before update on public.lessons
  for each row execute function private.bump_lesson_revision();

create function private.bump_task_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.type, new.level, new.grp, new.points, new.tags, new.content, new.hint, new.feedback,
      new.print_override, new.visibility, new.archived)
     is distinct from
     (old.type, old.level, old.grp, old.points, old.tags, old.content, old.hint, old.feedback,
      old.print_override, old.visibility, old.archived)
     -- змінився лише ключ (task_keys) — сигнал від save_task через налаштування транзакції;
     -- клієнт його не задає (set_config через Data API недоступна), тож ревізію не підробити
     or coalesce(current_setting('app.task_key_changed', true), '') = 'on' then
    new.revision := old.revision + 1;
  else
    new.revision := old.revision;
  end if;
  return new;
end;
$$;
create trigger tasks_bump_revision before update on public.tasks
  for each row execute function private.bump_task_revision();

-- Помилка конфлікту ревізій: клієнт розпізнає за кодом 40001 (SPEC 10.7)
create function private.revision_conflict(p_what text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% змінено в іншій вкладці чи на іншому пристрої', p_what using errcode = '40001';
end;
$$;

-- ── Збереження уроку: поля + результати програми однією транзакцією ──────────────────────
-- security invoker: діють RLS-політики власника. p_revision — ревізія, яку бачив конструктор;
-- null — без перевірки («Перезаписати моїми змінями»).
create function public.save_lesson(p_id uuid, p_revision integer, p_fields jsonb, p_outcome_ids uuid[] default null)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r integer;
begin
  update public.lessons l set
    slug = coalesce(p_fields ->> 'slug', l.slug),
    grade = coalesce((p_fields ->> 'grade')::smallint, l.grade),
    section_id = case when p_fields ? 'sectionId' then (p_fields ->> 'sectionId')::uuid else l.section_id end,
    number = case when p_fields ? 'number' then (p_fields ->> 'number')::smallint else l.number end,
    title = coalesce(p_fields ->> 'title', l.title),
    textbook_ref = case when p_fields ? 'textbookRef' then nullif(p_fields -> 'textbookRef', 'null'::jsonb) else l.textbook_ref end,
    ktp_ref = case when p_fields ? 'ktpRef' then p_fields ->> 'ktpRef' else l.ktp_ref end,
    blocks = coalesce(p_fields -> 'blocks', l.blocks),
    homework = case when p_fields ? 'homework' then nullif(p_fields -> 'homework', 'null'::jsonb) else l.homework end,
    simplified = case when p_fields ? 'simplified' then nullif(p_fields -> 'simplified', 'null'::jsonb) else l.simplified end
  where l.id = p_id and (p_revision is null or l.revision = p_revision)
  returning l.revision into r;
  if r is null then
    if exists (select 1 from public.lessons where id = p_id) then
      perform private.revision_conflict('Урок');
    end if;
    raise exception 'Урок не знайдено' using errcode = 'no_data_found';
  end if;

  if p_outcome_ids is not null then
    delete from public.lesson_outcomes where lesson_id = p_id and outcome_id <> all (p_outcome_ids);
    insert into public.lesson_outcomes (lesson_id, outcome_id)
    select p_id, o from unnest(p_outcome_ids) o
    on conflict do nothing;
  end if;
  return r;
end;
$$;
revoke execute on function public.save_lesson(uuid, integer, jsonb, uuid[]) from public, anon;
grant execute on function public.save_lesson(uuid, integer, jsonb, uuid[]) to authenticated;

-- ── Збереження завдання: робоча копія + ключ однією транзакцією ──────────────────────────
-- p_id null — нове завдання. Повертає id, ревізію й версію (версія зростає, якщо поточна вже
-- зафіксована в публікації — тригер bump_task_version).
create function public.save_task(p_id uuid, p_revision integer, p_task jsonb, p_key jsonb)
returns table (id uuid, revision integer, version integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  tid uuid := p_id;
  key_changed boolean;
begin
  if jsonb_typeof(p_key) is distinct from 'object' then
    raise exception 'Ключ відповіді — обов''язковий об''єкт' using errcode = 'check_violation';
  end if;

  if tid is null then
    insert into public.tasks (type, level, grp, points, tags, content, hint, feedback, print_override, visibility)
    values (
      p_task ->> 'type', p_task ->> 'level', p_task ->> 'grp',
      coalesce((p_task ->> 'points')::numeric, 1), coalesce(p_task -> 'tags', '{}'),
      p_task -> 'content', p_task ->> 'hint', nullif(p_task -> 'feedback', 'null'::jsonb),
      nullif(p_task -> 'printOverride', 'null'::jsonb), p_task ->> 'visibility'
    )
    returning public.tasks.id into tid;
    insert into public.task_keys (task_id, key) values (tid, p_key);
  else
    key_changed := (select k.key from public.task_keys k where k.task_id = tid) is distinct from p_key;
    -- змінився лише ключ — тригер bump_task_revision підніме ревізію
    perform set_config('app.task_key_changed', case when key_changed then 'on' else 'off' end, true);
    update public.tasks t set
      type = p_task ->> 'type',
      level = p_task ->> 'level',
      grp = p_task ->> 'grp',
      points = coalesce((p_task ->> 'points')::numeric, 1),
      tags = coalesce(p_task -> 'tags', '{}'),
      content = p_task -> 'content',
      hint = p_task ->> 'hint',
      feedback = nullif(p_task -> 'feedback', 'null'::jsonb),
      print_override = nullif(p_task -> 'printOverride', 'null'::jsonb),
      visibility = p_task ->> 'visibility'
    where t.id = tid and (p_revision is null or t.revision = p_revision);
    if not found then
      if exists (select 1 from public.tasks where public.tasks.id = tid) then
        perform private.revision_conflict('Завдання');
      end if;
      raise exception 'Завдання не знайдено' using errcode = 'no_data_found';
    end if;
    perform set_config('app.task_key_changed', 'off', true);
    if key_changed then
      insert into public.task_keys (task_id, key) values (tid, p_key)
      on conflict (task_id) do update set key = excluded.key;
    end if;
  end if;

  return query select t.id, t.revision, t.version from public.tasks t where t.id = tid;
end;
$$;
revoke execute on function public.save_task(uuid, integer, jsonb, jsonb) from public, anon;
grant execute on function public.save_task(uuid, integer, jsonb, jsonb) to authenticated;

-- ── Де використовується завдання (банк, попередження при збереженні) ─────────────────────
-- security_invoker: вчитель бачить лише свої уроки (RLS lessons). published — завдання стоїть
-- у поточній опублікованій версії уроку (учні бачать саме її).
create view public.task_usage with (security_invoker = true) as
select
  r.task_id,
  l.id as lesson_id,
  l.slug as lesson_slug,
  l.title as lesson_title,
  l.grade,
  l.number as lesson_number,
  r.role,
  exists (
    select 1 from public.lesson_version_tasks lvt
    join public.lesson_versions lv on lv.lesson_id = lvt.lesson_id and lv.version = lvt.lesson_version
    where lv.is_current and lvt.lesson_id = l.id and lvt.task_id = r.task_id
  ) as published
from public.lessons l
cross join lateral private.lesson_task_refs(l.blocks, l.homework, l.simplified, l.quiz_pool) r;

grant select on public.task_usage to authenticated;

-- ── Публікація: перевірка TODO(teacher) ──────────────────────────────────────────────────
-- Опубліковане не містить TODO(teacher) (CLAUDE.md) — перевіряє БД, не лише інтерфейс.
create function private.assert_no_teacher_todo(p_lesson_id uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  l public.lessons;
  where_found text;
begin
  select * into l from public.lessons where id = p_lesson_id;
  if concat_ws(' ', l.title, l.textbook_ref::text, l.ktp_ref, l.blocks::text, l.homework::text, l.simplified::text)
     like '%TODO(teacher)%' then
    where_found := 'уроці';
  elsif exists (
    select 1
    from (select distinct r.task_id from private.lesson_task_refs(l.blocks, l.homework, l.simplified, l.quiz_pool) r) r
    join public.tasks t on t.id = r.task_id
    left join public.task_keys k on k.task_id = t.id
    where concat_ws(' ', t.content::text, t.hint, t.feedback::text, t.print_override::text, k.key::text) like '%TODO(teacher)%'
  ) then
    where_found := 'завданнях уроку';
  end if;
  if where_found is not null then
    raise exception 'У % лишилося TODO(teacher) — заповни перед публікацією', where_found
      using errcode = 'check_violation';
  end if;
end;
$$;
revoke execute on function private.assert_no_teacher_todo(uuid) from public;
grant execute on function private.assert_no_teacher_todo(uuid) to authenticated, service_role;

-- Та сама публікація, що й у Фазі 1 (20261014054513), + перевірка TODO(teacher)
create or replace function private.publish_lesson_impl(p_lesson_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.lessons;
  v integer;
  is_service boolean := coalesce((select auth.jwt() ->> 'role'), '') = 'service_role';
begin
  select * into l from public.lessons where id = p_lesson_id for update;
  if not found then
    raise exception 'Урок не знайдено' using errcode = 'no_data_found';
  end if;
  if not is_service and (l.owner_id is distinct from (select auth.uid()) or private.is_anonymous()) then
    raise exception 'Публікувати урок може лише його автор' using errcode = 'insufficient_privilege';
  end if;
  if not l.reviewed_by_teacher then
    raise exception 'Урок не позначено як перевірений вчителем' using errcode = 'check_violation';
  end if;

  perform private.assert_lesson_refs(l.owner_id, l.blocks, l.homework, l.simplified, l.quiz_pool);
  perform private.assert_no_teacher_todo(l.id);

  insert into public.task_versions
    (task_id, version, owner_id, type, level, grp, points, visibility, content, key, hint, feedback,
     print_override, is_demo)
  select t.id, t.version, t.owner_id, t.type, t.level, t.grp, t.points, t.visibility, t.content,
         coalesce(k.key, '{}'::jsonb), t.hint, t.feedback, t.print_override, t.is_demo
  from (select distinct r.task_id from private.lesson_task_refs(l.blocks, l.homework, l.simplified, l.quiz_pool) r) r
  join public.tasks t on t.id = r.task_id
  left join public.task_keys k on k.task_id = t.id
  on conflict (task_id, version) do nothing;

  v := coalesce(l.published_version, 0) + 1;
  update public.lesson_versions set is_current = false where lesson_id = l.id and is_current;

  insert into public.lesson_versions
    (lesson_id, version, is_current, owner_id, school_id, slug, grade, section_id, number, title,
     snapshot, media_ids, video_ids, homework_count, is_demo)
  select
    l.id, v, true, l.owner_id, l.school_id, l.slug, l.grade, l.section_id, l.number, l.title,
    jsonb_build_object(
      'id', l.id,
      'slug', l.slug,
      'grade', l.grade,
      'number', l.number,
      'title', l.title,
      'textbookRef', l.textbook_ref,
      'ktpRef', l.ktp_ref,
      'section', (select jsonb_build_object('number', s.number, 'title', s.title)
                  from public.sections s where s.id = l.section_id),
      'outcomes', coalesce((
        select jsonb_agg(
                 jsonb_build_object(
                   'code', po.code, 'text', po.text,
                   'section', jsonb_build_object('number', s.number, 'title', s.title),
                   'topic', jsonb_build_object('number', tp.number, 'title', tp.title))
                 order by s.number, tp.number, po.code)
        from public.lesson_outcomes lo
        join public.program_outcomes po on po.id = lo.outcome_id
        join public.topics tp on tp.id = po.topic_id
        join public.sections s on s.id = tp.section_id
        where lo.lesson_id = l.id), '[]'),
      'blocks', l.blocks,
      'homework', case when l.homework is null then null
                       else (l.homework - 'taskIds') || jsonb_build_object(
                         'count', jsonb_array_length(coalesce(l.homework -> 'taskIds', '[]'))) end,
      'simplified', case when l.simplified is null then null
                         else (l.simplified - 'homeworkTaskIds') || jsonb_build_object(
                           'homeworkCount', jsonb_array_length(coalesce(l.simplified -> 'homeworkTaskIds', '[]'))) end
    ),
    private.block_uuid_refs(l.blocks, l.simplified, '$[*].mediaId')
      || private.block_uuid_refs(l.blocks, l.simplified, '$[*].items[*].mediaId'),
    private.block_uuid_refs(l.blocks, l.simplified, '$[*].videoId'),
    jsonb_array_length(coalesce(l.homework -> 'taskIds', '[]')),
    l.is_demo;

  insert into public.lesson_version_tasks (lesson_id, lesson_version, role, position, task_id, task_version)
  select l.id, v, r.role, r.pos, r.task_id, t.version
  from private.lesson_task_refs(l.blocks, l.homework, l.simplified, l.quiz_pool) r
  join public.tasks t on t.id = r.task_id;

  update public.lessons set status = 'published', published_version = v where id = l.id;
  return v;
end;
$$;

-- Публікація з конструктора: позначка «перевірено вчителем» і публікація — одним кроком.
-- p_revision — ревізія, яку вчитель переглянув; інша (зміни в іншій вкладці) — конфлікт.
create function public.publish_lesson_reviewed(p_lesson_id uuid, p_revision integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.lessons set reviewed_by_teacher = true
  where id = p_lesson_id and revision = p_revision;
  if not found then
    if exists (select 1 from public.lessons where id = p_lesson_id) then
      perform private.revision_conflict('Урок');
    end if;
    raise exception 'Урок не знайдено' using errcode = 'no_data_found';
  end if;
  return private.publish_lesson_impl(p_lesson_id);
end;
$$;
revoke execute on function public.publish_lesson_reviewed(uuid, integer) from public, anon;
grant execute on function public.publish_lesson_reviewed(uuid, integer) to authenticated;

-- ── Зняття з публікації ──────────────────────────────────────────────────────────────────
-- Гість і учень більше не бачать уроку (немає поточного знімка); версії лишаються. Видані ДЗ
-- (Фаза 4) посилаються на зафіксовану версію й не скасовуються (SPEC 16, Фаза 4).
create function private.unpublish_lesson_impl(p_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.lessons;
begin
  select * into l from public.lessons where id = p_lesson_id for update;
  if not found then
    raise exception 'Урок не знайдено' using errcode = 'no_data_found';
  end if;
  if l.owner_id is distinct from (select auth.uid()) or private.is_anonymous() then
    raise exception 'Знімати з публікації може лише автор уроку' using errcode = 'insufficient_privilege';
  end if;
  update public.lesson_versions set is_current = false where lesson_id = l.id and is_current;
  update public.lessons set status = 'draft' where id = l.id;
end;
$$;
revoke execute on function private.unpublish_lesson_impl(uuid) from public;
grant execute on function private.unpublish_lesson_impl(uuid) to authenticated;

create function public.unpublish_lesson(p_lesson_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.unpublish_lesson_impl(p_lesson_id)
$$;
revoke execute on function public.unpublish_lesson(uuid) from public, anon;
grant execute on function public.unpublish_lesson(uuid) to authenticated;
