-- CI (SPEC 15): після міграцій БЕЗ seed не має бути демо-рядків, а показ демо — вимкнений.
-- Запуск: supabase db reset --no-seed && supabase db query --local -f supabase/checks/no-demo-in-migrations.sql
do $$
declare
  t text;
  n bigint;
  total bigint := 0;
begin
  if (select show_demo from private.settings where id) then
    raise exception 'private.settings.show_demo = true після міграцій — демо має вмикати лише seed.sql';
  end if;
  foreach t in array array['sections', 'program_outcomes', 'media', 'videos', 'tasks', 'task_versions',
                           'lessons', 'lesson_versions'] loop
    execute format('select count(*) from public.%I where is_demo', t) into n;
    if n > 0 then
      raise warning 'public.%: % демо-рядків', t, n;
      total := total + n;
    end if;
  end loop;
  if total > 0 then
    raise exception 'Міграції вставили % демо-рядків — демо-дані лише в seed', total;
  end if;
end;
$$;
