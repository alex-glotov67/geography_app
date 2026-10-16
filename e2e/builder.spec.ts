import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import * as XLSX from 'xlsx'

/*
 * Фаза 3 (SPEC 10): довідник програми в інтерфейсі й дерево уроків. Демо-вчитель і демо-довідник —
 * із seed (лише локально й у CI); справжній seed/outcomes-g8.csv у тести не підключається.
 * Змінює БД — лише проєкт desktop, послідовно; повторний запуск без db reset теж проходить.
 */
test.describe.configure({ mode: 'serial' })
test.skip(({ isMobile }) => isMobile, 'конструктор — лише для комп\'ютера (SPEC 10.1)')

async function loginTeacher(page: Page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Логін' }).fill('demo-teacher@example.invalid')
  await page.getByLabel('Пароль', { exact: true }).fill('demo-teacher-2026')
  await page.getByRole('button', { name: 'Увійти' }).click()
  await expect(page).toHaveURL(/\/t$/)
}

const DEMO_CSV = readFileSync('seed/demo-outcomes.csv')

/** Той самий демо-довідник у XLSX + один новий результат у темі 1 розділу 1 */
function demoXlsxWithNewOutcome(): Buffer {
  const text = DEMO_CSV.toString('utf8').replace(/^\uFEFF/, '')
  const rows = text.trim().split(/\r?\n/).map((l) => l.split(';'))
  const sample = rows.find((r, i) => i > 0 && r[2] === '1' && r[4] === '1')!
  rows.push(['', sample[1]!, '1', sample[3]!, '1', sample[5]!, 'ДЕМО: новий результат з XLSX', 'ДЕМО-джерело'])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Довідник')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

test('довідник: повторний імпорт без змін, XLSX з новим результатом, помилки з рядками, експорт', async ({ page }) => {
  await loginTeacher(page)
  await page.getByRole('link', { name: 'Довідник програми' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /Довідник програми/ })).toBeVisible()
  const file = page.getByLabel('Файл довідника (CSV або XLSX)')

  // 1. Той самий демо-файл — нових 0, усі без змін
  await file.setInputFiles({ name: 'demo-outcomes.csv', mimeType: 'text/csv', buffer: DEMO_CSV })
  const check = page.getByRole('region', { name: /Перевірка: demo-outcomes\.csv/ })
  await expect(check).toContainText('нових 0')
  await check.getByRole('button', { name: 'Скасувати' }).click()

  // 2. Файл зі старим стовпцем «ГР» і помилкою — пояснення, нічого не записано
  await file.setInputFiles({
    name: 'old.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Код;Клас;№ розділу;Назва розділу;№ теми;Назва теми;ГР;Результат;Джерело\n;8;1;Р;1;Т;ГР1;Текст;Д\n'),
  })
  await expect(page.getByRole('region', { name: /Перевірка: old\.csv/ })).toContainText('«ГР» більше не потрібен')
  await expect(page.getByRole('button', { name: 'Імпортувати', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Скасувати' }).click()

  // 3. XLSX з новим результатом — код генерується, після імпорту видно в дереві
  await file.setInputFiles({
    name: 'demo.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: demoXlsxWithNewOutcome(),
  })
  const xlsxCheck = page.getByRole('region', { name: /Перевірка: demo\.xlsx/ })
  const firstRun = (await xlsxCheck.innerText()).includes('нових 1')
  if (firstRun) {
    await page.getByRole('button', { name: 'Імпортувати', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('нових 1')
  } else {
    await expect(xlsxCheck).toContainText('нових 0') // повторний запуск: уже імпортовано
    await page.getByRole('button', { name: 'Скасувати' }).click()
  }
  await page.getByText(/^Тема 1\./).first().click()
  await expect(page.getByText('ДЕМО: новий результат з XLSX')).toBeVisible()

  // 4. Експорт — CSV з кодами (формат 10.6)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Експортувати CSV' }).click()
  const csv = readFileSync(await (await download).path()!, 'utf8')
  expect(csv.split('\r\n')[0]).toBe('\uFEFFКод;Клас;№ розділу;Назва розділу;№ теми;Назва теми;Результат;Джерело')
  expect(csv).toMatch(/\n8-1-1-\d{2};8;1;.*ДЕМО: новий результат з XLSX/)
})

test('уроки: дерево класу зі статусами, новий урок з адресою за номером', async ({ page }) => {
  await loginTeacher(page)
  await page.getByRole('link', { name: 'Уроки й конструктор' }).click()
  await expect(page.getByRole('tab', { name: '8 клас', selected: true })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'demo-relief' })).toContainText('Опубліковано')

  await page.getByRole('button', { name: 'Новий урок' }).click()
  const form = page.getByRole('form', { name: /Новий урок · 8 клас/ })
  const number = form.getByLabel('№ уроку')
  await number.fill('42')
  const slug = await form.getByLabel('Адреса: /lesson/…').inputValue()
  expect(slug).toMatch(/^g8-u42(-\d+)?$/)
  await form.getByLabel('Тема уроку').fill('ДЕМО: тестовий урок')
  await form.getByRole('button', { name: 'Створити й відкрити конструктор' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /Урок 42\. ДЕМО: тестовий урок/ })).toBeVisible()
  await expect(page.getByText(`/lesson/${slug} · чернетка`)).toBeVisible()

  await page.getByRole('link', { name: 'До уроків' }).click()
  await page.getByRole('searchbox').fill('тестовий')
  await expect(page.getByRole('row').filter({ hasText: slug })).toContainText('Чернетка')
})
