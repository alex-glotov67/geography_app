import { defineConfig, devices } from '@playwright/test'

/**
 * e2e проти production-збірки, яку віддає `wrangler dev` з wrangler.jsonc — той самий SPA-режим
 * статичних ресурсів (not_found_handling), що й на Cloudflare Workers.
 * Два профілі: телефон (основний для учнів) і комп'ютер (SPEC 13.4).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    locale: 'uk-UA',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    // Рушій Safari (локально: E2E_WEBKIT=1 npx playwright install webkit && E2E_WEBKIT=1 npm run e2e).
    // Не заміна справжньому iPhone: дотик через WebKit емулювати не можна — тут лише миша.
    ...(process.env.E2E_WEBKIT ? [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }] : []),
  ],
  webServer: {
    command: 'npm run preview:worker',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
