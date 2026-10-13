-- Фаза 1: таблиці змісту (SPEC 6.1, 6.2).
-- Робочі копії вчителя: sections, program_outcomes, lessons, lesson_outcomes, tasks, task_keys, media, videos.
-- Знімки публікації (їх читають гість і учень): lesson_versions, lesson_version_tasks, task_versions —
-- пише лише public.publish_lesson() (міграція content_publish).
-- У всіх таблицях: owner_id і school_id (SPEC 5, підготовка до кількох вчителів), is_demo (SPEC 6.1).

-- ── Довідник програми ────────────────────────────────────────────────────────────────────
create table public.sections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.teachers (id),
  school_id uuid not null default private.current_school_id() references public.schools (id),
  grade smallint not null check (grade between 6 and 9),
  number smallint not null check (number >= 1),
  title text not null check (length(btrim(title)) > 0),
  is_demo boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (owner_id, grade, number)
);
create index sections_school_id_idx on public.sections (school_id);

create table public.program_outcomes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.teachers (id),
  school_id uuid not null default private.current_school_id() references public.schools (id),
  -- Стабільний код результату: клас-№ розділу-ГР-порядковий номер (SPEC 6.1, 10.6)
  code text not null check (code ~ '^[6-9]-[1-9][0-9]*-ГР[1-3]-[0-9]{2,}$'),
  grade smallint not null check (grade between 6 and 9),
  section_id uuid not null references public.sections (id) on delete cascade,
  grp text not null check (grp in ('ГР1', 'ГР2', 'ГР3')),
  text text not null check (length(btrim(text)) > 0),
  -- Для зіставлення при повторному імпорті без коду: без регістру й зайвих пробілів
  text_norm text generated always as (lower(regexp_replace(btrim(text), '\s+', ' ', 'g'))) stored,
  source text not null check (length(btrim(source)) > 0),
  archived boolean not null default false,
  is_demo boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (owner_id, code),
  unique (section_id, grp, text_norm)
);
create index program_outcomes_school_id_idx on public.program_outcomes (school_id);

-- ── Медіа й відео ────────────────────────────────────────────────────────────────────────
create table public.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.teachers (id),
  school_id uuid not null default private.current_school_id() references public.schools (id),
  bucket_path text not null unique,
  kind text not null check (kind in ('image', 'pdf')),
  alt text, -- обов'язковий для зображень у публікованому уроці (перевіряє валідатор)
  caption text,
  source text,
  license text,
  width integer check (width > 0),
  height integer check (height > 0),
  bytes integer check (bytes > 0),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index media_owner_id_idx on public.media (owner_id);
create index media_school_id_idx on public.media (school_id);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.teachers (id),
  school_id uuid not null default private.current_school_id() references public.schools (id),
  youtube_id text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null,
  channel text,
  duration_sec integer check (duration_sec > 0),
  start_sec integer check (start_sec >= 0),
  end_sec integer check (end_sec > 0),
  lang text not null default 'uk' check (lang = 'uk'), -- лише українською (SPEC 12)
  approved boolean not null default false, -- позначає вчитель, не агент
  checked_at timestamptz,
  is_demo boolean not null default false,
  check (end_sec is null or start_sec is null or end_sec > start_sec)
);
create index videos_owner_id_idx on public.videos (owner_id);
create index videos_school_id_idx on public.videos (school_id);

-- ── Банк завдань (робоча копія) ──────────────────────────────────────────────────────────
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.teachers (id),
  school_id uuid not null default private.current_school_id() references public.schools (id),
  type text not null check (type in (
    'single_choice', 'multiple_choice', 'true_false', 'matching', 'ordering', 'categorize',
    'fill_blanks', 'numeric', 'short_text', 'odd_one_out', 'slider_estimate', 'flashcards',
    'map_click', 'map_label', 'map_pin', 'image_hotspot', 'chart_read', 'chart_build',
    'coordinates', 'cause_effect', 'simulator'
  )),
  level text not null check (level in ('base', 'middle', 'sufficient', 'high')),
  grp text not null check (grp in ('ГР1', 'ГР2', 'ГР3')),
  points numeric(5, 1) not null default 1 check (points > 0),
  tags jsonb not null default '{}' check (jsonb_typeof(tags) = 'object'),
  content jsonb not null check (jsonb_typeof(content) = 'object'), -- БЕЗ ключа відповіді
  hint text,
  feedback jsonb check (feedback is null or jsonb_typeof(feedback) = 'object'),
  print_override jsonb,
  visibility text not null check (visibility in ('open', 'secure')),
  version integer not null default 1 check (version >= 1),
  archived boolean not null default false,
  is_demo boolean not null default false,
  updated_at timestamptz not null default now(),
  -- short_text перевіряє вчитель — потрібна здача, тож лише secure (SPEC 6.1)
  check (type <> 'short_text' or visibility = 'secure')
);
create index tasks_owner_id_idx on public.tasks (owner_id);
create index tasks_school_id_idx on public.tasks (school_id);

-- Ключ робочої копії окремо від змісту: його читає лише власник (SPEC 6.1)
create table public.task_keys (
  task_id uuid primary key references public.tasks (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.teachers (id),
  key jsonb not null
);
create index task_keys_owner_id_idx on public.task_keys (owner_id);

-- Незмінні знімки завдань: версія фіксується при публікації уроку (SPEC 6.1)
create table public.task_versions (
  task_id uuid not null references public.tasks (id) on delete restrict,
  version integer not null check (version >= 1),
  owner_id uuid not null references public.teachers (id),
  type text not null,
  level text not null,
  grp text not null,
  points numeric(5, 1) not null,
  visibility text not null check (visibility in ('open', 'secure')),
  content jsonb not null,
  key jsonb not null,
  hint text,
  feedback jsonb,
  print_override jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (task_id, version)
);
create index task_versions_owner_id_idx on public.task_versions (owner_id);

-- ── Уроки (робоча копія) ─────────────────────────────────────────────────────────────────
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.teachers (id),
  school_id uuid not null default private.current_school_id() references public.schools (id),
  -- Адреса /lesson/<slug>: друкується в QR, переноситься в пакетах (SPEC 6.1)
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 64),
  grade smallint not null check (grade between 6 and 9),
  section_id uuid references public.sections (id),
  number smallint check (number >= 1),
  title text not null check (length(btrim(title)) > 0),
  textbook_ref jsonb,
  ktp_ref text,
  blocks jsonb not null default '[]' check (jsonb_typeof(blocks) = 'array'),
  homework jsonb check (homework is null or jsonb_typeof(homework) = 'object'),
  simplified jsonb check (simplified is null or jsonb_typeof(simplified) = 'object'),
  quiz_pool uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  reviewed_by_teacher boolean not null default false,
  published_version integer check (published_version >= 1),
  is_demo boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (owner_id, slug),
  check (status <> 'published' or (reviewed_by_teacher and published_version is not null))
);
create index lessons_school_id_idx on public.lessons (school_id);
create index lessons_section_id_idx on public.lessons (section_id);

create table public.lesson_outcomes (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  outcome_id uuid not null references public.program_outcomes (id) on delete restrict,
  primary key (lesson_id, outcome_id)
);
create index lesson_outcomes_outcome_id_idx on public.lesson_outcomes (outcome_id);

-- ── Знімки публікації уроків ─────────────────────────────────────────────────────────────
create table public.lesson_versions (
  lesson_id uuid not null references public.lessons (id) on delete restrict,
  version integer not null check (version >= 1),
  is_current boolean not null default false,
  owner_id uuid not null references public.teachers (id),
  school_id uuid not null references public.schools (id),
  slug text not null,
  grade smallint not null,
  section_id uuid references public.sections (id),
  number smallint,
  title text not null,
  snapshot jsonb not null,
  media_ids uuid[] not null default '{}',
  video_ids uuid[] not null default '{}',
  homework_count integer not null default 0, -- гість у блоці ДЗ бачить лише кількість (SPEC 6.2)
  is_demo boolean not null default false,
  published_at timestamptz not null default now(),
  primary key (lesson_id, version)
);
create unique index lesson_versions_one_current_idx on public.lesson_versions (lesson_id) where is_current;
-- Публічна адреса /lesson/<slug>: поки вчитель один, slug серед поточних публікацій унікальний.
-- З кількома вчителями адреса отримає префікс школи/вчителя (SPEC 5).
create unique index lesson_versions_current_slug_idx on public.lesson_versions (slug) where is_current;
create index lesson_versions_grade_idx on public.lesson_versions (grade, number) where is_current;
create index lesson_versions_owner_id_idx on public.lesson_versions (owner_id);
create index lesson_versions_school_id_idx on public.lesson_versions (school_id);
create index lesson_versions_section_id_idx on public.lesson_versions (section_id);
create index lesson_versions_media_ids_idx on public.lesson_versions using gin (media_ids) where is_current;
create index lesson_versions_video_ids_idx on public.lesson_versions using gin (video_ids) where is_current;

-- Які версії завдань стоять у знімку уроку і в якій ролі
create table public.lesson_version_tasks (
  lesson_id uuid not null,
  lesson_version integer not null,
  role text not null check (role in ('practice', 'homework', 'quiz_pool')),
  position smallint not null check (position >= 0),
  task_id uuid not null,
  task_version integer not null,
  primary key (lesson_id, lesson_version, role, position),
  foreign key (lesson_id, lesson_version) references public.lesson_versions (lesson_id, version) on delete cascade,
  foreign key (task_id, task_version) references public.task_versions (task_id, version) on delete restrict
);
create index lesson_version_tasks_task_idx on public.lesson_version_tasks (task_id, task_version);

-- ── updated_at ───────────────────────────────────────────────────────────────────────────
create trigger sections_touch before update on public.sections
  for each row execute function private.touch_updated_at();
create trigger program_outcomes_touch before update on public.program_outcomes
  for each row execute function private.touch_updated_at();
create trigger lessons_touch before update on public.lessons
  for each row execute function private.touch_updated_at();
create trigger tasks_touch before update on public.tasks
  for each row execute function private.touch_updated_at();

-- ── Версія завдання: правка зафіксованої версії створює нову ─────────────────────────────
create function private.bump_task_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.type, new.level, new.grp, new.points, new.content, new.hint, new.feedback,
      new.print_override, new.visibility)
     is distinct from
     (old.type, old.level, old.grp, old.points, old.content, old.hint, old.feedback,
      old.print_override, old.visibility)
     and exists (select 1 from public.task_versions tv where tv.task_id = old.id and tv.version = old.version) then
    -- поточна версія вже зафіксована в знімку публікації → правка стає новою версією;
    -- до першої публікації чернетка змінюється на місці
    new.version := old.version + 1;
  end if;
  -- open → secure для вже опублікованого завдання заборонено: ключ міг потрапити в кеш (SPEC 6.1)
  if old.visibility = 'open' and new.visibility = 'secure'
     and exists (select 1 from public.task_versions tv where tv.task_id = old.id) then
    raise exception 'Завдання вже опубліковане як відкрите — створи захищену копію'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger tasks_bump_version before update on public.tasks
  for each row execute function private.bump_task_version();

create function private.bump_task_version_on_key()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.key is distinct from old.key then
    update public.tasks set version = version + 1 where id = new.task_id
      and exists (select 1 from public.task_versions tv where tv.task_id = new.task_id and tv.version = tasks.version);
  end if;
  return new;
end;
$$;
-- Ключ змінився після того, як поточна версія вже зафіксована в знімку → нова версія
create trigger task_keys_bump_version after insert or update on public.task_keys
  for each row execute function private.bump_task_version_on_key();
