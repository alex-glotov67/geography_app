# `_shared` — спільний код клієнта й Edge Functions

Чистий TypeScript без залежностей від браузера чи Deno (SPEC 3.3):

- `scoring/` — перевірка завдань `check(task, key, answer)`, одна для тренування, ДЗ і квізу (Фаза 1);
- `schemas/` — zod-схеми змісту й payload-ів (Фаза 1);
- `auth.ts`, `cors.ts`, `http.ts` — допоміжне для функцій (Фаза 2).

Фронт імпортує через alias `@shared/*` (vite.config.ts, tsconfig.app.json).
