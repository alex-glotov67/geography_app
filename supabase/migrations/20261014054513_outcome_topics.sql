-- Довідник програми: результати прив'язані до ТЕМИ в межах розділу (SPEC 6.1, 6.2, 10.6).
-- ГР більше не частина довідника — лишається лише тегом завдань (tasks.grp).
-- Код результату: клас-розділ-тема-номер, напр. 8-2-3-07; вступ — розділ 0, тема 0.

-- Безпечно лише для порожнього довідника (на prod він ще порожній: вчителів і імпорту ще немає).
-- Перетворити старі рядки неможливо — у них немає теми.
do $$
begin
  if exists (select 1 from public.program_outcomes) then
    raise exception 'program_outcomes не порожня: перед цією міграцією вивантаж довідник і очисти таблицю, '
      'потім імпортуй його у форматі з темами (SPEC 10.6)';
  end if;
end;
$$;

-- Вступ — розділ 0
alter table public.sections drop constraint sections_number_check;
alter table public.sections add constraint sections_number_check check (number >= 0);

-- ── Теми в межах розділу ─────────────────────────────────────────────────────────────────
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.teachers (id),
  school_id uuid not null default private.current_school_id() references public.schools (id),
  section_id uuid not null references public.sections (id) on delete cascade,
  number smallint not null check (number >= 0), -- вступ — тема 0
  title text not null check (length(btrim(title)) > 0),
  is_demo boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (section_id, number)
);
create index topics_owner_id_idx on public.topics (owner_id);
create index topics_school_id_idx on public.topics (school_id);
create trigger topics_touch before update on public.topics
  for each row execute function private.touch_updated_at();

-- ── Результати: тема замість ГР і розділу ────────────────────────────────────────────────
alter table public.program_outcomes drop constraint program_outcomes_section_id_grp_text_norm_key;
alter table public.program_outcomes drop constraint program_outcomes_code_check;
alter table public.program_outcomes drop column grp;
alter table public.program_outcomes drop column section_id;
alter table public.program_outcomes
  add column topic_id uuid not null references public.topics (id) on delete cascade;
alter table public.program_outcomes
  add constraint program_outcomes_code_check check (code ~ '^[6-9]-[0-9]+-[0-9]+-[0-9]{2,}$');
-- Той самий результат двічі в одній темі — ні (повторний імпорт без коду зіставляється за текстом)
alter table public.program_outcomes add constraint program_outcomes_topic_text_key unique (topic_id, text_norm);

-- ── Доступ (як у sections): читання — для всіх, запис — вчитель-власник у своєму розділі ─
alter table public.topics enable row level security;
grant select on public.topics to anon, authenticated;
grant insert, update, delete on public.topics to authenticated;
grant all on public.topics to service_role;

create policy topics_read_public on public.topics
  for select to anon
  using (not is_demo or (select private.show_demo()));

create policy topics_read on public.topics
  for select to authenticated
  using (
    (owner_id = (select auth.uid()) and (select private.is_teacher()))
    or not is_demo or (select private.show_demo())
  );

create policy topics_insert_own on public.topics
  for insert to authenticated
  with check (
    owner_id = (select auth.uid()) and school_id = (select private.current_school_id())
    and (select private.is_teacher())
    and exists (select 1 from public.sections s where s.id = topics.section_id and s.owner_id = (select auth.uid()))
  );

create policy topics_update_own on public.topics
  for update to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_teacher()))
  with check (
    owner_id = (select auth.uid()) and school_id = (select private.current_school_id())
    and (select private.is_teacher())
    and exists (select 1 from public.sections s where s.id = topics.section_id and s.owner_id = (select auth.uid()))
  );

create policy topics_delete_own on public.topics
  for delete to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_teacher()));

-- Результат — лише в темі того самого вчителя
create policy program_outcomes_topic_own on public.program_outcomes
  as restrictive for insert to authenticated
  with check (exists (select 1 from public.topics t where t.id = program_outcomes.topic_id and t.owner_id = (select auth.uid())));
create policy program_outcomes_topic_own_update on public.program_outcomes
  as restrictive for update to authenticated
  using (true)
  with check (exists (select 1 from public.topics t where t.id = program_outcomes.topic_id and t.owner_id = (select auth.uid())));

-- ── Знімок публікації: результати з розділом і темою, без ГР ────────────────────────────
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
      -- Результати уроку з довідника: код, текст, розділ і тема (ГР — лише тег завдань)
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
