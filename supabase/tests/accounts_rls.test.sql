-- RLS акаунтів: класи, учні, журнал дій (SPEC 5, 6.2, 15). Запуск: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

-- ── Фікстури (як postgres) ───────────────────────────────────────────────────────────────
insert into public.schools (id, name) values ('10000000-0000-4000-8000-000000000001', 'Тестова школа');
insert into auth.users (id, aud, role, email, is_anonymous) values
  ('10000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 't1@test.invalid', false),
  ('10000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 't2@test.invalid', false),
  ('10000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', '8t-01@students.invalid', false),
  ('10000000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated', '8t-02@students.invalid', false),
  ('10000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', null, true);
insert into public.teachers (id, school_id) values
  ('10000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-0000000000a2', '10000000-0000-4000-8000-000000000001');

-- ── Вчитель T1 ───────────────────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

select lives_ok(
  $$ insert into public.classes (id, name, grade, school_year, login_prefix)
     values ('50000000-0000-4000-8000-000000000001', '8-Т', 8, '2026-2027', '8t') $$,
  'вчитель створює свій клас (teacher_id і school_id — за замовчуванням)'
);
select throws_ok(
  $$ insert into public.classes (teacher_id, name, grade, school_year, login_prefix)
     values ('10000000-0000-4000-8000-0000000000a2', '8-Ж', 8, '2026-2027', '8zh') $$,
  '42501', null, 'вчитель не створює клас від імені іншого вчителя'
);
select throws_ok(
  $$ insert into public.classes (name, grade, school_year, login_prefix) values ('8-Т', 9, '2026-2027', '9t') $$,
  '23514', null, 'назва класу узгоджена з номером класу'
);

-- Учні з'являються лише через manage-students (сервісна роль) — тут як postgres
reset role;
insert into public.students (id, class_id, school_id, auth_user_id, number, last_name, first_initial, login) values
  ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-0000000000b1', 1, 'Коваль', 'О', '8t-01'),
  ('60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-0000000000b2', 2, 'Мельникʼ', 'І', '8t-02');
insert into public.audit_log (teacher_id, action, details)
  values ('10000000-0000-4000-8000-0000000000a1', 'students.create', '{"count":2}');

select is((select display_name from public.students where number = 1), 'Коваль О.', 'display_name — прізвище й ініціал');
select is(
  (select name_key from public.students where number = 2), 'мельникʼ і',
  'name_key без регістру, апостроф зведено'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

select is((select count(*)::int from public.students), 2, 'вчитель бачить учнів свого класу');
select is((select count(*)::int from public.audit_log), 1, 'вчитель бачить свій журнал дій');
select lives_ok(
  $$ update public.students set simplified_mode = true where number = 1 $$,
  'вчитель вмикає «спрощений режим» учню'
);
select throws_ok(
  $$ update public.students set login = '8t-99' where number = 1 $$,
  '42501', null, 'вчитель не змінює логін напряму (лише через manage-students)'
);
select throws_ok(
  $$ insert into public.students (class_id, school_id, number, last_name, first_initial, login)
     values ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 3, 'Х', 'Х', '8t-03') $$,
  '42501', null, 'з клієнта не можна вставити учня (без акаунта Auth)'
);
select throws_ok('delete from public.students', '42501', null, 'з клієнта не можна видалити учня');
select throws_ok(
  $$ insert into public.audit_log (teacher_id, action) values ('10000000-0000-4000-8000-0000000000a1', 'students.create') $$,
  '42501', null, 'журнал дій не пишеться з клієнта'
);
select lives_ok(
  $$ update public.teachers set login_prefix = 'hl', students_can_change_password = true $$,
  'вчитель змінює свої налаштування'
);
select throws_ok(
  $$ update public.teachers set school_id = gen_random_uuid() $$,
  '42501', null, 'вчитель не переносить себе в іншу школу'
);

-- ── Інший вчитель T2 ─────────────────────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-0000000000a2","role":"authenticated"}';

select is((select count(*)::int from public.classes), 0, 'вчитель не бачить чужих класів');
select is((select count(*)::int from public.students), 0, 'вчитель не бачить чужих учнів');
select is((select count(*)::int from public.audit_log), 0, 'вчитель не бачить чужого журналу');
update public.students set simplified_mode = false where number = 1;
update public.teachers set login_prefix = 'x' where id = '10000000-0000-4000-8000-0000000000a1';

-- ── Учень S1 ─────────────────────────────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-0000000000b1","role":"authenticated"}';

select results_eq(
  'select id from public.students',
  $$ values ('60000000-0000-4000-8000-000000000001'::uuid) $$,
  'учень бачить лише свій рядок'
);
select is((select simplified_mode from public.students), true, 'чужий вчитель не змінив учня; учень бачить свій «спрощений режим»');
select is((select name from public.classes), '8-Т', 'учень бачить свій клас');
select is((select count(*)::int from public.audit_log), 0, 'учень не бачить журналу дій');
update public.students set simplified_mode = false;
select is((select simplified_mode from public.students), true, 'учень не змінює свій рядок');
select throws_ok(
  $$ insert into public.classes (name, grade, school_year, login_prefix) values ('8-Ю', 8, '2026-2027', '8yu') $$,
  '42501', null, 'учень не створює класів'
);
select lives_ok('select public.touch_last_login()', 'учень позначає останній вхід');
select isnt((select last_login_at from public.students), null, 'last_login_at записано');

-- ── Архівований учень S2 ─────────────────────────────────────────────────────────────────
reset role;
update public.students set archived = true where number = 2;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-0000000000b2","role":"authenticated"}';
select is((select count(*)::int from public.students), 0, 'архівований учень не бачить навіть свого рядка');

-- ── Анонімний користувач (гість квізу) ───────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-0000000000c1","role":"authenticated","is_anonymous":true}';
select is((select count(*)::int from public.students), 0, 'анонім не бачить учнів');
select is((select count(*)::int from public.classes), 0, 'анонім не бачить класів');
select throws_ok(
  $$ insert into public.classes (name, grade, school_year, login_prefix) values ('8-Я', 8, '2026-2027', '8ya') $$,
  '42501', null, 'анонім не створює класів'
);

-- ── Гість без входу (anon) ───────────────────────────────────────────────────────────────
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok('select * from public.students', '42501', null, 'гість не має доступу до учнів');

-- ── Перевірки як postgres ────────────────────────────────────────────────────────────────
reset role;
select is(
  (select login_prefix from public.teachers where id = '10000000-0000-4000-8000-0000000000a1'), 'hl',
  'чужий вчитель не змінив налаштувань T1'
);

select * from finish();
rollback;
