-- Демо-дані для локального Supabase і CI (`supabase db reset`). У prod не застосовується.
-- Лише вигадані дані з is_demo = true; навчальний зміст — у seed/*.geo.zip і seed/demo-outcomes.csv
-- (імпорт: npm run seed). SPEC 6.1: демо показується лише тут — show_demo вмикається тільки в seed.

update private.settings set show_demo = true where id;

-- Демо-школа і демо-вчитель (вхід вчителя — Фаза 2; тут лише власник демо-змісту)
insert into public.schools (id, name)
values ('00000000-0000-4000-8000-000000000001', 'ДЕМО: школа');

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'demo-teacher@example.invalid', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

insert into public.teachers (id, school_id, display_name)
values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 'ДЕМО: вчитель');
