/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/**
 * <link rel="preload"> для шрифтів першого екрана (SPEC 13.7): Golos Text 400 і 600, Unbounded 700, кирилиця.
 * Імена файлів у збірці мають хеш, тому посилання додаються після збірки з бандла.
 */
/**
 * Адреса Supabase для збірки (SPEC 3.5): без неї збірка падає, а не публікує сайт, що не вантажить уроки.
 * Значення — Build variables у Cloudflare Workers Builds (docs/setup.md, 4.1); у CI — локальний Supabase
 * або заглушки. http дозволено лише для локального Supabase.
 */
function supabaseOrigin(env: Record<string, string>): string {
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY
  const missing = [!url && 'VITE_SUPABASE_URL', !key && 'VITE_SUPABASE_PUBLISHABLE_KEY'].filter(Boolean)
  if (missing.length) {
    throw new Error(
      `Збірка без ${missing.join(' і ')}: задай їх як Build variables у Cloudflare Workers Builds ` +
        `(Settings → Build → Variables and secrets) або в .env.local — docs/setup.md, розділ 4.1`,
    )
  }
  const u = new URL(url!)
  const local = ['127.0.0.1', 'localhost'].includes(u.hostname)
  if (u.protocol !== 'https:' && !local) throw new Error(`VITE_SUPABASE_URL має бути https: ${url}`)
  return u.origin
}

/** <link rel="preconnect"> до Supabase: з'єднання (DNS, TLS) готове до першого запиту (LCP уроку) */
function preconnect(origin: string): Plugin {
  return {
      name: 'geo-preconnect-supabase',
      apply: 'build',
      transformIndexHtml: () => [
        { tag: 'link', attrs: { rel: 'preconnect', href: origin, crossorigin: '' }, injectTo: 'head-prepend' },
        { tag: 'link', attrs: { rel: 'dns-prefetch', href: origin }, injectTo: 'head-prepend' },
      ],
    }
  }

  function preloadFonts(patterns: RegExp[]): Plugin {
    return {
      name: 'geo-preload-fonts',
      apply: 'build',
      transformIndexHtml: {
        order: 'post',
        handler(_html, ctx) {
          const files = Object.keys(ctx.bundle ?? {})
          return patterns.map((pattern) => {
            const file = files.find((f) => pattern.test(f))
            if (!file) throw new Error(`preloadFonts: у збірці немає шрифту ${pattern} — перевір @fontsource`)
            return {
              tag: 'link',
              attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `/${file}`, crossorigin: '' },
              injectTo: 'head' as const,
            }
          })
        },
      },
    }
  }

  export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const origin = command === 'build' ? supabaseOrigin(env) : null
  return {
    plugins: [
      react(),
      ...(origin ? [preconnect(origin)] : []),
      preloadFonts([
        /^assets\/golos-text-cyrillic-400-normal-[\w-]+\.woff2$/,
        // 600 — заголовки секцій, кнопки, питання завдань: без preload пізня підміна зсувала вміст (CLS)
        /^assets\/golos-text-cyrillic-600-normal-[\w-]+\.woff2$/,
        /^assets\/unbounded-cyrillic-700-normal-[\w-]+\.woff2$/,
      ]),
    ],
    resolve: {
      alias: {
        '@': r('./src'),
        // Спільний код клієнта й Edge Functions (перевірка завдань, zod-схеми) — SPEC 3.3
        '@shared': r('./supabase/functions/_shared'),
      },
    },
    build: {
      target: 'es2020',
      sourcemap: false,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/_shared/**/*.test.ts'],
      css: true,
      coverage: {
        provider: 'v8',
        // SPEC 15: 100 % гілок модуля перевірки відповідей
        include: ['supabase/functions/_shared/scoring/**/*.ts'],
        exclude: ['**/*.test.ts', '**/types.ts'],
        thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
      },
    },
  }
})
