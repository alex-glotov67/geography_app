/**
 * Перевірка збірки перед деплоєм (SPEC 2.2, 15): у dist/ не має бути секретів.
 * Шукає: JWT з роллю service_role, секретні ключі Supabase нового формату (sb_secret_…),
 * назви серверних змінних середовища і приватні ключі. Ключі відповідей `secure`-завдань
 * живуть лише в БД (task_keys), тож у збірку потрапити не можуть; з Фази 1 тут додасться
 * перевірка, що в dist/ немає вмісту task_keys демо-пакета.
 *
 * Запуск: npm run build && npm run check:dist
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const DIST = join(import.meta.dirname, '..', 'dist')
const TEXT = /\.(js|mjs|css|html|json|map|txt|svg|webmanifest)$|_(redirects|headers)$/

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? files(p) : [p]
  })

const decodeJwtPayload = (jwt: string): Record<string, unknown> | null => {
  const part = jwt.split('.')[1]
  if (!part) return null
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

const RULES: { name: string; test: (text: string) => string[] }[] = [
  {
    name: 'JWT з роллю service_role',
    test: (t) =>
      [...t.matchAll(/eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g)]
        .map((m) => m[0])
        .filter((jwt) => decodeJwtPayload(jwt)?.role === 'service_role'),
  },
  { name: 'секретний ключ Supabase (sb_secret_)', test: (t) => t.match(/sb_secret_[\w-]{10,}/g) ?? [] },
  {
    name: 'назва серверної змінної',
    test: (t) => t.match(/SUPABASE_SERVICE_ROLE(_KEY)?|SERVICE_ROLE_KEY|SUPABASE_DB_PASSWORD|SUPABASE_ACCESS_TOKEN/g) ?? [],
  },
  { name: 'приватний ключ', test: (t) => t.match(/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g) ?? [] },
]

let found = 0
let checked = 0
for (const file of files(DIST)) {
  if (!TEXT.test(file)) continue
  checked++
  const text = readFileSync(file, 'utf8')
  for (const rule of RULES) {
    for (const hit of new Set(rule.test(text))) {
      found++
      console.error(`✗ ${relative(DIST, file)}: ${rule.name}: ${hit.slice(0, 24)}…`)
    }
  }
}

// SPA-fallback робить wrangler.jsonc (not_found_handling); правило `/* /index.html 200` у _redirects
// Workers вважає нескінченним циклом і ігнорує — не повертаємо його
const redirects = join(DIST, '_redirects')
if (files(DIST).includes(redirects) && /\/index\.html\s+200/.test(readFileSync(redirects, 'utf8'))) {
  found++
  console.error('✗ _redirects: правило на /index.html 200 конфліктує з not_found_handling у wrangler.jsonc')
}

if (checked === 0) {
  console.error('✗ dist/ порожня — спершу npm run build')
  process.exit(1)
}
if (found > 0) {
  console.error(`\nЗнайдено ${found} підозрілих збігів у dist/. Збірку не публікувати.`)
  process.exit(1)
}
console.log(`✓ dist/: перевірено ${checked} файлів, секретів не знайдено`)
