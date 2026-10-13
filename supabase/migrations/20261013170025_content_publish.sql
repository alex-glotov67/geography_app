-- Фаза 1: посилання уроку на завдання і публікація (SPEC 6.1).
-- Формат блоків — zod-схеми в supabase/functions/_shared/schemas/blocks.ts:
--   тренування  { "type": "practice", "taskIds": [uuid, …] }
--   зображення  { "type": "image", "mediaId": uuid },  файл { "type": "file", "mediaId": uuid }
--   галерея     { "type": "gallery", "items": [{ "mediaId": uuid }, …] }
--   відео       { "type": "video", "videoId": uuid }
-- ДЗ: lessons.homework = { "taskIds": [uuid, …] }; спрощений режим: lessons.simplified =
--   { "blocks": [...], "homeworkTaskIds": [uuid, …] }; квіз-пул: lessons.quiz_pool.

-- Усі посилання уроку на завдання: роль, порядок, id (без дублів у межах ролі)
create function private.lesson_task_refs(
  p_blocks jsonb, p_homework jsonb, p_simplified jsonb, p_quiz_pool uuid[]
)
returns table (role text, pos smallint, task_id uuid)
language sql
immutable
set search_path = ''
as $$
  with raw as (
    select 'practice'::text as role, 1 as src, o.ord, o.id
    from jsonb_path_query(coalesce(p_blocks, '[]'), '$[*] ? (@.type == "practice").taskIds[*]')
      with ordinality as o (id, ord)
    union all
    select 'practice', 2, o.ord, o.id
    from jsonb_path_query(coalesce(p_simplified -> 'blocks', '[]'), '$[*] ? (@.type == "practice").taskIds[*]')
      with ordinality as o (id, ord)
    union all
    select 'homework', 1, o.ord, o.id
    from jsonb_array_elements(coalesce(p_homework -> 'taskIds', '[]')) with ordinality as o (id, ord)
    union all
    select 'homework', 2, o.ord, o.id
    from jsonb_array_elements(coalesce(p_simplified -> 'homeworkTaskIds', '[]')) with ordinality as o (id, ord)
    union all
    select 'quiz_pool', 1, o.ord, to_jsonb(o.id)
    from unnest(coalesce(p_quiz_pool, '{}')) with ordinality as o (id, ord)
  ),
  typed as (
    select distinct on (role, (id #>> '{}')::uuid) role, src, ord, (id #>> '{}')::uuid as task_id
    from raw
    order by role, (id #>> '{}')::uuid, src, ord
  )
  select role, (row_number() over (partition by role order by src, ord) - 1)::smallint, task_id
  from typed
$$;

-- Перевірка: тренування — лише open, ДЗ і квіз-пул — лише secure, одне завдання не буває в обох;
-- усі завдання — того самого вчителя (SPEC 6.1)
create function private.assert_lesson_refs(
  p_owner uuid, p_blocks jsonb, p_homework jsonb, p_simplified jsonb, p_quiz_pool uuid[]
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  bad record;
begin
  for bad in
    select r.role, r.task_id, t.visibility, t.owner_id
    from private.lesson_task_refs(p_blocks, p_homework, p_simplified, p_quiz_pool) r
    left join public.tasks t on t.id = r.task_id
    where t.id is null
       or t.owner_id <> p_owner
       or (r.role = 'practice' and t.visibility <> 'open')
       or (r.role <> 'practice' and t.visibility <> 'secure')
  loop
    if bad.visibility is null then
      raise exception 'Завдання % не знайдено в банку', bad.task_id using errcode = 'foreign_key_violation';
    elsif bad.owner_id <> p_owner then
      raise exception 'Завдання % належить іншому вчителю', bad.task_id using errcode = 'check_violation';
    elsif bad.role = 'practice' then
      raise exception 'У тренуванні лише відкриті завдання; % — захищене', bad.task_id using errcode = 'check_violation';
    else
      raise exception 'У ДЗ і квіз-пулі лише захищені завдання; % — відкрите', bad.task_id using errcode = 'check_violation';
    end if;
  end loop;
end;
$$;

create function private.check_lesson_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.assert_lesson_refs(new.owner_id, new.blocks, new.homework, new.simplified, new.quiz_pool);
  return new;
end;
$$;
create trigger lessons_check_refs
  before insert or update of owner_id, blocks, homework, simplified, quiz_pool on public.lessons
  for each row execute function private.check_lesson_refs();

-- id медіа й відео з блоків (основних і спрощених)
create function private.block_uuid_refs(p_blocks jsonb, p_simplified jsonb, p_path jsonpath)
returns uuid[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(distinct (v #>> '{}')::uuid), '{}')
  from (
    select jsonb_path_query(coalesce(p_blocks, '[]'), p_path) as v
    union all
    select jsonb_path_query(coalesce(p_simplified -> 'blocks', '[]'), p_path)
  ) s
$$;

-- ── Публікація ───────────────────────────────────────────────────────────────────────────
-- Пише в знімки (lesson_versions, lesson_version_tasks, task_versions), куди ролі API доступу на
-- запис не мають, тому security definer у закритій схемі; виклик — лише через public.publish_lesson.
-- Право перевіряється явно: автор уроку (не анонім) або service_role (локальний імпорт демо).
create function private.publish_lesson_impl(p_lesson_id uuid)
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

  -- Фіксуємо поточні версії всіх завдань уроку (якщо ще не зафіксовані)
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
        select jsonb_agg(jsonb_build_object('code', po.code, 'grp', po.grp, 'text', po.text) order by po.code)
        from public.lesson_outcomes lo join public.program_outcomes po on po.id = lo.outcome_id
        where lo.lesson_id = l.id), '[]'),
      'blocks', l.blocks,
      -- ДЗ і квіз-пул у знімку — без id завдань: гість бачить лише кількість (SPEC 6.2)
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

revoke execute on function private.publish_lesson_impl(uuid) from public;
grant execute on function private.publish_lesson_impl(uuid) to authenticated, service_role;

-- Точка виклику з клієнта (RPC). Сама нічого не обходить: перевірки — у publish_lesson_impl.
create function public.publish_lesson(p_lesson_id uuid)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.publish_lesson_impl(p_lesson_id)
$$;
revoke execute on function public.publish_lesson(uuid) from public, anon;
grant execute on function public.publish_lesson(uuid) to authenticated, service_role;

-- Допоміжні функції — лише для тригерів і публікації
revoke execute on function private.lesson_task_refs(jsonb, jsonb, jsonb, uuid[]) from public;
revoke execute on function private.assert_lesson_refs(uuid, jsonb, jsonb, jsonb, uuid[]) from public;
revoke execute on function private.block_uuid_refs(jsonb, jsonb, jsonpath) from public;
grant execute on function private.lesson_task_refs(jsonb, jsonb, jsonb, uuid[]) to authenticated, service_role;
grant execute on function private.assert_lesson_refs(uuid, jsonb, jsonb, jsonb, uuid[]) to authenticated, service_role;
grant execute on function private.block_uuid_refs(jsonb, jsonb, jsonpath) to authenticated, service_role;
