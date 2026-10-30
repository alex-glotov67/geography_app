-- Ручне редагування довідника (SPEC 16, Фаза 3): коди незмінні й не перевикористовуються,
-- видалення — лише архівування, номери розділу й теми з результатами не змінюються.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into public.schools (id, name) values ('10000000-0000-4000-8000-000000000001', 'Тестова школа');
insert into auth.users (id, aud, role, email) values
  ('10000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 't1@test.invalid'),
  ('10000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 't2@test.invalid');
insert into public.teachers (id, school_id) values
  ('10000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-0000000000a2', '10000000-0000-4000-8000-000000000001');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

insert into public.sections (id, grade, number, title) values ('20000000-0000-4000-8000-000000000001', 8, 2, 'Розділ');
insert into public.topics (id, section_id, number, title) values
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 3, 'Тема'),
  ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 4, 'Порожня тема');

select is((select code from public.add_outcome('21000000-0000-4000-8000-000000000001', 'Перший', 'Програма')), '8-2-3-01',
  'новий результат — номер 01 у порожній темі');
-- Імпорт міг дати код із пропуском: наступний — після найбільшого
insert into public.program_outcomes (code, grade, topic_id, text, source)
  values ('8-2-3-05', 8, '21000000-0000-4000-8000-000000000001', 'З імпорту', 'Програма');
select is((select code from public.add_outcome('21000000-0000-4000-8000-000000000001', 'Другий', 'Програма')), '8-2-3-06',
  'наступний номер — після найбільшого в темі');

update public.program_outcomes set archived = true where code = '8-2-3-06';
select is((select code from public.add_outcome('21000000-0000-4000-8000-000000000001', 'Третій', 'Програма')), '8-2-3-07',
  'архівований номер не перевикористовується');

select lives_ok($$ update public.program_outcomes set text = 'Перший (уточнено)', source = 'Програма, розд. 2' where code = '8-2-3-01' $$,
  'текст і джерело редагуються');
select is((select code from public.program_outcomes where text = 'Перший (уточнено)'), '8-2-3-01', 'код після редагування тексту — той самий');
select throws_ok($$ update public.program_outcomes set code = '8-2-3-99' where code = '8-2-3-01' $$, '23514', null, 'код не змінюється');
select throws_ok(
  $$ update public.program_outcomes set topic_id = '21000000-0000-4000-8000-000000000002' where code = '8-2-3-01' $$,
  '23514', null, 'результат не переноситься в іншу тему (код містить номер теми)'
);
select throws_ok($$ delete from public.program_outcomes where code = '8-2-3-07' $$, '23514', null, 'результат не видаляється');
select throws_ok($$ update public.topics set number = 9 where id = '21000000-0000-4000-8000-000000000001' $$, '23514', null,
  'номер теми з результатами не змінюється');
select throws_ok($$ update public.sections set number = 9 where id = '20000000-0000-4000-8000-000000000001' $$, '23514', null,
  'номер розділу з результатами не змінюється');
select lives_ok($$ update public.topics set title = 'Тема (нова назва)', number = 8 where id = '21000000-0000-4000-8000-000000000002' $$,
  'порожню тему можна перейменувати й перенумерувати');
select lives_ok($$ delete from public.topics where id = '21000000-0000-4000-8000-000000000002' $$, 'порожню тему можна видалити');
select throws_ok($$ delete from public.sections where id = '20000000-0000-4000-8000-000000000001' $$, '23514', null,
  'розділ з результатами не видаляється (каскад упирається в заборону)');

select lives_ok(
  $$ select public.reorder_outcomes('21000000-0000-4000-8000-000000000001',
       array(select id from public.program_outcomes where topic_id = '21000000-0000-4000-8000-000000000001' order by code desc)) $$,
  'порядок результатів у темі'
);
select is((select code from public.program_outcomes where topic_id = '21000000-0000-4000-8000-000000000001' order by position limit 1), '8-2-3-07',
  'перший за порядком — переставлений');

-- Інший вчитель не додає результатів у чужу тему
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select throws_ok($$ select * from public.add_outcome('21000000-0000-4000-8000-000000000001', 'Злам', 'Х') $$, '42501', null,
  'у чужу тему — заборонено (RLS)');

select * from finish();
rollback;
