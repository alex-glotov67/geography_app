/**
 * Замір Lighthouse на телефоні (SPEC 15, 13.7) проти production-збірки через `wrangler dev`.
 * Lighthouse не в залежностях проєкту: запускається через npx із зафіксованою версією,
 * Chrome — Chromium з Playwright (та сама версія, що й в e2e), тож заміри відтворювані.
 *
 * Запуск: npm run build && npm run perf -- / /lesson/demo-relief
 * Результат: таблиця в консолі + JSON-звіти в .lighthouse/ (у .gitignore).
 */
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const LIGHTHOUSE = 'lighthouse@13.5.0'
const BASE = 'http://127.0.0.1:4173'
const OUT = join(import.meta.dirname, '..', '.lighthouse')
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ['/']

interface Audit {
  numericValue?: number
}
interface Report {
  categories: Record<string, { score: number | null }>
  audits: Record<string, Audit>
}

async function waitForServer(url: string, ms = 30_000) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      /* ще стартує */
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`Сервер ${url} не відповів за ${ms / 1000} с`)
}

const server = spawn('npm', ['run', 'preview:worker'], { stdio: 'ignore', detached: true })
const stop = () => {
  if (server.pid) process.kill(-server.pid, 'SIGTERM')
}

try {
  await waitForServer(BASE)
  mkdirSync(OUT, { recursive: true })
  const rows: string[] = []
  for (const path of paths) {
    const file = join(OUT, `${path === '/' ? 'home' : path.replaceAll('/', '_').replace(/^_/, '')}.json`)
    execFileSync(
      'npx',
      [
        '-y',
        LIGHTHOUSE,
        BASE + path,
        '--only-categories=performance,accessibility',
        '--output=json',
        `--output-path=${file}`,
        '--chrome-flags=--headless=new --no-sandbox',
        '--quiet',
      ],
      { stdio: 'inherit', env: { ...process.env, CHROME_PATH: chromium.executablePath() } },
    )
    const r = JSON.parse(readFileSync(file, 'utf8')) as Report
    const ms = (id: string) => Math.round(r.audits[id]?.numericValue ?? NaN)
    const score = (id: string) => Math.round((r.categories[id]?.score ?? 0) * 100)
    const kib = Math.round((r.audits['total-byte-weight']?.numericValue ?? 0) / 1024)
    rows.push(
      `| ${path} | ${score('performance')} | ${score('accessibility')} | ${ms('first-contentful-paint')} | ${ms('largest-contentful-paint')} | ${ms('total-blocking-time')} | ${(r.audits['cumulative-layout-shift']?.numericValue ?? NaN).toFixed(3)} | ${kib} |`,
    )
  }
  console.log('\n| Сторінка | Performance | Accessibility | FCP, мс | LCP, мс | TBT, мс | CLS | Вага, КіБ |')
  console.log('|---|---|---|---|---|---|---|---|')
  for (const row of rows) console.log(row)
} finally {
  stop()
}
