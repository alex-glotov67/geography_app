import { expect, test, type Page } from '@playwright/test'

/*
 * Фаза 3 · 3.5 (SPEC 10.3): банк завдань і редактор першої хвилі. Демо-вчитель і демо-урок
 * (seed, лише локально й у CI). Змінює БД — desktop, послідовно; повторний запуск без db reset теж.
 */
test.describe.configure({ mode: 'serial' })
test.skip(({ isMobile }) => isMobile, 'кабінет вчителя — сценарій для комп\'ютера')

async function loginTeacher(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Логін' }).fill('demo-teacher@example.invalid')
  await page.getByLabel('Пароль', { exact: true }).fill('demo-teacher-2026')
  await page.getByRole('button', { name: 'Увійти' }).click()
  await expect(page).toHaveURL(/\/t$/)
}

const id = Date.now().toString(36)

test('нове завдання «Вибір відповіді»: форма, перегляд, «Спробувати як учень», збереження', async ({ page }) => {
  await loginTeacher(page)
  await page.getByRole('link', { name: 'Банк завдань' }).click()
  await expect(page.getByRole('row').filter({ hasText: 'ДЕМО: які форми рельєфу переважають' })).toContainText('урок 1')
  await page.getByRole('link', { name: 'Нове завдання' }).click()

  // Порожня форма не зберігається — помилки біля полів
  await page.getByRole('button', { name: 'Зберегти завдання' }).click()
  await expect(page.getByText('Завдання не збережено — виправ позначені поля.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Зміст завдання' }).getByRole('alert').first()).toHaveText('не заповнено')

  await page.getByRole('textbox', { name: 'Текст завдання' }).fill(`ДЕМО: яка рівнина найбільша в Україні? ${id}`)
  await page.getByRole('textbox', { name: 'Варіант 1' }).fill('ДЕМО: Придніпровська низовина')
  await page.getByRole('textbox', { name: 'Варіант 2' }).fill('ДЕМО: Причорноморська низовина')
  await page.getByRole('textbox', { name: 'Варіант 3' }).fill('ДЕМО: Поліська низовина')
  await page.getByRole('button', { name: 'Варіант 2 — правильний' }).click()
  await page.getByRole('checkbox', { name: 'Перемішувати варіанти' }).uncheck()
  await page.getByRole('textbox', { name: 'Коментар при помилці' }).fill('ДЕМО: подивись на фізичну карту')

  // «Як побачить учень» — та сама картка, що в тренуванні
  const preview = page.getByRole('complementary', { name: 'Як побачить учень' })
  await page.getByRole('button', { name: 'Спробувати як учень' }).click()
  await preview.getByRole('radio', { name: 'ДЕМО: Поліська низовина' }).check()
  await preview.getByRole('button', { name: 'Перевірити' }).click()
  await expect(preview).toContainText('ДЕМО: подивись на фізичну карту')
  await preview.getByRole('radio', { name: 'ДЕМО: Причорноморська низовина' }).check()
  await preview.getByRole('button', { name: 'Перевірити' }).click()
  await expect(preview).toContainText('Правильно!')

  await page.getByRole('button', { name: 'Зберегти завдання' }).click()
  await expect(page).toHaveURL(/\/t\/tasks\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('status').filter({ hasText: 'Збережено' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Варіант 2' })).toHaveValue('ДЕМО: Причорноморська низовина')
  await expect(page.getByRole('button', { name: 'Варіант 2 — правильний' })).toHaveAttribute('aria-pressed', 'true')
})

test('числова й «так / ні»: з каталогу, кома в числі, помилка ключа', async ({ page }) => {
  await loginTeacher(page)
  await page.goto('/t/tasks/new')
  await page.getByRole('button', { name: /^Обчислення/ }).click()
  await page.getByRole('textbox', { name: 'Текст завдання' }).fill(`ДЕМО: перепад висот, км ${id}`)
  await page.getByRole('button', { name: 'Зберегти завдання' }).click()
  await expect(page.getByRole('region', { name: 'Зміст завдання' })).toContainText('Правильна відповідь')
  await expect(page.getByText('Завдання не збережено — виправ позначені поля.')).toBeVisible()
  await page.getByRole('textbox', { name: 'Правильна відповідь' }).fill('2,5')
  await page.getByRole('textbox', { name: 'Одиниця' }).fill('км')
  const preview = page.getByRole('complementary', { name: 'Як побачить учень' })
  await preview.getByRole('textbox').fill('2.5')
  await preview.getByRole('button', { name: 'Перевірити' }).click()
  await expect(preview).toContainText('Правильно!')
  await page.getByRole('button', { name: 'Зберегти завдання' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Збережено' })).toBeVisible()

  await page.goto('/t/tasks/new?type=true_false')
  await expect(page.getByRole('button', { name: /^Так чи ні/ })).toBeVisible()
  await page.getByRole('textbox', { name: 'Твердження 1' }).fill('ДЕМО: Карпати — молоді гори')
  await page.getByRole('button', { name: '+ твердження' }).click()
  await page.getByRole('textbox', { name: 'Твердження 2' }).fill('ДЕМО: Україна переважно гориста')
  await page.getByRole('group', { name: 'Твердження 2: відповідь' }).getByRole('button', { name: 'Ні' }).click()
  await page.getByRole('button', { name: 'Зберегти завдання' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Збережено' })).toBeVisible()
})

test('завдання в опублікованому уроці: попередження → нова версія, учні бачать стару до повторної публікації', async ({ page, browser }) => {
  // Що зараз бачить учень у тренуванні (опублікована версія)
  const guest = await browser.newPage()
  await guest.goto('/lesson/demo-relief/practice')
  const firstCard = () => guest.getByRole('region', { name: 'Завдання 1' })
  const shown = await firstCard().locator('h2').innerText()

  await loginTeacher(page)
  await page.goto('/t/tasks')
  await page.getByRole('link', { name: /^ДЕМО: які форми рельєфу переважають/ }).first().click()
  await page.getByRole('textbox', { name: 'Текст завдання' }).fill(`ДЕМО: які форми рельєфу переважають на рівнинній місцевості? (${id})`)
  await page.getByRole('button', { name: 'Зберегти завдання' }).click()
  const dialog = page.getByRole('alertdialog', { name: /Використовується в 1 опублікованих уроках/ })
  await expect(dialog).toContainText('Учні побачать зміни після повторної публікації')
  await expect(dialog.getByRole('link', { name: /8 клас · урок 1/ })).toHaveAttribute('href', /\/t\/lessons\//)
  await dialog.getByRole('button', { name: 'Зберегти завдання' }).click()
  await expect(page.getByRole('status')).toContainText(/Збережено як версію \d+|Збережено\./)

  await guest.reload()
  await expect(firstCard()).toContainText(shown)
  await expect(firstCard()).not.toContainText(`(${id})`)
  await guest.close()
})

test('банк: фільтри, «Дублювати», «Захищена копія», архів', async ({ page }) => {
  await loginTeacher(page)
  await page.goto('/t/tasks')
  await page.getByRole('searchbox').fill(id)
  await page.getByLabel('Тип').selectOption({ label: 'Обчислення' })
  await expect(page.getByRole('row')).toHaveCount(2) // заголовок + одне завдання
  await page.getByLabel('Тип').selectOption({ label: 'Усі' })

  const row = page.getByRole('row').filter({ hasText: `найбільша в Україні? ${id}` })
  await row.getByRole('button', { name: /Захищена копія|Створити захищену копію/ }).click()
  await expect(page).toHaveURL(/\/t\/tasks\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('radio', { name: /Захищене/ })).toBeChecked()
  await page.getByRole('link', { name: 'Банк завдань' }).click()
  await page.getByRole('searchbox').fill(id)
  await page.getByLabel('Вид').selectOption('secure')
  await expect(page.getByRole('row').filter({ hasText: `найбільша в Україні? ${id}` })).toHaveCount(1)

  const secureRow = page.getByRole('row').filter({ hasText: `найбільша в Україні? ${id}` })
  await secureRow.getByRole('button', { name: /^Архівувати/ }).click()
  await expect(page.getByRole('row').filter({ hasText: `найбільша в Україні? ${id}` })).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Архів' }).check()
  await expect(page.getByRole('row').filter({ hasText: `найбільша в Україні? ${id}` })).toHaveCount(1)
})
