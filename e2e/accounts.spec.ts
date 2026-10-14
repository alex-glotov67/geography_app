import { expect, test, type Page } from '@playwright/test'

/*
 * Приймання Фази 2 (SPEC 16, 15): вчитель імпортує список на 30 учнів і друкує картки; учень входить
 * з картки; повторний імпорт не дублює; архівований учень не входить; кабінет — лише вчителю.
 * Потрібні локальний Supabase з функціями (supabase start) і seed (демо-вчитель).
 * Сценарій змінює БД, тож лише в проєкті desktop і послідовно; перезапуск без db reset теж проходить.
 */
test.describe.configure({ mode: 'serial' })
test.skip(({ isMobile }) => isMobile, 'кабінет вчителя — сценарій для комп\'ютера')

const TEACHER = { email: 'demo-teacher@example.invalid', password: 'demo-teacher-2026' }

async function login(page: Page, loginValue: string, password: string) {
  await page.getByRole('textbox', { name: 'Логін' }).fill(loginValue)
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Увійти' }).click()
}

async function openClass8b(page: Page) {
  await page.goto('/t/classes')
  await expect(page.getByRole('heading', { name: 'Новий клас' })).toBeVisible() // список класів завантажено
  const tile = page.getByRole('link', { name: /^8-Б/ })
  if (!(await tile.isVisible())) {
    await page.getByLabel('Літера').selectOption('Б')
    await page.getByRole('button', { name: 'Створити клас' }).click()
  } else {
    await tile.click()
  }
  await expect(page.getByRole('heading', { level: 1, name: /8-Б/ })).toBeVisible()
}

/** Новий пароль учню — повертає його з таблиці «Логіни й паролі» */
async function resetPassword(page: Page, name: string): Promise<{ login: string; password: string }> {
  const row = page.getByRole('region', { name: 'Логіни й паролі' }).getByRole('row').filter({ hasText: name })
  const cell = (i: number) => row.getByRole('cell').nth(i)
  // У таблиці вже може бути попередній пароль цього учня — чекаємо новий
  const before = (await row.count()) ? (await cell(3).innerText()).trim() : null
  await page.getByRole('button', { name: `Новий пароль: ${name}` }).click()
  await page.getByRole('button', { name: 'Створити нові паролі' }).click()
  await expect(cell(3)).toHaveText(/^[a-z]+-[a-z]+-[2-9]{2}$/)
  if (before) await expect(cell(3)).not.toHaveText(before)
  return { login: (await cell(2).innerText()).trim(), password: (await cell(3).innerText()).trim() }
}

test('кабінет вчителя закритий: гість — на вхід з поверненням', async ({ page }) => {
  await page.goto('/t/classes')
  await expect(page).toHaveURL(/\/login\?redirect=%2Ft%2Fclasses/)
  await login(page, TEACHER.email, 'wrong-password')
  await expect(page.getByRole('alert')).toHaveText('Неправильний логін або пароль')
  await login(page, TEACHER.email, TEACHER.password)
  await expect(page).toHaveURL(/\/t\/classes$/)
})

test('імпорт 30 учнів (Windows-1251), повторний імпорт (UTF-8) без дублів, картки, вхід учня', async ({ page, browser }) => {
  await page.addInitScript(() => {
    window.print = () => {
      ;(window as unknown as { __printed: number }).__printed = ((window as unknown as { __printed?: number }).__printed ?? 0) + 1
    }
  })
  await page.goto('/login')
  await login(page, TEACHER.email, TEACHER.password)
  await expect(page).toHaveURL(/\/t$/)
  await openClass8b(page)

  // 1. Імпорт файлу у Windows-1251: ґ/ї/є/апостроф, по батькові, ВЕЛИКІ літери, дубль, інший клас
  await page.getByRole('button', { name: 'Імпортувати список' }).click()
  await page.getByLabel('Файл зі списком').setInputFiles('e2e/fixtures/class-8b.cp1251.csv')
  await expect(page.getByText('(кодування Windows-1251)')).toBeVisible()
  const plan = page.getByRole('region', { name: 'Імпорт учнів зі списку' }).getByRole('table')
  await expect(plan.getByRole('row').filter({ hasText: 'Ґудзь Богдан Іванович' })).toContainText('Ґудзь Б.')
  await expect(plan.getByRole('row').filter({ hasText: 'ГОНЧАРЕНКО КИРИЛО' })).toContainText('Гончаренко К.')
  await expect(plan.getByRole('row').filter({ hasText: 'Петренко Іван' })).toContainText('8-В')
  const confirm = page.getByRole('button', { name: /Додати \d+ учн\S* і створити логіни/ })
  const firstRun = (await confirm.innerText()).includes('Додати 30')
  if (firstRun) {
    await expect(plan.getByRole('row').filter({ hasText: 'Коваль Олена' }).last()).toContainText('Двічі у файлі, пропустити')
    await confirm.click()
    await expect(page.getByRole('status').filter({ hasText: 'Додано 30 учнів; створено 8-В' })).toBeVisible({ timeout: 60_000 })
    const fresh = page.getByRole('region', { name: 'Логіни й паролі' })
    await expect(fresh.getByRole('row')).toHaveCount(30) // заголовок + 29 учнів 8-Б
    await expect(fresh.getByRole('row').filter({ hasText: 'Бондар А.' }).getByRole('cell').nth(3)).toHaveText(/^[a-z]+-[a-z]+-[2-9]{2}$/)
    await page.getByRole('button', { name: 'Готово' }).click()
  } else {
    await page.getByRole('button', { name: 'Скасувати' }).click()
  }
  await expect(page.getByRole('heading', { level: 1, name: /29 учнів/ })).toBeVisible()

  // 2. Повторний імпорт того самого списку в UTF-8 — усі вже є, створювати нікого
  await page.getByRole('button', { name: 'Імпортувати список' }).click()
  await page.getByLabel('Файл зі списком').setInputFiles('e2e/fixtures/class-8b.utf8.csv')
  await expect(plan.getByText('Уже є в класі, пропустити')).toHaveCount(31) // 29 учнів 8-Б, дубль і учень 8-В
  await expect(page.getByRole('button', { name: 'Додати 0 учнів і створити логіни' })).toBeDisabled()
  await page.getByRole('button', { name: 'Скасувати' }).click()

  // 3. Картки входу: усім без відомого пароля — нові паролі, потім друк 3 аркушів (10 + 10 + 9)
  await page.getByRole('button', { name: 'Сховати паролі' }).click({ timeout: 1000 }).catch(() => {})
  await page.getByRole('button', { name: 'Друкувати картки входу' }).click()
  await expect(page.getByRole('alertdialog')).toContainText('нові паролі для 29 учнів')
  await page.getByRole('button', { name: 'Створити нові паролі' }).click()
  await page.getByRole('button', { name: 'Друкувати картки', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed?: number }).__printed ?? 0)).toBe(1)
  const sheets = page.locator('[data-print-cards] section')
  await expect(sheets).toHaveCount(3)
  await expect(page.locator('[data-print-cards] article')).toHaveCount(29)
  await expect(page.locator('[data-print-cards] article').first()).toContainText('8b-01')
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))

  // 4. Учень входить з картки: QR → /login?login=…, пароль з картки
  const card = await resetPassword(page, 'Бондар А.')
  const student = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await student.goto(`/login?login=${card.login}`)
  await expect(student.getByRole('textbox', { name: 'Логін' })).toHaveValue(card.login)
  await student.getByLabel('Пароль', { exact: true }).fill(card.password)
  await student.getByRole('button', { name: 'Увійти' }).click()
  await expect(student.getByRole('link', { name: 'Бондар А.' })).toBeVisible()
  await student.goto('/t')
  await expect(student).toHaveURL(/\/me$/) // учень не потрапляє в кабінет вчителя
  await expect(student.getByRole('heading', { name: 'Бондар А.' })).toBeVisible()
  await expect(student.getByText('Клас 8-Б')).toBeVisible()
  await student.getByRole('button', { name: 'Вийти' }).click()
  await expect(student.getByRole('link', { name: /Увійти$/ })).toBeVisible()

  // 5. Останній вхід видно вчителю
  await page.reload()
  await expect(page.getByRole('row').filter({ hasText: 'Бондар А.' })).not.toContainText('ще не входив')

  // 6. Архів вимикає вхід, повернення — вмикає
  await page.getByRole('button', { name: 'Архівувати: Бондар А.' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Архівувати' }).click()
  await expect(page.getByRole('button', { name: 'Архівувати: Бондар А.' })).toHaveCount(0)
  await student.goto('/login')
  await login(student, card.login, card.password)
  await expect(student.getByRole('alert')).toHaveText(/Вхід вимкнено|Цей акаунт вимкнено/)
  await page.getByRole('button', { name: /Архів \(1\)/ }).click()
  await page.getByRole('button', { name: 'Повернути з архіву: Бондар А.' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Повернути' }).click()
  await expect(page.getByRole('button', { name: 'Архівувати: Бондар А.' })).toBeVisible()
  await student.close()
})

test('«Спрощений режим» від вчителя вмикає спрощений вигляд уроку учню', async ({ page, browser }) => {
  await page.goto('/login')
  await login(page, TEACHER.email, TEACHER.password)
  await expect(page).toHaveURL(/\/t$/)
  await openClass8b(page)
  const toggle = page.getByRole('switch', { name: 'Спрощений режим: Ґудзь Б.' })
  await toggle.check()
  await expect(toggle).toBeChecked()
  const card = await resetPassword(page, 'Ґудзь Б.')

  const student = await browser.newPage()
  await student.goto(`/login?login=${card.login}`)
  await student.getByLabel('Пароль', { exact: true }).fill(card.password)
  await student.getByRole('button', { name: 'Увійти' }).click()
  await expect(student.getByRole('link', { name: 'Ґудзь Б.' })).toBeVisible()
  await student.goto('/lesson/demo-relief')
  await expect(student.getByRole('switch', { name: /Спрощений режим/ })).toBeChecked()
  await student.close()
  await toggle.uncheck()
})
