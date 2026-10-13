# Географія 6–9

Інтерактивний ресурс уроків географії для 6–9 класів НУШ: уроки й тренування без входу, акаунти вчителя й учнів, ДЗ з серверною перевіркою, кабінет вчителя, живий квіз, конструктор змісту.

- Технічне завдання — [SPEC.md](SPEC.md), правила роботи — [CLAUDE.md](CLAUDE.md).
- Макети — [docs/design/](docs/design/), налаштування сервісів — [docs/setup.md](docs/setup.md).

## Стек

React 19 + Vite + TypeScript · TanStack Router / Query · Zustand · Mantine (тема з токенів дизайну) · Supabase (Postgres, Auth, RLS, Storage, Realtime, Edge Functions) · Cloudflare Workers (static assets) · GitHub Actions.

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
| `npm run e2e` | Playwright: телефон і комп'ютер проти збірки (через `wrangler dev`) |
| `npm run preview:worker` | віддати `dist/` через `wrangler dev` — як на Cloudflare (SPA-fallback) |
| `npm run deploy` | збірка + перевірка `dist/` + `wrangler deploy` (ручний деплой; основний — Workers Builds з `main`) |
| `npm run check:dist` | у `dist/` немає секретів (service role, `sb_secret_`, приватні ключі) |
| `npm run db:start` / `db:reset` / `db:stop` | локальний Supabase (потрібен Docker) |

## Структура

```
src/
  main.tsx, router.tsx        точка входу; маршрути (history-режим, чисті адреси)
  supabase.ts, queryClient.ts клієнт Supabase (лише anon key), TanStack Query
  theme/                      tokens.css, fonts.css, mantine-theme.ts, palette.ts
  components/                 LevelIcon, GradeTile, ContourBackground
  features/                   екрани (home, …)
  lib/                        класи, рівні тощо
supabase/                     config.toml, migrations/, functions/_shared/, seed.sql
scripts/check-dist.ts         перевірка збірки
e2e/                          Playwright
wrangler.jsonc                Cloudflare Workers static assets: dist/ + SPA-fallback
```

Prod: **https://geography-app.alexglotov67.workers.dev/**

## Фаза 0 — закрито 12.10.2026

- Каркас застосунку, тема Mantine з дизайн-токенів (палітри, шрифти, висоти елементів ≥ 44 px, без тіней).
- Шрифти Golos Text, Unbounded, JetBrains Mono (латиниця, одна вага — логіни й паролі) — з пакетів `@fontsource` у бандлі (OFL), без CDN.
- Головна «Вибір класу» за макетом `Main.dc.html` (стан гостя); інші маршрути — заглушки.
- Базові компоненти: іконка рівня «сходинки висоти», плитка класу, фон з ізоліній.
- Хостинг: Cloudflare Workers зі статичними ресурсами (`wrangler.jsonc`, SPA-fallback без `_redirects`).
- CI: lint, типи, Vitest, збірка, перевірка `dist/`, e2e через `wrangler dev`, локальний Supabase; ручний деплой БД на prod.
