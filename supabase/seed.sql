-- Демо-дані для локального Supabase і CI (`supabase db reset`). У prod не застосовується.
-- Лише вигадані дані з is_demo = true; навчальний зміст — у seed/*.geo.zip і seed/demo-outcomes.csv
-- (імпорт: npm run seed). SPEC 6.1: демо показується лише тут — show_demo вмикається тільки в seed.

update private.settings set show_demo = true where id;

-- Демо-школа і демо-вчитель. Вхід (лише локально й у CI): demo-teacher@example.invalid / demo-teacher-2026.
-- На prod вчителя створюють вручну (docs/setup.md, розділ 7), реєстрація там вимкнена.
insert into public.schools (id, name)
values ('00000000-0000-4000-8000-000000000001', 'ДЕМО: школа');

-- Порожні рядки в *_token — GoTrue не приймає NULL у цих стовпцях при вході паролем
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'demo-teacher@example.invalid', extensions.crypt('demo-teacher-2026', extensions.gen_salt('bf')), now(),
  '', '', '', '',
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);
insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
values (
  gen_random_uuid(), '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'email',
  '{"sub":"00000000-0000-4000-8000-0000000000a1","email":"demo-teacher@example.invalid","email_verified":true}',
  now(), now(), now()
);

insert into public.teachers (id, school_id, display_name)
values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 'ДЕМО: вчитель');
