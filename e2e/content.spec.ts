import { expect, test } from '@playwright/test'

/*
 * Публічні уроки (SPEC 8.1, Фаза 1) проти локального Supabase з демо-змістом:
 * npm run db:reset && npm run seed && npm run build && npm run e2e
 */

test('клас: демо-урок у своєму розділі з позначкою ДЕМО; пошук', async ({ page }) => {
  await page.goto('/grade/8')
  await expect(page.getByRole('heading', { name: 'Розділ 1. ДЕМО: розділ про рельєф' })).toBeVisible()
  const card = page.getByRole('link', { name: /ДЕМО: рельєф/ })
  await expect(card).toHaveAttribute('href', '/lesson/demo-relief')
  await page.getByRole('searchbox', { name: 'Знайти урок' }).fill('океан')
  await expect(page.getByText('Нічого не знайдено за запитом «океан».')).toBeVisible()
})

test('клас без уроків — «Уроки готуються»', async ({ page }) => {
  await page.goto('/grade/6')
  await expect(page.getByRole('heading', { name: 'Уроки готуються' })).toBeVisible()
})

test('урок: блоки, терміни, відео після кліку, спрощений режим, ДЗ для гостя', async ({ page }) => {
  const bodies: string[] = []
  page.on('response', async (r) => {
    if (r.url().includes('/rest/v1/')) bodies.push(await r.text().catch(() => ''))
  })
  await page.goto('/lesson/demo-relief')
  await expect(page.getByRole('heading', { level: 1, name: 'ДЕМО: рельєф' })).toBeVisible()
  for (const h of ['Що ти дізнаєшся', 'Пояснення', 'Ключові терміни', 'Відео', 'Завдання']) {
    await expect(page.getByRole('heading', { level: 2, name: h, exact: true })).toBeVisible()
  }
  // Терміни розгортаються
  const term = page.getByRole('button', { name: 'Низовина' })
  await expect(term).toHaveAttribute('aria-expanded', 'false')
  await term.click()
  await expect(term).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText(/Рівнина з висотами до 200 м/)).toBeVisible()
  // Зображення з alt, таблиця з джерелом, PDF
  await expect(page.getByRole('img', { name: /горизонталі навколо вершини/ })).toBeVisible()
  await expect(page.getByText(/Джерело: ДЕМО — вигадані дані/)).toBeVisible()
  await expect(page.getByRole('link', { name: /робочий аркуш/ })).toHaveAttribute('href', /lesson-media\/.+\.pdf$/)
  // Відео: до кліку немає iframe; після — youtube-nocookie
  await expect(page.locator('iframe')).toHaveCount(0)
  await page.getByRole('button', { name: /Відтворити відео/ }).click()
  await expect(page.locator('iframe')).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\//)
  // Рівні тренування
  await expect(page.getByRole('link', { name: /Базовий.*2 завдання/ })).toHaveAttribute('href', '/lesson/demo-relief/practice?level=base')
  // ДЗ: гість бачить кількість і пропозицію увійти, але не зміст завдань
  await expect(page.getByText(/2 завдання\. Вчитель видає ДЗ/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Увійти, щоб виконати онлайн' })).toHaveAttribute('href', '/login')
  // Спрощений режим: простіший текст, без блоків «для повного режиму»
  await page.getByRole('switch', { name: 'Спрощений режим' }).click()
  await expect(page.getByText('ДЕМО. Низькі рівнини — це низовини. Вищі рівнини — це височини.')).toBeVisible()
  await expect(page.getByText(/тут вчитель розповість/)).toHaveCount(0)
  await expect(page.getByText(/1 завдання\. Вчитель видає ДЗ/)).toBeVisible()
  // Нічого із secure-завдань (ДЗ, квіз) не прийшло з API
  expect(bodies.join('\n')).not.toMatch(/ДЕМО \((ДЗ|квіз)\)/)
  await expect(page.locator('body')).not.toContainText('ДЕМО (ДЗ)')
})

test('тренування: фільтр рівня і миттєва перевірка', async ({ page }) => {
  await page.goto('/lesson/demo-relief/practice?level=base')
  await expect(page.getByRole('heading', { level: 1, name: 'Перевір себе' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Базовий', exact: false }).first()).toHaveAttribute('aria-current', 'page')
  await page.getByRole('radio', { name: 'Низовини й височини' }).check()
  await page.getByRole('button', { name: 'Перевірити' }).first().click()
  await expect(page.getByRole('status').first()).toContainText('Так! Рівнини — це низовини й височини.')
  await page.getByRole('link', { name: 'Усі рівні' }).click()
  await expect(page.getByRole('button', { name: 'Перевірити' })).toHaveCount(8)
})

test('невідомий урок — «Урок не знайдено»', async ({ page }) => {
  await page.goto('/lesson/nema-takoho')
  await expect(page.getByRole('heading', { name: 'Урок не знайдено' })).toBeVisible()
})

test('урок без стрибків: CLS ≤ 0,05 (SPEC 15)', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { __cls: number }).__cls = 0
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })
  await page.goto('/lesson/demo-relief')
  await expect(page.getByRole('heading', { level: 1, name: 'ДЕМО: рельєф' })).toBeVisible()
  await page.waitForTimeout(1500)
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls)
  expect(cls).toBeLessThanOrEqual(0.05)
})
