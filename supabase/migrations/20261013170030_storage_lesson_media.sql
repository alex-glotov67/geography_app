-- Фаза 1: бакет зображень і PDF уроків (SPEC 6.2, 10.5).
-- Читання публічне (картинки в опублікованих уроках віддаються за прямим URL); запис — лише
-- вчитель у свою теку <owner_id>/…. Ліміт 10 МБ і типи — на рівні бакета.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-media', 'lesson-media', true, 10485760,
  array['image/webp', 'image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf']
)
on conflict (id) do nothing;

-- Upsert у Storage вимагає INSERT + SELECT + UPDATE (скіл Supabase), тож усі три — для власника
create policy lesson_media_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'lesson-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_teacher())
  );

create policy lesson_media_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'lesson-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_teacher())
  );

create policy lesson_media_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'lesson-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_teacher())
  )
  with check (
    bucket_id = 'lesson-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_teacher())
  );

create policy lesson_media_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'lesson-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_teacher())
  );
