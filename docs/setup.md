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

Демо-зміст (лише локально): `npm run db:reset && npm run seed` — довідник із `seed/demo-outcomes.csv` і урок із `seed/demo-lesson/` (пакується в `.geo.zip` і проходить той самий імпорт, що й справжні пакети). Відкрий http://localhost:5173/grade/8.

**Вхід локально:** демо-вчитель `demo-teacher@example.invalid` / `demo-teacher-2026` (лише в `supabase/seed.sql`, на prod його немає) → http://localhost:5173/login → «Класи й учні» → створи клас → «Імпортувати список» (тестові файли — `e2e/fixtures/class-8b.*.csv`, вигадані учні). Edge Function `manage-students` локально запускає сам `npm run db:start` (Edge Runtime); логи — `npx supabase functions logs` або Docker Desktop → `supabase_edge_runtime_*`.

> Edge Functions — серверні функції Supabase на Deno (TypeScript, як Node, але імпорти — з `deno.json`, напр. `npm:zod@4`). Наша єдина поки що — `manage-students`: лише вона має сервісний ключ і створює акаунти учнів. Логіка — `supabase/functions/manage-students/service.ts` (тести у Vitest), `index.ts` — тонка обгортка з доступом до БД і Auth.

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
- `ci.yml` — на кожен PR і push у `main`: lint, типи, Vitest, збірка, перевірка `dist/`, локальний Supabase (міграції з нуля, демо-рядків у міграціях немає, лінт, advisors, pgTAP, актуальні типи), демо-зміст і e2e. На PR, що змінює `supabase/migrations/**` або `supabase/functions/**`, — попередження «після злиття запусти „Деплой БД і функцій на prod“» (в анотаціях і в підсумку запуску).
- `deploy-prod.yml` — **лише вручну**, лише з `main`, з підтвердженням `prod`: міграції й Edge Functions на prod. Неправильне підтвердження чи гілка — запуск падає з поясненням ще до запиту дозволу середовища `production`.
- Фронт workflows не публікують — це робить Cloudflare Workers Builds з `main` (розділ 4).
- з Фази 2: `backup.yml`, `keepalive.yml`.

## 3. Supabase — prod

### 3.1 Створення
1. supabase.com → New project: назва `geo-prod`, **регіон — ЄС** (напр. Frankfurt `eu-central-1`), план Free. Пароль бази збережи в менеджері паролів → секрет `SUPABASE_DB_PASSWORD`.
2. **Project Settings → API Keys**: скопіюй `Project URL` і **publishable key** (`sb_publishable_…`) — вони публічні, підуть у змінні збірки Cloudflare (розділ 4). Secret key (`sb_secret_…`) і legacy `service_role` **нікуди не копіюй**, крім секретів Edge Functions (з'являться у Фазі 2).
3. **Integrations → Data API → Settings**: переконайся, що нові таблиці **не** відкриваються автоматично (для проєктів, створених після 30.05.2026, це за замовчуванням). Схема `public` має бути у списку exposed schemas.

### 3.2 Auth
- **Authentication → URL Configuration**: Site URL — адреса сайту на Cloudflare (розділ 4), у Redirect URLs додай її ж.
- **Authentication → Providers → Email**: вимкни підтвердження email (учні мають фіктивні адреси `@students.invalid`, SPEC 5.1).
- **Authentication → Sign In / Providers → User Signups**: **вимкни «Allow new users to sign up»**. Вчителя створюєш вручну (розділ 7.1), учнів — `manage-students` через адмін-API, на яке це налаштування не впливає. Інакше будь-хто міг би створити собі акаунт (даних він би не побачив — RLS, — але й акаунт зайвий).
- Anonymous sign-ins — **вимкнено** до Фази 6 (гості квізу).

### 3.3 Міграції
Лише через `deploy-prod.yml` після злиття й зеленого CI — порядок у розділі 6. Ніяких ручних змін схеми в панелі (SPEC 2.2).

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

3. **Settings → Build → Variables and secrets** — це **Build variables**, змінні **збірки**: Vite вшиває `VITE_*` у бандл під час `npm run build`, у рантаймі Worker їх немає (тому не «Variables» Worker-а, а саме змінні збірки). Без `VITE_SUPABASE_URL` і `VITE_SUPABASE_PUBLISHABLE_KEY` збірка навмисно падає з поясненням:

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

## 5. Моніторинг
Безкоштовна перевірка доступності сайту й функцій з повідомленням вчителю — налаштуємо перед появою реальних учнів на prod (TODO: обрати сервіс без реєстрації учнів, напр. UptimeRobot Free; потрібне погодження вчителя як нового сервісу).

## 6. Порядок релізу

Фронт і база публікуються **окремо**: фронт — Cloudflare Workers Builds автоматично одразу після злиття в `main`, база — лише вручну (`deploy-prod.yml`). Тому правило (SPEC 3.5): **міграції — перед фронтом і зворотно сумісні**.

- **Зворотно сумісна міграція** — нова схема працює з фронтом, який уже на prod: додати таблицю, стовпець з типовим значенням, функцію, політику. Перейменування чи видалення того, чим користується фронт, — **несумісне**.
- Фронт, якому потрібна нова схема, **зливається лише після деплою БД**. Якщо PR змінює і міграції, і код, що від них залежить, — розбий на два PR (спершу міграції). Один PR можна, якщо новий фронт працює і зі старою схемою.

### 6.1 Реліз з міграціями або Edge Functions
CI у такому PR показує попередження «після злиття запусти „Деплой БД і функцій на prod“».

**Правило PR:** усі PR — лише в `main`, без «стопок» (PR в іншу фічегілку). Якщо фронт залежить від нової схеми — **два окремі PR у `main`**:
- **PR БД** (міграції, Edge Functions) — звичайний;
- **PR фронту** — **Draft**, доки БД не задеплоєна на prod; в описі обох — порядок кроків нижче.

Гілки після злиття видаляються автоматично (Settings → General → «Automatically delete head branches»); нову гілку завжди відгалужуй від свіжого `main`.

1. **PR з міграціями** (зворотно сумісними) → CI зелений → **merge**.
2. **Одразу деплой БД:** GitHub → Actions → «Деплой БД і функцій на prod» → **Run workflow** → *Use workflow from*: `main` → у полі `confirm` ввести **`prod`** → Run. Якщо ввімкнено «Required reviewers» — підтвердити. Переглянь крок «Які міграції застосуються» і підсумок запуску. Неправильне підтвердження чи гілка — запуск падає з поясненням, нічого не змінивши.
3. **Перевір сайт** (нижче).
4. Лише тепер — **PR з фронтом**, що використовує нову схему: зняти Draft (**Ready for review**) → CI зелений → merge → Workers Builds публікує його за 1–2 хв → знову перевір сайт.

### 6.2 Реліз лише фронту
PR → CI зелений → merge → Workers Builds публікує (Cloudflare → Workers & Pages → `geography-app` → Deployments) → перевір сайт. Змінні `VITE_*` беруться з **Build variables** Workers Builds (розділ 4.1): без них збірка падає з поясненням, а не публікує сайт, що не вантажить уроки.

### 6.3 Перевірка сайту
https://geography-app.alexglotov67.workers.dev/
- головна відкривається, splash зникає;
- `/grade/8` — список уроків або «Уроки готуються», без «Не вдалося завантажити»;
- відкритий урок і тренування (якщо є опубліковані), пряма адреса після оновлення сторінки;
- у консолі браузера немає помилок.

### 6.4 Якщо щось не так
- **Фронт** — Cloudflare → Deployments → попередня версія → **Rollback**. Оскільки міграції зворотно сумісні, стара версія фронту працює з новою базою.
- **База** — лише новою міграцією тим самим шляхом (PR → CI → злиття → деплой БД); відкатів схеми вручну в панелі не робимо.
- **Несумісна зміна** (перейменувати / прибрати стовпець) — у два релізи: спершу додати нове й перевести на нього фронт, і лише наступним релізом прибрати старе.

## 7. Акаунти, бекапи й keepalive (Фаза 2)

### 7.1 Акаунт вчителя на prod (один раз)
Реєстрацію на prod вимкнено (розділ 3.2), тож вчителя створюєш сам:
1. Supabase → **Authentication → Users → Add user → Create new user**: твій email і надійний пароль, **Auto Confirm User** — увімкнено.
2. **SQL Editor** → вистав (заміни назву школи й email) → Run:
   ```sql
   with s as (insert into public.schools (name) values ('Назва школи') returning id)
   insert into public.teachers (id, school_id, display_name)
   select u.id, s.id, 'Прізвище І. Б.' from auth.users u, s where u.email = 'твій@email';
   ```
3. Увійди на сайті: `/login` → email і пароль → «Кабінет вчителя». Назву школи для карток входу можна змінити в «Налаштування».

Пароль вчителя забув — Supabase → Authentication → Users → твій користувач → **Send password recovery** (лист піде на справжній email).

### 7.2 Секрети для функцій і бекапу
- Edge Function `manage-students` бере `SUPABASE_URL` і сервісний ключ із середовища Supabase автоматично — нічого додавати не треба. Деплой — разом із міграціями (`deploy-prod.yml`).
- Для бекапу файлів Storage: GitHub → Settings → Environments → `production` → **Add secret** `SUPABASE_SERVICE_ROLE_KEY` = Supabase → Project Settings → API Keys → **secret key** (`sb_secret_…`). Він є лише в секретах GitHub, ніде в коді.

### 7.3 Бекапи (обов'язково, щойно на prod з'являться справжні учні)
Щонеділі `backup.yml` робить дамп БД (ролі, схема, дані) і копію файлів Storage, шифрує архів **age** твоїм публічним ключем і кладе в артефакти GitHub на 90 днів. Розшифрувати може лише власник приватного ключа — навіть доступ до репозиторію його не дає.

> age — проста утиліта шифрування файлів (як gpg, але з одним коротким ключем). Встановлення: `brew install age` (macOS) або [github.com/FiloSottile/age](https://github.com/FiloSottile/age/releases).

1. Один раз: `age-keygen -o geo-backup-key.txt`. Файл — **приватний ключ**: збережи в менеджері паролів і ще в одному місці (без нього бекап не відкрити). Рядок `# public key: age1…` — публічний.
2. GitHub → Settings → Secrets and variables → Actions → **Variables**: `BACKUP_AGE_RECIPIENT` = публічний ключ `age1…`, `BACKUPS_ENABLED` = `true`.
3. Actions → «Бекап prod» → **Run workflow** — перший бекап вручну, далі щотижня. Завантаж артефакт `geo-prod-<дата>.tar.gz.age` і збережи у своєму сховищі (напр. Google Drive) — артефакти GitHub живуть 90 днів.
4. Перед канікулами — ще й ручний запуск і копія.

**Відновлення:**
```bash
age -d -i geo-backup-key.txt -o backup.tar.gz geo-prod-2026-10-18.tar.gz.age
tar -xzf backup.tar.gz            # каталог backup/: roles.sql, schema.sql, data.sql, storage/
```
- **Перевірити / подивитися локально** (prod не чіпає): `npm run db:start && scripts/backup/restore-local.sh backup` — локальна база з міграцій + дані + файли Storage. CI щоразу перевіряє цей шлях на демо-даних (`scripts/backup/roundtrip-local.sh`).
- **У новий хмарний проєкт** (якщо prod втрачено): створи проєкт (розділ 3.1), потім за [інструкцією Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) — `psql` з `roles.sql`, `schema.sql`, `data.sql` (з `session_replication_role = replica`), і `npx tsx scripts/backup/storage.ts upload backup/storage` з `SUPABASE_URL` і `SUPABASE_SERVICE_ROLE_KEY` нового проєкту.

### 7.4 Keepalive на канікули
Supabase Free призупиняє проєкт після тижня без активності. Якщо на канікулах не хочеш його будити вручну (розділ 3.5): GitHub → Variables: `PROD_SUPABASE_URL` = Project URL, `PROD_SUPABASE_PUBLISHABLE_KEY` = publishable key (обидва публічні), `KEEPALIVE_ENABLED` = `true`. `keepalive.yml` двічі на тиждень читає довідник через Data API. Вимкнути — `KEEPALIVE_ENABLED` = `false`.
