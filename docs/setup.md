# Налаштування сервісів

Покроково: локальна розробка, GitHub, Supabase (prod), Cloudflare Pages. Секрети — лише в `.env.local`, секретах GitHub і Supabase; у git і в клієнтський код вони не потрапляють.

## 0. Умови безкоштовних планів (перевірено 12.10.2026)

**Supabase Free** ([supabase.com/pricing](https://supabase.com/pricing)):

| Що | Ліміт |
|---|---|
| Активні проєкти | 2 |
| Призупинення | після **1 тижня неактивності** |
| База даних | 500 МБ на проєкт |
| Storage | 1 ГБ |
| Трафік | 5 ГБ (+ 5 ГБ кешованого) |
| Активні користувачі | 50 000 / міс |
| Edge Functions | 500 000 викликів / міс |
| Автоматичні бекапи | **немає** |

Наслідки для нас (SPEC 3.4):
- у хмарі один проєкт — `geo-prod`; staging — локальний Supabase CLI (розділ 1) і в CI; другий слот вільний;
- бекапи робимо самі: `backup.yml` з Фази 2 (зашифрований `pg_dump` + копія Storage);
- на канікулах: `keepalive.yml` (щотижневий запит до prod) — закладено за замовчуванням; рішення — за вчителем (SPEC 19.10). Якщо проєкт усе ж призупинився — розділ 3.4.

**Cloudflare Pages Free** ([developers.cloudflare.com/pages/platform/limits](https://developers.cloudflare.com/pages/platform/limits/)): 500 збірок на місяць, 1 збірка одночасно, до 20 000 файлів, до 25 МіБ на файл, до 100 власних доменів, у `_redirects` — до 2 000 статичних і 100 динамічних правил.

> Умови змінюються. Перед Фазою 2 (поява реальних учнів) звір таблиці з посиланнями вище й онови дату.

## 1. Локальна розробка

Потрібно: Node 22 (`.nvmrc`), Docker Desktop (для локального Supabase).

```bash
nvm use                # Node з .nvmrc
npm ci
cp .env.example .env.local
npm run dev            # http://localhost:5173
```

**Локальний Supabase** (це і є наш staging). Supabase CLI ставиться як залежність проєкту (`npx supabase …`), окремо встановлювати не треба.

```bash
# Docker Desktop має бути запущений
npm run db:start       # Postgres, Auth, Storage, Realtime, Studio у Docker
```

Команда виведе `API URL` і `anon key` — впиши їх у `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Studio (адмінка бази) — http://127.0.0.1:54323.

Корисне:

```bash
npm run db:reset       # перестворити базу з міграцій + supabase/seed.sql
npm run db:stop
npx supabase migration new <назва>   # нова міграція в supabase/migrations/
```

> Що таке Supabase: Postgres + готові Auth, Storage, Realtime і Edge Functions (серверні функції на Deno). Фронт ходить у базу напряму через `supabase-js`, а що кому можна — вирішують політики Row Level Security у самій базі. Тому кожна таблиця — з RLS і тестами.

Перевірки, як у CI:

```bash
npm run lint && npm run typecheck && npm test
npm run build && npm run check:dist   # у dist/ немає секретів
npx playwright install chromium       # один раз
npm run e2e                           # телефон + комп'ютер проти збірки
```

## 2. GitHub

1. Створи **приватний** репозиторій (напр. `geography-6-9`) і додай його як `origin`; основна гілка — `main`.
2. **Settings → Environments → New environment** `production`; за бажанням увімкни «Required reviewers» (себе) — тоді деплой на prod вимагатиме підтвердження.
3. **Settings → Secrets and variables → Actions** (секрети середовища `production`):

   | Секрет | Звідки |
   |---|---|
   | `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens |
   | `SUPABASE_PROJECT_REF` | ref проєкту з URL панелі (`https://supabase.com/dashboard/project/<ref>`) |
   | `SUPABASE_DB_PASSWORD` | пароль бази, заданий при створенні проєкту |

Workflows:
- `ci.yml` — на кожен PR і push у `main`: lint, типи, Vitest, збірка, перевірка `dist/`, e2e, локальний Supabase (міграції з нуля, лінт схеми; з Фази 1 — RLS-тести).
- `deploy-prod.yml` — **лише вручну** (Actions → «Деплой БД і функцій на prod» → Run, ввести `prod`), лише з `main`: міграції й Edge Functions на prod.
- з Фази 2: `backup.yml`, `keepalive.yml`.

## 3. Supabase — prod

### 3.1 Створення
1. supabase.com → New project: назва `geo-prod`, **регіон — ЄС** (напр. Frankfurt `eu-central-1`), план Free. Пароль бази збережи в менеджері паролів → секрет `SUPABASE_DB_PASSWORD`.
2. **Project Settings → API**: скопіюй `Project URL` і `anon` (publishable) key — вони публічні, підуть у Cloudflare Pages. `service_role` / secret key **нікуди не копіюй**, крім секретів Edge Functions (з'являться у Фазі 2).

### 3.2 Auth
- **Authentication → URL Configuration**: Site URL — адреса сайту на Cloudflare (розділ 4), у Redirect URLs додай її ж.
- **Authentication → Providers → Email**: вимкни підтвердження email (учні мають фіктивні адреси `@students.invalid`, SPEC 5.1). Самостійну реєстрацію вимкнемо у Фазі 2, коли з'явиться вхід вчителя.
- Anonymous sign-ins — **вимкнено** до Фази 6 (гості квізу).

### 3.3 Міграції
Лише через `deploy-prod.yml` після зеленого CI. Ніяких ручних змін схеми в панелі (SPEC 2.2).

### 3.4 Якщо проєкт призупинився
1. supabase.com → проєкт → **Restore project** (відновлення займає кілька хвилин; дані зберігаються).
2. Перевір сайт: вхід учня, відкриття уроку.
3. Якщо пауза повторюється на канікулах — перевір, що `keepalive.yml` увімкнений і проходить (Actions).

## 4. Cloudflare Pages

1. dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git** → обери репозиторій.
2. Налаштування збірки:

   | Поле | Значення |
   |---|---|
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

3. **Environment variables** (Production і Preview):

   | Змінна | Значення |
   |---|---|
   | `NODE_VERSION` | `22.19.0` |
   | `VITE_SUPABASE_URL` | Project URL з 3.1 |
   | `VITE_SUPABASE_ANON_KEY` | anon key з 3.1 |

4. Кожна гілка/PR отримує **preview-адресу**; `main` — production.
5. SPA-fallback задано явно в `public/_redirects` (`/* /index.html 200`). Перевірка після першого деплою: відкрий напряму `https://<адреса-сайту>/lesson/test` і онови сторінку — має відкритися сторінка застосунку, а не 404 Cloudflare.
6. За бажанням — власний короткий домен (Custom domains) для карток входу й QR (SPEC 19.8).

## 5. Моніторинг (Фаза 2)
Безкоштовна перевірка доступності сайту й функцій з повідомленням вчителю — налаштовується разом із появою реальних учнів.
