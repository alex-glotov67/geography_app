/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

/**
 * <link rel="preload"> для шрифтів першого екрана (SPEC 13.7): Golos Text 400 і Unbounded 700, кирилиця.
 * Імена файлів у збірці мають хеш, тому посилання додаються після збірки з бандла.
 */
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

export default defineConfig({
  plugins: [
    react(),
    preloadFonts([
      /^assets\/golos-text-cyrillic-400-normal-[\w-]+\.woff2$/,
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
})
