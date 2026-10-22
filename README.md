# Географія 6–9

Інтерактивний ресурс уроків географії для 6–9 класів НУШ: уроки й тренування без входу, акаунти вчителя й учнів, ДЗ з серверною перевіркою, кабінет вчителя, живий квіз, конструктор змісту.

- Технічне завдання — [SPEC.md](SPEC.md), правила роботи — [CLAUDE.md](CLAUDE.md).
- Макети — [docs/design/](docs/design/), налаштування сервісів — [docs/setup.md](docs/setup.md).

## Стек

React 19 + Vite + TypeScript · TanStack Router / Query · Zustand · Mantine (тема з токенів дизайну) · dnd-kit (перетягування) · Supabase (Postgres, Auth, RLS, Storage, Realtime, Edge Functions) · Cloudflare Workers (static assets) · GitHub Actions.

## Швидкий старт

```bash
nvm use && npm ci
cp .env.example .env.local
npm run dev
```

Локальний Supabase і решта — у [docs/setup.md](docs/setup.md).

## Команди

| Команда | Що робить |
|---|---|
| `npm run dev` | дев-сервер, http://localhost:5173 |
| `npm run build` | перевірка типів + production-збірка в `dist/` |
| `npm run preview` | віддати `dist/` на http://localhost:4173 |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm test` | Vitest (компоненти, тема) |
| `npm run build:e2e` | збірка для e2e з тестовим хуком кешу запитів (у prod-збірку не потрапляє — перевіряє `check:dist`) |
| `npm run e2e` | Playwright: телефон (емуляція дотику) і комп'ютер проти збірки `build:e2e` (через `wrangler dev`); `E2E_WEBKIT=1` — ще й рушій Safari |
| `npm run preview:worker` | віддати `dist/` через `wrangler dev` — як на Cloudflare (SPA-fallback) |
| `npm run deploy` | збірка + перевірка `dist/` + `wrangler deploy` (ручний деплой; основний — Workers Builds з `main`) |
| `npm run check:dist` | у `dist/` немає секретів (service role, `sb_secret_`, приватні ключі) |
| `npm run db:start` / `db:reset` / `db:stop` | локальний Supabase (потрібен Docker) |
| `npm run db:test` | pgTAP: RLS змісту й акаунтів (класи, учні, журнал дій, анонім) |
| `npm run db:types` | типи БД → `src/types/database.types.ts` |
| `npm run seed` | демо-довідник і демо-урок у локальний Supabase (лише локально) |
| `npm run validate` | перевірка пакетів `.geo.zip` / тек-джерел у `seed/` |
| `npm run import:outcomes -- файл.csv` | довідник розділів і результатів з CSV (формат SPEC 10.6) у локальний Supabase |
| `npm run test:coverage` | Vitest + 100 % покриття `@shared/scoring` |
| `npm run perf -- / /lesson/<slug>` | Lighthouse на телефоні → `docs/perf.md` |
| `npm run fonts:metrics` | метрики fallback-шрифтів (після оновлення `@fontsource`) |
| `scripts/backup/roundtrip-local.sh` | бекап локальної БД і Storage → відновлення → звірка рядків і входу (як у CI) |
| `scripts/backup/restore-local.sh <каталог>` | розшифрований бекап prod → локальний Supabase (docs/setup.md, 7.3) |

## Структура

```
src/
  main.tsx, router.tsx        точка входу; маршрути (history-режим, чисті адреси)
  supabase.ts, queryClient.ts клієнт Supabase (лише anon key), TanStack Query
  theme/                      tokens.css, fonts.css, mantine-theme.ts, palette.ts
  components/                 LevelIcon, GradeTile, ContourBackground
  api/                        запити: зміст, сесія (auth.ts), кабінет вчителя (teacher.ts)
  features/                   екрани: home, lesson, auth (вхід, кабінет учня), teacher, import
  stores/                     Zustand: відповіді, вигляд, щойно створені паролі (лише в пам'яті)
  lib/                        класи, рівні тощо
supabase/                     config.toml, migrations/, seed.sql, tests/ (pgTAP)
  functions/manage-students/  Edge Function: акаунти учнів (service.ts — логіка, index.ts — Deno)
  functions/_shared/          спільне з клієнтом: scoring, schemas, accounts (логіни, паролі), http
scripts/backup/               дамп БД + Storage, відновлення в локальний Supabase
scripts/check-dist.ts         перевірка збірки
e2e/                          Playwright
wrangler.jsonc                Cloudflare Workers static assets: dist/ + SPA-fallback
```

Prod: **https://geography-app.alexglotov67.workers.dev/**

## Фаза 3 — конструктор (у роботі)

- «Уроки й конструктор» `/t/lessons`: дерево клас → розділ → урок зі статусами (чернетка / опубліковано / є неопубліковані зміни), пошук, «Новий урок» з адресою `g8-u05`.
- «Довідник програми» `/t/outcomes`: імпорт CSV або XLSX з екраном перевірки (нові / змінені / без змін / помилки з рядками; відсутні у файлі — архівувати за вибором), експорт CSV з кодами.
- Конструктор уроку `/t/lessons/:id` (макет LessonBuilder, комп’ютер ≥ 1024 px): «Про урок» (результати з довідника, підсумок ГР із тегів завдань), структура з перетягуванням, редактори «Мета», «Текст» (поки без форматування), «Терміни», «Виділений блок», «Таблиця»; автозбереження (2 с / не рідше 10 с / вихід з поля й екрана, копія в localStorage, конфлікт вкладок), перегляд чернетки «Телефон / Комп’ютер / Спрощений», перевірка перед публікацією (валідатор пакетів), публікація з позначкою «перевірено» і зняття з публікації.

## Фаза 2 — закрито 15.10.2026

- Вхід `/login`: учень — логін з картки (`8b-07`), вчитель — email; сесія лишається на пристрої, «Вийти» — у кабінетах. QR на картці відкриває вхід з підставленим логіном.
- Кабінет вчителя `/t`: огляд, класи, учні (логін, «Спрощений режим», останній вхід, «Новий пароль», архів), налаштування (назва школи, префікс логінів).
- Імпорт списку класу (.xlsx, .xls, .csv у UTF-8 чи Windows-1251): стовпці, по батькові відкидається, кілька класів в одному файлі, повторний імпорт без дублів, неоднозначні рядки — на вибір вчителя.
- Edge Function `manage-students`: акаунти учнів, паролі `gora-step-47` (лише у відповіді, ніде не зберігаються), архів вимикає вхід; журнал дій `audit_log`.
- Картки входу: A4, 10 на аркуш, JetBrains Mono, QR.
- Учень: ім'я на головній, «Мій кабінет» (поки без ДЗ), «Спрощений режим» від вчителя за замовчуванням.
- RLS-тести акаунтів (pgTAP), e2e приймання (імпорт 30 учнів → картки → вхід учня), бекап `backup.yml` (age) з перевіркою відновлення в CI, `keepalive.yml`.

## Фаза 1 — закрито 14.10.2026

- Зміст у Postgres: робочі копії вчителя й знімки публікації (`lesson_versions`, `task_versions`), які лише й бачать гість і учень; RLS + явні GRANT, pgTAP.
- zod-схеми уроку, блоків, 8 типів завдань; `@shared/scoring` (100 % гілок).
- Екрани без входу: класи, урок (телефон і комп'ютер), тренування за рівнями, спрощений режим; скелетони, splash, fallback-шрифти — без зсуву макета.
- Пакети `.geo.zip` (формат v1), довідник програми з CSV, демо-зміст у `seed/` — лише локально й у CI.
- Після прийняття (PR #7): перетягування мишею й пальцем у відповідності, порядку й групах (запасний режим — кнопки); робота в завданні не перебивається фоновим оновленням; горизонталі — замкнені контури.
- Заміри — `docs/perf.md`.

## Фаза 0 — закрито 12.10.2026

- Каркас застосунку, тема Mantine з дизайн-токенів (палітри, шрифти, висоти елементів ≥ 44 px, без тіней).
- Шрифти Golos Text, Unbounded, JetBrains Mono (латиниця, одна вага — логіни й паролі) — з пакетів `@fontsource` у бандлі (OFL), без CDN.
- Головна «Вибір класу» за макетом `Main.dc.html` (стан гостя); інші маршрути — заглушки.
- Базові компоненти: іконка рівня «сходинки висоти», плитка класу, фон з ізоліній.
- Хостинг: Cloudflare Workers зі статичними ресурсами (`wrangler.jsonc`, SPA-fallback без `_redirects`).
- CI: lint, типи, Vitest, збірка, перевірка `dist/`, e2e через `wrangler dev`, локальний Supabase; ручний деплой БД на prod.
