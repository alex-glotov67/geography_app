-- RLS і версії змісту (SPEC 6.1, 6.2, 15). Запуск: npx supabase test db
-- Кожен тест — у транзакції з rollback; ролі перемикаються через set local role + JWT-claims.
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

-- ── Фікстури (як postgres) ───────────────────────────────────────────────────────────────
update private.settings set show_demo = false where id;

insert into public.schools (id, name) values ('10000000-0000-4000-8000-000000000001', 'Тестова школа');
insert into auth.users (id, aud, role, email) values
  ('10000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 't1@test.invalid'),
  ('10000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 't2@test.invalid'),
  ('10000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'student@test.invalid');
insert into public.teachers (id, school_id) values
  ('10000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-0000000000a2', '10000000-0000-4000-8000-000000000001');

-- Вчитель T1 створює зміст через API-роль (перевіряємо і політики запису)
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

insert into public.sections (id, grade, number, title)
  values ('20000000-0000-4000-8000-000000000001', 8, 1, 'Розділ тест');
insert into public.topics (id, section_id, number, title)
  values ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1, 'Тема тест');
insert into public.program_outcomes (code, grade, topic_id, text, source)
  values ('8-1-1-01', 8, '21000000-0000-4000-8000-000000000001', 'Результат тест', 'Тест');
insert into public.tasks (id, type, level, grp, content, visibility) values
  ('30000000-0000-4000-8000-00000000000a', 'single_choice', 'base', 'ГР1', '{"prompt":"Відкрите v1"}', 'open'),
  ('30000000-0000-4000-8000-00000000000b', 'single_choice', 'base', 'ГР1', '{"prompt":"Захищене"}', 'secure');
insert into public.task_keys (task_id, key) values
  ('30000000-0000-4000-8000-00000000000a', '{"correct":["a"]}'),
  ('30000000-0000-4000-8000-00000000000b', '{"correct":["b"]}');
insert into public.lessons (id, slug, grade, section_id, number, title, blocks, homework, reviewed_by_teacher) values
  ('40000000-0000-4000-8000-000000000001', 'test-lesson', 8, '20000000-0000-4000-8000-000000000001', 1, 'Урок тест',
   '[{"id":"b1","type":"practice","taskIds":["30000000-0000-4000-8000-00000000000a"]}]',
   '{"taskIds":["30000000-0000-4000-8000-00000000000b"]}', true),
  ('40000000-0000-4000-8000-000000000002', 'draft-lesson', 8, null, 2, 'Чернетка', '[]', null, false);

select is(public.publish_lesson('40000000-0000-4000-8000-000000000001'), 1, 'T1 публікує свій урок: версія 1');

-- ── Гість (anon) ─────────────────────────────────────────────────────────────────────────
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is((select count(*)::int from public.lesson_versions), 1, 'гість бачить лише поточну публікацію');
select is((select count(*)::int from public.lesson_versions where slug = 'draft-lesson'), 0, 'гість не бачить чернетку');
select throws_ok('select * from public.lessons', '42501', null, 'гість не читає робочі копії уроків');
select throws_ok('select * from public.tasks', '42501', null, 'гість не читає банк завдань');
select throws_ok('select * from public.task_keys', '42501', null, 'гість не читає ключі робочих копій');
select results_eq(
  'select task_id from public.task_versions',
  $$ values ('30000000-0000-4000-8000-00000000000a'::uuid) $$,
  'гість бачить лише відкрите завдання з тренування'
);
select is((select count(*)::int from public.task_versions where visibility = 'secure'), 0, 'гість не бачить secure-знімків (ні змісту, ні ключа)');
select is((select count(*)::int from public.lesson_version_tasks where role <> 'practice'), 0, 'гість не бачить посилань ДЗ і квіз-пулу');
select is(
  (select snapshot -> 'homework' from public.lesson_versions),
  '{"count": 1}'::jsonb,
  'у знімку ДЗ — лише кількість, без id завдань'
);
select throws_ok(
  $$ insert into public.sections (grade, number, title) values (8, 9, 'x') $$,
  '42501', null, 'гість не пише в довідник'
);
select is((select count(*)::int from public.topics), 1, 'гість бачить теми довідника');
select throws_ok(
  $$ insert into public.topics (section_id, number, title) values ('20000000-0000-4000-8000-000000000001', 9, 'x') $$,
  '42501', null, 'гість не пише теми'
);

-- ── Учень / будь-який не-вчитель ────────────────────────────────────────────────────────
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-0000000000b1","role":"authenticated"}';

select is((select count(*)::int from public.lesson_versions), 1, 'учень бачить поточну публікацію');
select is((select count(*)::int from public.tasks), 0, 'учень не бачить банк завдань');
select is((select count(*)::int from public.task_versions where visibility = 'secure'), 0, 'учень не бачить secure-знімків');
select throws_ok(
  $$ insert into public.sections (grade, number, title) values (8, 9, 'x') $$,
  '42501', null, 'учень не пише в довідник (RLS)'
);
select throws_ok(
  $$ select public.publish_lesson('40000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'учень не публікує'
);

-- ── Анонімний користувач (гість квізу) з id вчителя не стає вчителем ────────────────────
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-0000000000a1","role":"authenticated","is_anonymous":true}';
select is((select count(*)::int from public.tasks), 0, 'анонімний користувач не читає банк навіть з id вчителя');
select is((select count(*)::int from public.task_keys), 0, 'анонімний користувач не читає ключі');

-- ── Інший вчитель T2 ─────────────────────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select is((select count(*)::int from public.tasks), 0, 'T2 не бачить завдань T1');
select is((select count(*)::int from public.lessons), 0, 'T2 не бачить уроків T1');
select is((select count(*)::int from public.task_versions where visibility = 'secure'), 0, 'T2 не бачить secure-знімків T1');
select throws_ok(
  $$ insert into public.topics (section_id, number, title) values ('20000000-0000-4000-8000-000000000001', 5, 'чужа') $$,
  '42501', null, 'T2 не додає тему в розділ T1'
);
select throws_ok(
  $$ insert into public.program_outcomes (code, grade, topic_id, text, source)
     values ('8-1-1-09', 8, '21000000-0000-4000-8000-000000000001', 'чужий', 'x') $$,
  '42501', null, 'T2 не додає результат у тему T1'
);
update public.lessons set title = 'зламано' where id = '40000000-0000-4000-8000-000000000001';
select throws_ok(
  $$ select public.publish_lesson('40000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'T2 не публікує урок T1'
);

-- ── T1: версії, тригери, обмеження ───────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is((select title from public.lessons where id = '40000000-0000-4000-8000-000000000001'), 'Урок тест', 'спроба T2 змінити урок T1 нічого не змінила');

update public.tasks set content = '{"prompt":"Відкрите v2"}' where id = '30000000-0000-4000-8000-00000000000a';
select is((select version from public.tasks where id = '30000000-0000-4000-8000-00000000000a'), 2,
  'правка зафіксованого завдання створює версію 2');

update public.lessons set title = 'Чернетка правиться' where id = '40000000-0000-4000-8000-000000000002';
update public.tasks set hint = 'ще до публікації' where id = '30000000-0000-4000-8000-00000000000b';
-- secure-завдання B уже зафіксоване в публікації (ДЗ) → теж нова версія
select is((select version from public.tasks where id = '30000000-0000-4000-8000-00000000000b'), 2,
  'secure-завдання з публікації теж отримує нову версію');

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is((select content ->> 'prompt' from public.task_versions), 'Відкрите v1',
  'опублікований урок не змінюється від правки банку до повторної публікації');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is(public.publish_lesson('40000000-0000-4000-8000-000000000001'), 2, 'повторна публікація: версія 2');

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select results_eq(
  $$ select content ->> 'prompt' from public.task_versions $$,
  $$ values ('Відкрите v2') $$,
  'після повторної публікації гість бачить нову версію і лише її'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select throws_ok(
  $$ update public.lessons set blocks = '[{"id":"b","type":"practice","taskIds":["30000000-0000-4000-8000-00000000000b"]}]'
     where id = '40000000-0000-4000-8000-000000000002' $$,
  '23514', null, 'у тренуванні не можна secure-завдання'
);
select throws_ok(
  $$ update public.tasks set visibility = 'secure' where id = '30000000-0000-4000-8000-00000000000a' $$,
  '23514', null, 'open → secure для опублікованого завдання заборонено'
);
select throws_ok(
  $$ insert into public.tasks (type, level, grp, content, visibility) values ('short_text', 'high', 'ГР3', '{}', 'open') $$,
  '23514', null, 'short_text лише secure'
);

-- ── Демо-зміст (SPEC 6.1): на prod (show_demo = false) не показується ───────────────────
insert into public.lessons (id, slug, grade, title, reviewed_by_teacher, is_demo)
  values ('40000000-0000-4000-8000-0000000000d1', 'demo-lesson', 8, 'ДЕМО', true, true);
select public.publish_lesson('40000000-0000-4000-8000-0000000000d1');
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is((select count(*)::int from public.lesson_versions where is_demo), 0, 'без show_demo гість не бачить демо-уроків');
reset role;
update private.settings set show_demo = true where id;
set local role anon;
select is((select count(*)::int from public.lesson_versions where slug = 'demo-lesson'), 1, 'з show_demo (seed) демо-урок видно');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select throws_ok(
  $$ insert into public.program_outcomes (code, grade, topic_id, text, source)
     values ('8-1-ГР1-02', 8, '21000000-0000-4000-8000-000000000001', 'старий код', 'x') $$,
  '23514', null, 'код результату — клас-розділ-тема-номер, без ГР'
);
select lives_ok(
  $$ insert into public.sections (grade, number, title) values (8, 0, 'Вступ') $$,
  'вступ — розділ 0'
);

select * from finish();
rollback;
