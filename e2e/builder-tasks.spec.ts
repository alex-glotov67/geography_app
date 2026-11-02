import { expect, test, type Page } from '@playwright/test'

/*
 * Фаза 3 · 3.5b (SPEC 10.2, 10.3): завдання в блоках «Тренування» і «ДЗ» — вибір з банку
 * (тренування — лише відкриті, ДЗ — лише захищені, відкрите — через захищену копію), «Нове завдання»
 * з блоку з автододаванням, підсумки, окреме ДЗ спрощеного варіанта, публікація.
 * Демо-вчитель і демо-завдання (seed). Змінює БД — desktop, послідовно.
 */
test.skip(({ isMobile }) => isMobile, 'конструктор — лише для комп\'ютера')

const SAVED = /Збережено о \d{2}:\d{2}|Усі зміни збережено/
const id = Date.now().toString(36)
const title = `ДЕМО: завдання в уроці ${id}`

async function loginTeacher(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Логін' }).fill('demo-teacher@example.invalid')
  await page.getByLabel('Пароль', { exact: true }).fill('demo-teacher-2026')
  await page.getByRole('button', { name: 'Увійти' }).click()
  await expect(page).toHaveURL(/\/t$/)
}

const status = (page: Page) => page.getByRole('status').filter({ hasText: /Збережено|збережено|Зберігаємо|Не збережено|незбережені/ })

async function addBlock(page: Page, type: RegExp) {
  await page.getByRole('button', { name: '+ Додати блок' }).click()
  await page.getByRole('group', { name: 'Тип нового блоку' }).getByRole('button', { name: type }).click()
}

test('тренування й ДЗ: банк, захищена копія, нове завдання з блоку, підсумки, публікація', async ({ page, browser }) => {
  await loginTeacher(page)
  await page.goto('/t/lessons?grade=8')
  await page.getByRole('button', { name: 'Новий урок' }).click()
  await page.getByLabel('№ уроку').fill('45')
  await page.getByLabel('Тема уроку').fill(title)
  const slug = await page.getByLabel('Адреса: /lesson/…').inputValue()
  await page.getByRole('button', { name: 'Створити й відкрити конструктор' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(title)

  // ── Тренування: лише відкриті з банку ─────────────────────────────────────
  await addBlock(page, /^Тренування/)
  const practice = page.getByRole('group', { name: 'Завдання тренування' }).first()
  await practice.getByRole('button', { name: '+ з банку' }).click()
  const picker = page.getByRole('dialog', { name: 'Відкриті завдання для тренування' })
  await picker.getByRole('searchbox').fill('ДЕМО')
  await expect(picker.getByText('ДЕМО (ДЗ): яким кольором')).toHaveCount(0) // захищене — не для тренування
  await picker.getByRole('button', { name: /^Додати: ДЕМО: які форми рельєфу/ }).first().click()
  await picker.getByRole('button', { name: /^Додати: ДЕМО: на карті масштабу 1 : 1 000 000/ }).first().click()
  await picker.getByRole('button', { name: 'Готово' }).click()
  await expect(practice.getByRole('listitem')).toHaveCount(2)
  await expect(practice).toContainText('За рівнями: Базовий 1 · Високий 1')

  // ── ДЗ: захищене — «Додати», відкрите — «Захищена копія й додати» ─────────
  await addBlock(page, /^Домашнє завдання/)
  const homework = page.getByRole('group', { name: 'Завдання ДЗ', exact: true })
  await homework.getByRole('button', { name: '+ з банку' }).click()
  const hwPicker = page.getByRole('dialog', { name: 'Захищені завдання для ДЗ' })
  await hwPicker.getByRole('searchbox').fill('ДЕМО')
  await hwPicker.getByRole('button', { name: /^Додати: ДЕМО \(ДЗ\): яким кольором/ }).first().click()
  await hwPicker.getByRole('button', { name: /^Захищена копія й додати: ДЕМО: розташуй від найнижчого/ }).first().click()
  await hwPicker.getByRole('button', { name: 'Готово' }).click()
  await expect(homework.getByRole('listitem')).toHaveCount(2)
  await expect(homework).toContainText('Разом 2 бали · рівні: Базовий 1 · Достатній 1 · ГР1 1 · ГР2 1')

  // ── Окреме ДЗ спрощеного варіанта: «нове завдання» з блоку → назад з автододаванням ──
  await page.getByRole('checkbox', { name: 'Окремі завдання ДЗ для спрощеного режиму' }).check()
  const simplified = page.getByRole('group', { name: 'Завдання ДЗ спрощеного варіанта' })
  await expect(status(page)).toHaveText(SAVED, { timeout: 8000 })
  await simplified.getByRole('button', { name: '+ нове завдання' }).click()
  await expect(page).toHaveURL(/\/t\/tasks\/new\?/)
  await expect(page.getByRole('link', { name: 'До уроку' })).toBeVisible()
  await expect(page.getByRole('radio', { name: /^Захищене/ })).toBeChecked()
  await expect(page.getByRole('radio', { name: /^Відкрите/ })).toBeDisabled()
  await page.getByRole('textbox', { name: 'Текст завдання' }).fill(`ДЕМО (ДЗ, спрощено): що показує зелений колір? ${id}`)
  await page.getByRole('textbox', { name: 'Варіант 1' }).fill('ДЕМО: низовини')
  await page.getByRole('textbox', { name: 'Варіант 2' }).fill('ДЕМО: гори')
  await page.getByRole('textbox', { name: 'Варіант 3' }).fill('ДЕМО: моря')
  await page.getByRole('button', { name: 'Зберегти завдання' }).click()
  await expect(page).toHaveURL(new RegExp(`/t/lessons/[0-9a-f-]{36}$`))
  await expect(page.getByRole('group', { name: 'Завдання ДЗ спрощеного варіанта' }).getByRole('listitem')).toContainText(`що показує зелений колір? ${id}`)

  // ── «Нове завдання» з тренування — відкрите ───────────────────────────────
  await page.getByRole('group', { name: 'Завдання тренування' }).first().getByRole('button', { name: '+ нове завдання' }).click()
  await expect(page.getByRole('radio', { name: /^Відкрите/ })).toBeChecked()
  await expect(page.getByRole('radio', { name: /^Захищене/ })).toBeDisabled()
  await page.getByRole('button', { name: /^Обчислення/ }).click()
  await page.getByRole('textbox', { name: 'Текст завдання' }).fill(`ДЕМО: різниця висот, м ${id}`)
  await page.getByRole('textbox', { name: 'Правильна відповідь' }).fill('150')
  await page.getByRole('button', { name: 'Зберегти завдання' }).click()
  await expect(page).toHaveURL(new RegExp(`/t/lessons/[0-9a-f-]{36}$`))
  const practiceAfter = page.getByRole('group', { name: 'Завдання тренування' }).first()
  await expect(practiceAfter.getByRole('listitem')).toHaveCount(3)
  await expect(practiceAfter).toContainText('За рівнями: Базовий 2 · Високий 1')
  await expect(status(page)).toHaveText(SAVED, { timeout: 8000 })

  // Після перезавантаження — усе на місці
  await page.reload()
  await expect(page.getByRole('group', { name: 'Завдання тренування' }).first().getByRole('listitem')).toHaveCount(3)
  await expect(page.getByRole('group', { name: 'Завдання ДЗ', exact: true }).getByRole('listitem')).toHaveCount(2)

  // ── Публікація → учень бачить тренування ─────────────────────────────────
  await page.getByRole('button', { name: 'Опублікувати', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Опублікувати урок' })
  await expect(dialog).toContainText('Помилок немає')
  await dialog.getByLabel('Я переглянув урок, зміст правильний').check()
  await dialog.getByRole('button', { name: 'Опублікувати' }).click()
  await expect(page.getByText('Опубліковано (версія 1)')).toBeVisible()

  const guest = await browser.newPage()
  await guest.goto(`/lesson/${slug}/practice`)
  await expect(guest.getByText(`ДЕМО: різниця висот, м ${id}`)).toBeVisible()
  await guest.goto(`/lesson/${slug}`)
  await expect(guest.getByRole('region', { name: 'Домашнє завдання' }).or(guest.locator('section:has(#hw-title)'))).toContainText('2')
  await guest.close()
})
