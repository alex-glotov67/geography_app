# Налаштування сервісів

Покроково: локальна розробка, GitHub, Supabase (prod), Cloudflare Workers (статичні ресурси). Секрети — лише в `.env.local`, секретах GitHub і Supabase; у git і в клієнтський код вони не потрапляють.

**Prod:** https://geography-app.alexglotov67.workers.dev/ (Worker `geography-app`, деплой з `main` через Workers Builds). Фаза 0 прийнята 12.10.2026; перевірка зі шкільної мережі — окремо (TODO: результат дописати сюди).

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
- на канікулах: `keepalive.yml` (щотижневий запит до prod) — закладено за замовчуванням; рішення — за вчителем (SPEC 19.10). Якщо проєкт усе ж призупинився — розділ 3.5.

**Cloudflare Workers Free — статичні ресурси** ([billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [limits](https://developers.cloudflare.com/workers/platform/limits/)): запити до статичних ресурсів **безкоштовні й без ліміту**, зберігання — без доплати; до 20 000 файлів на версію, до 25 МіБ на файл. Ліміт Free-плану 100 000 запитів на добу задокументовано для Workers загалом; у нас коду Worker немає (assets-only), а запити до статичних ресурсів billing-сторінка називає безкоштовними й необмеженими. Pages Cloudflare позначає як legacy, тому не використовуємо.

> Умови змінюються. Перед Фазою 2 (поява реальних учнів) звір таблиці з посиланнями вище й онови дату.

## 1. Локальна розробка

Потрібно: Node 22 (`.nvmrc`), Docker Desktop (для локального Supabase).

```bash
nvm use                # Node з .nvmrc
npm ci
cp .env.example .env.local   # уже містить URL і publishable key локального Supabase
npm run dev            # http://localhost:5173
```

**Локальний Supabase** (це і є наш staging). Supabase CLI ставиться як залежність проєкту (`npx supabase …`), окремо встановлювати не треба.

```bash
# Docker Desktop має бути запущений
npm run db:start       # Postgres, Auth, Storage, Realtime, Studio у Docker
```

Команда виведе `API URL` і `Publishable key` — вони вже є в `.env.example` (демо-ключі CLI однакові на всіх машинах). Studio (адмінка бази) — http://127.0.0.1:54323.

**Таблиці не відкриваються в API автоматично.** У `supabase/config.toml` стоїть `auto_expose_new_tables = false` — так само, як у хмарних проєктах, створених після 30.05.2026 ([changelog](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)). Тому кожна міграція з новою таблицею містить і `GRANT` для потрібних ролей (`anon`, `authenticated`), і `enable row level security` з політиками. `GRANT` вирішує, чи таблиця взагалі доступна через API, а RLS — які рядки. Перевірено локально: без `GRANT` — `401 permission denied`; з `GRANT` і RLS без політик — порожній результат. Після зміни цього параметра потрібен `npm run db:reset` (привілеї задаються при створенні бази).

Корисне:

```bash
npm run db:reset       # перестворити базу з міграцій + supabase/seed.sql
npm run db:stop
npx supabase migration new <назва>   # нова міграція в supabase/migrations/
npx supabase db lint --level warning  # помилки в SQL-функціях
npx supabase db advisors --local      # безпека й продуктивність (RLS, індекси, security definer)
```

**Залежності з ручним оновленням:**
- **SheetJS** (з Фази 2, XLSX): ставиться не з npm (пакет `xlsx` там застарів і має відому вразливість), а офіційним тарболом із зафіксованою версією: `https://cdn.sheetjs.com/xlsx-<версія>/xlsx-<версія>.tgz`. `npm update` його не оновлює — раз на семестр перевір [cdn.sheetjs.com](https://cdn.sheetjs.com/) і [список змін](https://docs.sheetjs.com/docs/miscellany/changelog), заміни URL у `package.json`, `npm install`, прожени тести імпорту.
- **Метрики fallback-шрифтів** (`src/theme/font-metrics.css`): після оновлення `@fontsource/*` — `npm run fonts:metrics` і закомітити результат.

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
   | `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens. Створи **scoped** токен лише для організації/проєкту `geo-prod` (класичний токен дає доступ до всього акаунта) |
   | `SUPABASE_PROJECT_REF` | ref проєкту з URL панелі (`https://supabase.com/dashboard/project/<ref>`) |
   | `SUPABASE_DB_PASSWORD` | пароль бази, заданий при створенні проєкту |

Workflows:
- `ci.yml` — на кожен PR і push у `main`: lint, типи, Vitest, збірка, перевірка `dist/`, e2e, локальний Supabase (міграції з нуля, лінт схеми; з Фази 1 — RLS-тести).
- `deploy-prod.yml` — **лише вручну** (Actions → «Деплой БД і функцій на prod» → Run, ввести `prod`), лише з `main`: міграції й Edge Functions на prod.
- з Фази 2: `backup.yml`, `keepalive.yml`.

## 3. Supabase — prod

### 3.1 Створення
1. supabase.com → New project: назва `geo-prod`, **регіон — ЄС** (напр. Frankfurt `eu-central-1`), план Free. Пароль бази збережи в менеджері паролів → секрет `SUPABASE_DB_PASSWORD`.
2. **Project Settings → API Keys**: скопіюй `Project URL` і **publishable key** (`sb_publishable_…`) — вони публічні, підуть у змінні збірки Cloudflare (розділ 4). Secret key (`sb_secret_…`) і legacy `service_role` **нікуди не копіюй**, крім секретів Edge Functions (з'являться у Фазі 2).
3. **Integrations → Data API → Settings**: переконайся, що нові таблиці **не** відкриваються автоматично (для проєктів, створених після 30.05.2026, це за замовчуванням). Схема `public` має бути у списку exposed schemas.

### 3.2 Auth
- **Authentication → URL Configuration**: Site URL — адреса сайту на Cloudflare (розділ 4), у Redirect URLs додай її ж.
- **Authentication → Providers → Email**: вимкни підтвердження email (учні мають фіктивні адреси `@students.invalid`, SPEC 5.1). Самостійну реєстрацію вимкнемо у Фазі 2, коли з'явиться вхід вчителя.
- Anonymous sign-ins — **вимкнено** до Фази 6 (гості квізу).

### 3.3 Міграції
Лише через `deploy-prod.yml` після зеленого CI. Ніяких ручних змін схеми в панелі (SPEC 2.2).

### 3.4 MCP-сервер Supabase (для Claude Code)
`.mcp.json` у корені підключає `geo-prod` у режимі **`read_only=true`**: агент читає схему, логи, advisors і документацію, але нічого не змінює — міграції на prod ідуть лише через `deploy-prod.yml`. Перший виклик відкриває вхід у Supabase (OAuth) у браузері; у VS Code — через `/mcp` в інтерактивній сесії. Скіли Supabase лежать у `.agents/skills/` (підключені для Claude Code через `.claude/skills/`).

### 3.5 Якщо проєкт призупинився
1. supabase.com → проєкт → **Restore project** (відновлення займає кілька хвилин; дані зберігаються).
2. Перевір сайт: вхід учня, відкриття уроку.
3. Якщо пауза повторюється на канікулах — перевір, що `keepalive.yml` увімкнений і проходить (Actions).

## 4. Cloudflare Workers — статичні ресурси

Фронт — це Worker **без коду** (assets-only): Cloudflare віддає файли з `dist/`, а все, чого там немає (`/login`, `/lesson/<slug>`…), — як `index.html` зі статусом 200. Конфіг — [`wrangler.jsonc`](../wrangler.jsonc) у корені:

```jsonc
{
  "name": "geography-app",
  "compatibility_date": "2026-10-12",
  "assets": { "directory": "./dist", "not_found_handling": "single-page-application" }
}
```

> **`_redirects` не потрібен і шкодить.** SPA-fallback робить `not_found_handling`. Правило `/* /index.html 200` Workers визнає нескінченним циклом і ігнорує (перевірено `wrangler dev`, 12.10.2026); `npm run check:dist` не пропустить його назад у збірку.

### 4.1 Підключення репозиторію (Workers Builds)
1. dash.cloudflare.com → **Workers & Pages → Create application → Import a repository** → GitHub → `geography_app`.
2. Налаштування:

   | Поле | Значення |
   |---|---|
   | Project name | `geography-app` — **має збігатися з `name` у `wrangler.jsonc`**, інакше збірка впаде |
   | Production branch | `main` |
   | Build command | `npm run build` |
   | Deploy command | `npx wrangler deploy` (за замовчуванням) |
   | Non-production branch deploy command | `npx wrangler preview` (за замовчуванням: Preview-URL для гілок і PR) |
   | Root directory | `/` |

3. **Settings → Build → Variables and secrets** — це змінні **збірки** (Vite вшиває `VITE_*` у бандл під час `npm run build`; у рантаймі їх немає):

   | Змінна | Значення |
   |---|---|
   | `NODE_VERSION` | `22.19.0` (як у `.nvmrc`; Vite 8 і Wrangler потребують Node ≥ 22) |
   | `VITE_SUPABASE_URL` | Project URL з 3.1 |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable key з 3.1 (`sb_publishable_…`) |

   `VITE_SUPABASE_ANON_KEY` теж працює як запасний варіант, але краще publishable key. Secret key сюди не класти.

4. Push у `main` → новий деплой на `https://geography-app.<твій-субдомен>.workers.dev`. Push в іншу гілку → preview-URL (видно в **Deployments / Versions** і в перевірці PR на GitHub).

### 4.2 Перевірка після першого деплою
- Відкрий напряму `https://<адреса>/lesson/test` і онови сторінку — має відкритися застосунок (заглушка «Урок»), а не 404.
- Те саме для `/login`, `/quiz`, `/grade/8`.
- Головна має виглядати як `docs/design/screens/Main.dc.html`.

### 4.3 Якщо раніше створено проєкт Pages
Після першого успішного деплою Worker — вимкни автоматичні деплої в проєкті Pages (**Settings → Builds → Disable automatic deployments**) або видали його, щоб не було двох сайтів.

### 4.4 Ручний деплой (запасний варіант)
```bash
npx wrangler login     # один раз, вхід у браузері
npm run deploy         # збірка + check:dist + wrangler deploy
```
Змінні `VITE_*` при цьому беруться з `.env.local` / `.env.production.local` на твоїй машині — для prod там мають бути значення `geo-prod`.

### 4.5 Домен
За бажанням — власний короткий домен (**Settings → Domains & Routes → Add → Custom domain**) для карток входу й QR (SPEC 19.8).

## 5. Моніторинг (Фаза 2)
Безкоштовна перевірка доступності сайту й функцій з повідомленням вчителю — налаштовується разом із появою реальних учнів.
