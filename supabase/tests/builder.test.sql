-- Конструктор (SPEC 10): ревізії й конфлікти, збереження завдання з ключем, публікація з
-- перевіркою TODO(teacher), сталий slug, task_usage, зняття з публікації. Запуск: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

update private.settings set show_demo = false where id;
insert into public.schools (id, name) values ('10000000-0000-4000-8000-000000000001', 'Тестова школа');
insert into auth.users (id, aud, role, email) values
  ('10000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 't1@test.invalid'),
  ('10000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 't2@test.invalid'),
  ('10000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'student@test.invalid');
insert into public.teachers (id, school_id) values
  ('10000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-0000000000a2', '10000000-0000-4000-8000-000000000001');

create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated, anon;

-- ── Вчитель T1: завдання ─────────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

insert into ids select 'task', id from public.save_task(null, null,
  '{"type":"single_choice","level":"base","grp":"ГР1","points":1,"content":{"prompt":"TODO(teacher): питання"},"visibility":"open"}',
  '{"correct":["a"]}');
select results_eq(
  $$ select revision, version from public.tasks where id = (select id from ids where name = 'task') $$,
  $$ values (1, 1) $$, 'нове завдання: ревізія 1, версія 1'
);
select is((select key from public.task_keys where task_id = (select id from ids where name = 'task')), '{"correct":["a"]}'::jsonb,
  'ключ збережено тією самою транзакцією');
select throws_ok(
  $$ select * from public.save_task((select id from ids where name = 'task'), 7,
       '{"type":"single_choice","level":"base","grp":"ГР1","content":{"prompt":"x"},"visibility":"open"}', '{"correct":["a"]}') $$,
  '40001', null, 'застаріла ревізія завдання — конфлікт'
);
select results_eq(
  $$ select revision, version from public.save_task((select id from ids where name = 'task'), 1,
       '{"type":"single_choice","level":"base","grp":"ГР1","content":{"prompt":"TODO(teacher): питання"},"visibility":"open"}', '{"correct":["b"]}') $$,
  $$ values (2, 1) $$, 'змінився лише ключ — ревізія зросла; до публікації версія та сама'
);
update public.tasks set revision = 100 where id = (select id from ids where name = 'task');
select is((select revision from public.tasks where id = (select id from ids where name = 'task')), 2, 'клієнт не підробляє ревізію');

-- ── Урок ─────────────────────────────────────────────────────────────────────────────────
with l as (insert into public.lessons (slug, grade, title) values ('rel-test', 8, 'Урок') returning id)
insert into ids select 'lesson', id from l;
insert into public.sections (id, grade, number, title) values ('20000000-0000-4000-8000-000000000001', 8, 1, 'Розділ');
insert into public.topics (id, section_id, number, title) values ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1, 'Тема');
insert into public.program_outcomes (id, code, grade, topic_id, text, source) values
  ('22000000-0000-4000-8000-000000000001', '8-1-1-01', 8, '21000000-0000-4000-8000-000000000001', 'Р1', 'Д'),
  ('22000000-0000-4000-8000-000000000002', '8-1-1-02', 8, '21000000-0000-4000-8000-000000000001', 'Р2', 'Д');

select is(
  public.save_lesson((select id from ids where name = 'lesson'), 1,
    jsonb_build_object('title', 'Рельєф', 'blocks', jsonb_build_array(jsonb_build_object('id', 'b1', 'type', 'practice',
      'taskIds', jsonb_build_array((select id from ids where name = 'task'))))),
    array['22000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002']::uuid[]),
  2, 'збереження уроку: ревізія 2'
);
select is((select count(*)::int from public.lesson_outcomes where lesson_id = (select id from ids where name = 'lesson')), 2,
  'результати програми — разом з уроком');
select is(
  public.save_lesson((select id from ids where name = 'lesson'), 2, '{}', array['22000000-0000-4000-8000-000000000002']::uuid[]),
  2, 'лише результати — ревізія не змінюється'
);
select is((select count(*)::int from public.lesson_outcomes where lesson_id = (select id from ids where name = 'lesson')), 1,
  'прибраний результат видалено');
select throws_ok(
  $$ select public.save_lesson((select id from ids where name = 'lesson'), 1, '{"title":"Інша вкладка"}') $$,
  '40001', null, 'застаріла ревізія уроку — конфлікт'
);
select is(public.save_lesson((select id from ids where name = 'lesson'), null, '{"title":"Рельєф України"}'), 3,
  '«Перезаписати моїми змінями» — без перевірки ревізії');
select is((select count(*)::int from public.task_usage where task_id = (select id from ids where name = 'task')), 1,
  'task_usage: завдання в тренуванні уроку');

-- ── Публікація ───────────────────────────────────────────────────────────────────────────
select throws_ok(
  $$ select public.publish_lesson_reviewed((select id from ids where name = 'lesson'), 2) $$,
  '40001', null, 'публікація не тієї ревізії, яку переглянув вчитель, — конфлікт'
);
select throws_like(
  $$ select public.publish_lesson_reviewed((select id from ids where name = 'lesson'), 3) $$,
  '%TODO(teacher)%', 'TODO(teacher) у завданні блокує публікацію'
);
select * from public.save_task((select id from ids where name = 'task'), 2,
  '{"type":"single_choice","level":"base","grp":"ГР1","content":{"prompt":"Яка форма рельєфу?"},"visibility":"open"}', '{"correct":["b"]}');
select is(public.publish_lesson_reviewed((select id from ids where name = 'lesson'), 3), 1, 'перевірений урок опубліковано: версія 1');
select results_eq(
  $$ select reviewed_by_teacher, status, revision from public.lessons where id = (select id from ids where name = 'lesson') $$,
  $$ values (true, 'published', 3) $$, 'позначка перевірки — разом з публікацією; ревізія не змінилась'
);
select is((select published from public.task_usage where task_id = (select id from ids where name = 'task')), true,
  'task_usage: завдання в опублікованому уроці');
select is(
  (select version from public.save_task((select id from ids where name = 'task'), 3,
     '{"type":"single_choice","level":"base","grp":"ГР1","content":{"prompt":"Нове формулювання"},"visibility":"open"}', '{"correct":["b"]}')),
  2, 'правка опублікованого завдання — нова версія'
);
select is(
  (select task_version from public.lesson_version_tasks where lesson_id = (select id from ids where name = 'lesson')), 1,
  'опублікований урок і далі показує версію 1 до повторної публікації'
);
select throws_ok(
  $$ select public.save_lesson((select id from ids where name = 'lesson'), null, '{"slug":"inshyi"}') $$,
  '23514', null, 'адресу опублікованого уроку змінити не можна'
);

-- ── Інший вчитель T2 ─────────────────────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select throws_ok(
  $$ select * from public.save_task((select id from ids where name = 'task'), null,
       '{"type":"single_choice","level":"base","grp":"ГР1","content":{"prompt":"злам"},"visibility":"open"}', '{"correct":["a"]}') $$,
  'P0002', null, 'чужий вчитель не змінює завдання'
);
select throws_ok(
  $$ select public.save_lesson((select id from ids where name = 'lesson'), null, '{"title":"злам"}') $$,
  'P0002', null, 'чужий вчитель не змінює урок'
);
select throws_ok(
  $$ select public.unpublish_lesson((select id from ids where name = 'lesson')) $$,
  '42501', null, 'чужий вчитель не знімає урок з публікації'
);
select is((select count(*)::int from public.task_usage), 0, 'task_usage чужих уроків не видно');

-- ── Учень і гість ────────────────────────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select throws_ok(
  $$ select * from public.save_task(null, null,
       '{"type":"single_choice","level":"base","grp":"ГР1","content":{"prompt":"x"},"visibility":"open"}', '{"correct":["a"]}') $$,
  '42501', null, 'не-вчитель не створює завдань'
);
select is((select count(*)::int from public.lesson_versions where slug = 'rel-test'), 1, 'учень бачить опублікований урок');
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select public.save_lesson(gen_random_uuid(), null, '{}') $$, '42501', null, 'гість не викликає save_lesson');

-- ── Зняття з публікації і повторна публікація ────────────────────────────────────────────
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select lives_ok($$ select public.unpublish_lesson((select id from ids where name = 'lesson')) $$, 'автор знімає урок з публікації');
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is((select count(*)::int from public.lesson_versions where slug = 'rel-test'), 0, 'після зняття гість уроку не бачить');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is(public.publish_lesson_reviewed((select id from ids where name = 'lesson'), 3), 2, 'повторна публікація — версія 2');

select * from finish();
rollback;
