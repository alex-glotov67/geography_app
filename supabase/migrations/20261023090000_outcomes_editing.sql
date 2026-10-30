-- Фаза 3: ручне редагування довідника програми (SPEC 16, Фаза 3; 10.6). Зворотно сумісно:
-- новий стовпець (null), тригери-запобіжники й функції. Код результату — стабільний ідентифікатор
-- (пакети, уроки посилаються на code): не змінюється, не перевикористовується, результат не
-- видаляється — лише архівується.

-- Порядок результатів у темі (перетягування); null — за кодом, після впорядкованих
alter table public.program_outcomes add column position integer check (position >= 0);

-- ── Запобіжники кодів ────────────────────────────────────────────────────────────────────
create function private.guard_outcome()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Результат % не видаляється — його можна лише архівувати (код не перевикористовується)', old.code
      using errcode = 'check_violation';
  end if;
  if (new.code, new.topic_id, new.grade, new.owner_id) is distinct from (old.code, old.topic_id, old.grade, old.owner_id) then
    raise exception 'Код результату % не змінюється: змінюй текст і джерело, а в іншій темі створи новий результат', old.code
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger program_outcomes_guard before update or delete on public.program_outcomes
  for each row execute function private.guard_outcome();

-- Номер теми й розділу — частина кодів: змінювати лише, поки в них немає результатів
create function private.guard_topic_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.number, new.section_id) is distinct from (old.number, old.section_id)
     and exists (select 1 from public.program_outcomes o where o.topic_id = old.id) then
    raise exception 'Номер теми вже є в кодах її результатів — змінити не можна' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger topics_guard_number before update on public.topics
  for each row execute function private.guard_topic_number();

create function private.guard_section_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.number, new.grade) is distinct from (old.number, old.grade)
     and exists (select 1 from public.topics t join public.program_outcomes o on o.topic_id = t.id where t.section_id = old.id) then
    raise exception 'Номер розділу вже є в кодах результатів — змінити не можна' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger sections_guard_number before update on public.sections
  for each row execute function private.guard_section_number();

-- ── Новий результат: наступний номер у темі ──────────────────────────────────────────────
-- max + 1 серед усіх результатів теми, зокрема архівних: номер ніколи не повторюється
-- (видалення заборонене тригером). security invoker — діють політики власника.
create function public.add_outcome(p_topic_id uuid, p_text text, p_source text)
returns table (id uuid, code text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  g smallint;
  sn smallint;
  tn smallint;
  next_n integer;
begin
  select s.grade, s.number, t.number into g, sn, tn
  from public.topics t join public.sections s on s.id = t.section_id
  where t.id = p_topic_id;
  if not found then
    raise exception 'Тему не знайдено' using errcode = 'no_data_found';
  end if;
  select coalesce(max(split_part(o.code, '-', 4)::integer), 0) + 1 into next_n
  from public.program_outcomes o where o.topic_id = p_topic_id;

  return query
  insert into public.program_outcomes (code, grade, topic_id, text, source, position)
  values (
    format('%s-%s-%s-%s', g, sn, tn, lpad(next_n::text, 2, '0')), g, p_topic_id, p_text, p_source,
    (select coalesce(max(o.position), -1) + 1 from public.program_outcomes o where o.topic_id = p_topic_id)
  )
  returning program_outcomes.id, program_outcomes.code;
end;
$$;
revoke execute on function public.add_outcome(uuid, text, text) from public, anon;
grant execute on function public.add_outcome(uuid, text, text) to authenticated;

-- Порядок результатів теми: позиція = індекс у списку (лише результати цієї теми)
create function public.reorder_outcomes(p_topic_id uuid, p_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.program_outcomes o
  set position = x.ord - 1
  from unnest(p_ids) with ordinality as x(id, ord)
  where o.id = x.id and o.topic_id = p_topic_id
$$;
revoke execute on function public.reorder_outcomes(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_outcomes(uuid, uuid[]) to authenticated;
