-- Фаза 1: доступ до змісту (SPEC 6.2). Таблиці не відкриваються в Data API автоматично, тому —
-- явні GRANT (чи таблиця доступна взагалі) + RLS (які рядки).
--
-- Гість і учень (anon, authenticated) читають ЛИШЕ знімки публікації:
--   lesson_versions (is_current) → lesson_version_tasks (practice) → task_versions (open),
--   media / videos, згадані в поточному знімку; sections і program_outcomes — для всіх.
--   Демо-рядки (is_demo) — лише коли ввімкнено private.settings.show_demo (seed).
-- Вчитель (authenticated з рядком у teachers, не анонім) читає й пише свої робочі копії.
-- Знімки пише лише public.publish_lesson().

alter table public.sections enable row level security;
alter table public.program_outcomes enable row level security;
alter table public.media enable row level security;
alter table public.videos enable row level security;
alter table public.tasks enable row level security;
alter table public.task_keys enable row level security;
alter table public.task_versions enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_outcomes enable row level security;
alter table public.lesson_versions enable row level security;
alter table public.lesson_version_tasks enable row level security;

-- ── GRANT ────────────────────────────────────────────────────────────────────────────────
grant select on public.sections, public.program_outcomes, public.media, public.videos,
  public.task_versions, public.lesson_versions, public.lesson_version_tasks
  to anon, authenticated;

grant select on public.tasks, public.task_keys, public.lessons, public.lesson_outcomes to authenticated;

grant insert, update, delete on public.sections, public.program_outcomes, public.media, public.videos,
  public.tasks, public.task_keys, public.lessons, public.lesson_outcomes
  to authenticated;

-- service_role (локальний імпорт демо, Edge Functions) обходить RLS, але GRANT потрібен однаково
grant all on public.schools, public.teachers, public.sections, public.program_outcomes, public.media,
  public.videos, public.tasks, public.task_keys, public.task_versions, public.lessons,
  public.lesson_outcomes, public.lesson_versions, public.lesson_version_tasks
  to service_role;

-- ── Публічне читання (anon) ──────────────────────────────────────────────────────────────
create policy sections_read_public on public.sections
  for select to anon
  using (not is_demo or (select private.show_demo()));

create policy program_outcomes_read_public on public.program_outcomes
  for select to anon
  using (not archived and (not is_demo or (select private.show_demo())));

create policy lesson_versions_read_public on public.lesson_versions
  for select to anon
  using (is_current and (not is_demo or (select private.show_demo())));

create policy lesson_version_tasks_read_public on public.lesson_version_tasks
  for select to anon
  using (
    role = 'practice'
    and exists (
      select 1 from public.lesson_versions lv
      where lv.lesson_id = lesson_version_tasks.lesson_id
        and lv.version = lesson_version_tasks.lesson_version
        and lv.is_current
    )
  );

create policy task_versions_read_public on public.task_versions
  for select to anon
  using (
    visibility = 'open'
    and exists (
      select 1 from public.lesson_version_tasks lvt
      where lvt.task_id = task_versions.task_id
        and lvt.task_version = task_versions.version
        and lvt.role = 'practice'
    )
  );

create policy media_read_public on public.media
  for select to anon
  using (exists (
    select 1 from public.lesson_versions lv
    where lv.is_current and lv.media_ids @> array[media.id]
  ));

create policy videos_read_public on public.videos
  for select to anon
  using (approved and exists (
    select 1 from public.lesson_versions lv
    where lv.is_current and lv.video_ids @> array[videos.id]
  ));

-- ── authenticated: публічне читання АБО своє (одна політика на дію) ──────────────────────
-- Вчитель — (select private.is_teacher()): є рядок у teachers і не анонім.

create policy sections_read on public.sections
  for select to authenticated
  using (
    (owner_id = (select auth.uid()) and (select private.is_teacher()))
    or not is_demo or (select private.show_demo())
  );

create policy program_outcomes_read on public.program_outcomes
  for select to authenticated
  using (
    (owner_id = (select auth.uid()) and (select private.is_teacher()))
    or (not archived and (not is_demo or (select private.show_demo())))
  );

create policy lesson_versions_read on public.lesson_versions
  for select to authenticated
  using (
    (owner_id = (select auth.uid()) and (select private.is_teacher()))
    or (is_current and (not is_demo or (select private.show_demo())))
  );

create policy lesson_version_tasks_read on public.lesson_version_tasks
  for select to authenticated
  using (exists (
    select 1 from public.lesson_versions lv
    where lv.lesson_id = lesson_version_tasks.lesson_id
      and lv.version = lesson_version_tasks.lesson_version
      and (
        (lv.owner_id = (select auth.uid()) and (select private.is_teacher()))
        or (lv.is_current and lesson_version_tasks.role = 'practice')
      )
  ));

create policy task_versions_read on public.task_versions
  for select to authenticated
  using (
    (owner_id = (select auth.uid()) and (select private.is_teacher()))
    or (
      visibility = 'open'
      and exists (
        select 1 from public.lesson_version_tasks lvt
        where lvt.task_id = task_versions.task_id
          and lvt.task_version = task_versions.version
          and lvt.role = 'practice'
      )
    )
  );

create policy media_read on public.media
  for select to authenticated
  using (
    (owner_id = (select auth.uid()) and (select private.is_teacher()))
    or exists (
      select 1 from public.lesson_versions lv
      where lv.is_current and lv.media_ids @> array[media.id]
    )
  );

create policy videos_read on public.videos
  for select to authenticated
  using (
    (owner_id = (select auth.uid()) and (select private.is_teacher()))
    or (approved and exists (
      select 1 from public.lesson_versions lv
      where lv.is_current and lv.video_ids @> array[videos.id]
    ))
  );

-- Робочі копії — лише власник
create policy tasks_read_own on public.tasks
  for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_teacher()));

create policy task_keys_read_own on public.task_keys
  for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_teacher()));

create policy lessons_read_own on public.lessons
  for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_teacher()));

create policy lesson_outcomes_read_own on public.lesson_outcomes
  for select to authenticated
  using (exists (
    select 1 from public.lessons l
    where l.id = lesson_outcomes.lesson_id and l.owner_id = (select auth.uid())
  ) and (select private.is_teacher()));

-- ── Запис — лише вчитель-власник, у своїй школі ──────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['sections', 'program_outcomes', 'media', 'videos', 'tasks', 'lessons'] loop
    execute format($f$
      create policy %1$s_insert_own on public.%1$s for insert to authenticated
        with check (owner_id = (select auth.uid()) and school_id = (select private.current_school_id())
                    and (select private.is_teacher()));
      create policy %1$s_update_own on public.%1$s for update to authenticated
        using (owner_id = (select auth.uid()) and (select private.is_teacher()))
        with check (owner_id = (select auth.uid()) and school_id = (select private.current_school_id())
                    and (select private.is_teacher()));
      create policy %1$s_delete_own on public.%1$s for delete to authenticated
        using (owner_id = (select auth.uid()) and (select private.is_teacher()));
    $f$, t);
  end loop;
end;
$$;

create policy task_keys_insert_own on public.task_keys
  for insert to authenticated
  with check (
    owner_id = (select auth.uid()) and (select private.is_teacher())
    and exists (select 1 from public.tasks t where t.id = task_keys.task_id and t.owner_id = (select auth.uid()))
  );
create policy task_keys_update_own on public.task_keys
  for update to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_teacher()))
  with check (owner_id = (select auth.uid()) and (select private.is_teacher()));
create policy task_keys_delete_own on public.task_keys
  for delete to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_teacher()));

create policy lesson_outcomes_insert_own on public.lesson_outcomes
  for insert to authenticated
  with check (
    (select private.is_teacher())
    and exists (select 1 from public.lessons l where l.id = lesson_outcomes.lesson_id and l.owner_id = (select auth.uid()))
    and exists (select 1 from public.program_outcomes po where po.id = lesson_outcomes.outcome_id and po.owner_id = (select auth.uid()))
  );
create policy lesson_outcomes_delete_own on public.lesson_outcomes
  for delete to authenticated
  using (
    (select private.is_teacher())
    and exists (select 1 from public.lessons l where l.id = lesson_outcomes.lesson_id and l.owner_id = (select auth.uid()))
  );
