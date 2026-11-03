import { expect, test, type Page } from '@playwright/test'

/*
 * Нові паролі пакетом (SPEC 5.1): 30 учнів → «Вибрати всіх у класі» → підтвердження → пачки по 10
 * з прогресом; збій другої пачки не губить першу й третю, «Повторити» дотискає решту; картки — лише
 * для цих учнів; до друку піти зі сторінки — з попередженням.
 * Окремий клас 9-Г (вигадані учні), тож не заважає accounts.spec. Змінює БД — desktop, послідовно.
 */
test.describe.configure({ mode: 'serial' })
test.skip(({ isMobile }) => isMobile, 'кабінет вчителя — сценарій для комп\'ютера')

const TEACHER = { email: 'demo-teacher@example.invalid', password: 'demo-teacher-2026' }
const SURNAMES = ['Андрієнко', 'Бойко', 'Василенко', 'Гнатюк', 'Дмитренко', 'Євтушенко', 'Жук', 'Зінченко', 'Іваненко', 'Карпенко']
const NAMES = ['Олег', 'Марта', 'Тарас']
const CLASS_CSV = ['№;ПІБ;Клас', ...SURNAMES.flatMap((s, i) => NAMES.map((n, j) => `${i * 3 + j + 1};${s} ${n};9-Г`))].join('\n')

async function openClass9g(page: Page) {
  await page.goto('/t/classes')
  await expect(page.getByRole('heading', { name: 'Новий клас' })).toBeVisible()
  const tile = page.getByRole('link', { name: /^9-Г/ })
  if (await tile.isVisible()) {
    await tile.click()
  } else {
    await page.getByRole('combobox', { name: 'Клас', exact: true }).selectOption('9')
    await page.getByLabel('Літера').selectOption('Г')
    await page.getByRole('button', { name: 'Створити клас' }).click()
  }
  await expect(page.getByRole('heading', { level: 1, name: /9-Г/ })).toBeVisible()
  // Перший запуск — імпорт 30 учнів; повторний (без db reset) — клас уже заповнено
  if (await page.getByRole('heading', { level: 1, name: /30 учнів/ }).isVisible()) return
  await page.getByRole('button', { name: 'Імпортувати список' }).click()
  await page.getByLabel('Файл зі списком').setInputFiles({ name: 'class-9g.csv', mimeType: 'text/csv', buffer: Buffer.from(CLASS_CSV) })
  await page.getByRole('button', { name: 'Додати 30 учнів і створити логіни' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Додано 30 учнів' })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Готово' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /30 учнів/ })).toBeVisible()
}

test('нові паролі для 30 вибраних: пачки, збій однієї пачки, «Повторити», картки, попередження', async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => {
      ;(window as unknown as { __printed: number }).__printed = ((window as unknown as { __printed?: number }).__printed ?? 0) + 1
    }
  })
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Логін' }).fill(TEACHER.email)
  await page.getByLabel('Пароль', { exact: true }).fill(TEACHER.password)
  await page.getByRole('button', { name: 'Увійти' }).click()
  await expect(page).toHaveURL(/\/t$/)
  await openClass9g(page)

  // Друга пачка «падає» в мережі; решта йде до функції
  let resets = 0
  await page.route('**/functions/v1/manage-students', async (route) => {
    if (route.request().method() === 'POST' && route.request().postDataJSON()?.action === 'reset-password' && ++resets === 2) {
      return route.abort('connectionreset')
    }
    return route.continue()
  })

  await page.getByRole('checkbox', { name: 'Вибрати всіх у класі' }).check()
  await expect(page.getByRole('checkbox', { name: 'Вибрати: Бойко М.' })).toBeChecked()
  await page.getByRole('button', { name: 'Нові паролі для вибраних (30)' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('Нові паролі для 30 учнів')
  await expect(confirm).toContainText('Старі паролі цих учнів перестануть діяти')
  await confirm.getByRole('button', { name: 'Створити нові паролі' }).click()

  const panel = page.getByRole('region', { name: 'Нові паролі' })
  await expect(panel.getByText('Готово: нові паролі для 20 з 30.')).toBeVisible({ timeout: 60_000 })
  expect(resets).toBe(3) // збій другої пачки не зупинив третю
  const failed = panel.getByRole('alert')
  await expect(failed).toContainText('Не вдалося (10)')
  await expect(failed.getByRole('listitem')).toHaveCount(10)
  await expect(failed).toContainText('немає зв’язку')
  await expect(panel.getByRole('button', { name: 'Друкувати картки (20)' })).toBeEnabled()

  // До друку піти зі сторінки — попередження; відмова лишає на місці
  const leave = page.waitForEvent('dialog')
  void page.getByRole('link', { name: 'Класи й учні' }).click()
  const dialog = await leave
  expect(dialog.message()).toContain('Нові паролі ще не надруковано')
  await dialog.dismiss()
  await expect(page.getByRole('heading', { level: 1, name: /9-Г/ })).toBeVisible()

  // «Повторити» — лише невдалі
  await page.unroute('**/functions/v1/manage-students')
  await failed.getByRole('button', { name: 'Повторити (10)' }).click()
  await expect(panel.getByText('Готово: нові паролі для 30 з 30.')).toBeVisible({ timeout: 60_000 })
  await expect(panel.getByRole('alert')).toHaveCount(0)

  // Картки — рівно для цих 30 учнів
  await panel.getByRole('button', { name: 'Друкувати картки (30)' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed?: number }).__printed ?? 0)).toBe(1)
  await expect(page.locator('[data-print-cards] article')).toHaveCount(30)
  await expect(page.locator('[data-print-cards] section')).toHaveCount(3)
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))

  // Після друку — закривається без попередження
  page.once('dialog', (d) => {
    throw new Error(`Неочікуване попередження: ${d.message()}`)
  })
  await panel.getByRole('button', { name: 'Закрити' }).click()
  await expect(panel).toHaveCount(0)
})
