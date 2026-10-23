import { expect, test, type Browser, type Page } from '@playwright/test'

/*
 * Фаза 3 · 3.3 (SPEC 10.1–10.2): конструктор уроку — автозбереження, порядок блоків, вихід з екрана,
 * конфлікт двох вкладок, перегляд чернетки, перевірка й публікація, зняття з публікації.
 * Лише демо-вчитель і демо-зміст (seed, локально й у CI). Змінює БД — desktop, послідовно.
 */
test.describe.configure({ mode: 'serial' })
test.skip(({ isMobile }) => isMobile, 'конструктор — лише для комп\'ютера (SPEC 10.1)')

const SAVED = /Збережено о \d{2}:\d{2}|Усі зміни збережено/

async function loginTeacher(page: Page) {
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

let lessonUrl = ''
let slug = ''
const title = `ДЕМО: конструктор ${Date.now().toString(36)}`

async function newPage(browser: Browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await loginTeacher(page)
  return page
}

test('новий урок: блоки, автозбереження, порядок, після перезавантаження все на місці', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await loginTeacher(page)
  await page.goto('/t/lessons?grade=8')
  await page.getByRole('button', { name: 'Новий урок' }).click()
  await page.getByLabel('№ уроку').fill('44')
  await page.getByLabel('Тема уроку').fill(title)
  slug = await page.getByLabel('Адреса: /lesson/…').inputValue()
  await page.getByRole('button', { name: 'Створити й відкрити конструктор' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`8 клас · Урок 44. ${title}`)
  await expect(page.getByText('Чернетка — учні не бачать')).toBeVisible()
  lessonUrl = page.url()

  await addBlock(page, /^Мета/)
  await page.getByLabel('Пункт 1', { exact: true }).fill('ДЕМО: перший пункт мети')
  await page.getByLabel('Пункт 2', { exact: true }).fill('ДЕМО: другий пункт мети')
  await addBlock(page, /^Терміни/)
  await page.getByLabel('Термін 1', { exact: true }).fill('ДЕМО-термін')
  await page.getByLabel('Визначення 1', { exact: true }).fill('ДЕМО: визначення простою мовою')
  await addBlock(page, /^Текст/)
  await page.getByRole('region', { name: /Текст, блок 3/ }).getByRole('textbox', { name: 'Текст', exact: true }).fill('ДЕМО: перший абзац.\n\nДругий абзац.')
  await expect(status(page)).toHaveText(SAVED, { timeout: 8000 })

  // Порядок: «Текст» вгору — кнопкою (запасний режим без перетягування)
  await page.getByRole('button', { name: 'Текст — вище' }).click()
  await expect(page.getByRole('list', { name: 'Блоки уроку' }).getByRole('listitem').nth(1)).toContainText('Текст')
  await expect(status(page)).toHaveText(SAVED, { timeout: 8000 })

  await page.reload()
  await expect(page.getByLabel('Пункт 1', { exact: true })).toHaveValue('ДЕМО: перший пункт мети')
  await expect(page.getByRole('list', { name: 'Блоки уроку' }).getByRole('listitem')).toHaveText([/Мета/, /Текст/, /Терміни/])
  await expect(page.getByRole('region', { name: /Текст, блок 2/ }).getByRole('textbox', { name: 'Текст', exact: true })).toHaveValue('ДЕМО: перший абзац.\n\nДругий абзац.')
})

test('вихід з екрана одразу після правки — зміни збережено', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await loginTeacher(page)
  await page.goto(lessonUrl)
  await page.getByLabel('Термін 1', { exact: true }).fill('ДЕМО-термін змінений')
  await page.getByRole('link', { name: 'Уроки' }).click() // без очікування 2 с — роутер чекає збереження
  await expect(page).toHaveURL(/\/t\/lessons/)
  await page.goto(lessonUrl)
  await expect(page.getByLabel('Термін 1', { exact: true })).toHaveValue('ДЕМО-термін змінений')
})

test('конфлікт двох вкладок: вибір «Перезаписати моїми змінями»', async ({ browser }) => {
  const a = await newPage(browser)
  const b = await newPage(browser)
  await a.goto(lessonUrl)
  await b.goto(lessonUrl)
  await expect(b.getByRole('textbox', { name: 'Тема', exact: true })).toHaveValue(title)

  await a.getByRole('textbox', { name: 'Тема', exact: true }).fill(`${title} (вкладка А)`)
  await expect(status(a)).toHaveText(SAVED, { timeout: 8000 })
  await b.getByRole('textbox', { name: 'Тема', exact: true }).fill(`${title} (вкладка Б)`)
  const banner = b.getByRole('alert').filter({ hasText: 'Урок змінено в іншій вкладці' })
  await expect(banner).toBeVisible({ timeout: 8000 })
  await banner.getByRole('button', { name: 'Перезаписати моїми змінями' }).click()
  await expect(status(b)).toHaveText(SAVED, { timeout: 8000 })

  await a.reload()
  await expect(a.getByRole('textbox', { name: 'Тема', exact: true })).toHaveValue(`${title} (вкладка Б)`)
  await a.getByRole('textbox', { name: 'Тема', exact: true }).fill(title)
  await expect(status(a)).toHaveText(SAVED, { timeout: 8000 })
  await a.close()
  await b.close()
})

test('перегляд чернетки, перевірка, публікація → учень бачить урок → зняття з публікації', async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await loginTeacher(page)
  await page.goto(lessonUrl)

  // Перегляд: та сама сторінка уроку з чернетки, лише вчителю
  await page.getByRole('button', { name: 'Телефон' }).click()
  const preview = page.frameLocator('iframe[title="Перегляд чернетки очима учня"]')
  await expect(preview.getByRole('heading', { level: 1, name: title })).toBeVisible()
  await expect(preview.getByText('ДЕМО: перший пункт мети')).toBeVisible()

  // Комп'ютер — справжній вигляд LessonDesktop: список уроків розділу збоку, вміст — у широкій колонці
  await page.getByRole('button', { name: 'Комп’ютер' }).click()
  const desktop = page.frameLocator('iframe[title="Перегляд чернетки очима учня"]')
  await expect(desktop.getByRole('navigation', { name: 'Уроки розділу' })).toContainText(title)
  const h1 = desktop.getByRole('heading', { level: 1, name: title })
  await expect(h1).toBeVisible()
  expect((await desktop.locator('main').boundingBox())!.width).toBeGreaterThan(700)
  await page.getByRole('button', { name: 'Редагування' }).click()

  // TODO(teacher) блокує публікацію (і в панелі перевірки, і в діалозі)
  const text = page.getByRole('region', { name: /Текст, блок 2/ }).getByRole('textbox', { name: 'Текст', exact: true })
  await text.fill('TODO(teacher): дописати пояснення')
  await expect(page.getByRole('region', { name: 'Перевірка перед публікацією' })).toContainText('В уроці лишилося TODO(teacher)')
  await page.getByRole('button', { name: 'Опублікувати', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Опублікувати урок' })
  await expect(dialog).toContainText('В уроці лишилося TODO(teacher)')
  await expect(dialog.getByRole('button', { name: 'Опублікувати' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Скасувати' }).click()

  await text.fill('ДЕМО: пояснення без заготовок.')
  await page.getByRole('button', { name: 'Опублікувати', exact: true }).click()
  await dialog.getByLabel('Я переглянув урок, зміст правильний').check()
  await dialog.getByRole('button', { name: 'Опублікувати' }).click()
  await expect(page.getByText('Опубліковано (версія 1)')).toBeVisible()
  await expect(page.getByLabel('Адреса: /lesson/…')).toBeDisabled() // адреса вже в QR

  const guest = await browser.newPage()
  await guest.goto(`/lesson/${slug}`)
  await expect(guest.getByRole('heading', { level: 1, name: title })).toBeVisible()
  await expect(guest.getByText('ДЕМО: пояснення без заготовок.')).toBeVisible()

  // Правка після публікації: учні бачать стару версію, у шапці — «є неопубліковані зміни»
  await page.getByLabel('Пункт 2', { exact: true }).fill('ДЕМО: змінений пункт')
  await expect(page.getByText('Опубліковано (версія 1) · є неопубліковані зміни')).toBeVisible({ timeout: 8000 })
  await guest.reload()
  await expect(guest.getByText('ДЕМО: другий пункт мети')).toBeVisible()

  await page.getByRole('button', { name: 'Зняти з публікації' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Зняти з публікації' }).click()
  await expect(page.getByText('Чернетка — учні не бачать')).toBeVisible()
  await guest.reload()
  await expect(guest.getByRole('heading', { name: 'Урок не знайдено' })).toBeVisible()
  await guest.close()

  await page.getByRole('link', { name: 'Уроки' }).click()
  await page.getByRole('searchbox').fill(title)
  await expect(page.getByRole('row').filter({ hasText: title })).toContainText('Чернетка')
})
