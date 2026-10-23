import { expect, test, type Page } from '@playwright/test'

/*
 * Ручне редагування довідника програми (SPEC 16, Фаза 3): коди не змінюються при редагуванні,
 * новий результат — наступний номер, архівований номер не перевикористовується, видалення — лише
 * архівування, номер теми з результатами заблокований, порядок у темі. Лише демо-вчитель (seed).
 */
test.skip(({ isMobile }) => isMobile, 'кабінет вчителя — сценарій для комп\'ютера')

async function loginTeacher(page: Page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Логін' }).fill('demo-teacher@example.invalid')
  await page.getByLabel('Пароль', { exact: true }).fill('demo-teacher-2026')
  await page.getByRole('button', { name: 'Увійти' }).click()
  await expect(page).toHaveURL(/\/t$/)
}

test('розділ → тема → результати: коди стабільні й не перевикористовуються, порядок, архів', async ({ page }) => {
  const id = Date.now().toString(36)
  await loginTeacher(page)
  await page.getByRole('link', { name: 'Довідник програми' }).click()

  // Новий розділ 8 класу — номер пропонується наступний
  await page.getByRole('button', { name: '+ Розділ' }).click()
  const newSection = page.getByRole('region', { name: 'Новий розділ' })
  const sectionNumber = await newSection.getByRole('spinbutton', { name: '№' }).inputValue()
  await newSection.getByRole('textbox', { name: 'Назва', exact: true }).fill(`ДЕМО: ручний розділ ${id}`)
  await newSection.getByRole('button', { name: 'Додати розділ' }).click()
  const section = page.getByRole('region', { name: `8 клас · Розділ ${sectionNumber}. ДЕМО: ручний розділ ${id}` })
  await expect(section).toBeVisible()

  await section.getByRole('button', { name: '+ Тема' }).click()
  await expect(section.getByRole('spinbutton', { name: '№' })).toHaveValue('1')
  await section.getByRole('textbox', { name: 'Назва', exact: true }).fill('ДЕМО: ручна тема')
  await section.getByRole('button', { name: 'Додати тему' }).click()
  const topic = section.getByRole('group', { name: 'Тема 1. ДЕМО: ручна тема' })
  const prefix = `8-${sectionNumber}-1-`

  const add = async (text: string) => {
    await topic.getByRole('button', { name: '+ Результат' }).click()
    const form = topic.getByRole('form', { name: /Новий результат/ })
    await form.getByRole('textbox', { name: 'Очікуваний результат' }).fill(text)
    await form.getByRole('textbox', { name: 'Джерело' }).fill('ДЕМО-джерело')
    await form.getByRole('button', { name: 'Додати' }).click()
  }
  await add('ДЕМО: перший результат')
  await expect(topic.getByText(`${prefix}01`)).toBeVisible()
  await add('ДЕМО: другий результат')
  await expect(topic.getByText(`${prefix}02`)).toBeVisible()

  // Дубль (інший регістр і пробіли) — та сама перевірка, що й в імпорті
  await topic.getByRole('button', { name: '+ Результат' }).click()
  const dup = topic.getByRole('form', { name: /Новий результат/ })
  await dup.getByRole('textbox', { name: 'Очікуваний результат' }).fill('  демо: ПЕРШИЙ   результат ')
  await dup.getByRole('textbox', { name: 'Джерело' }).fill('ДЕМО-джерело')
  await dup.getByRole('button', { name: 'Додати' }).click()
  await expect(dup).toContainText(`Такий результат у темі вже є (${prefix}01)`)
  await dup.getByRole('button', { name: 'Скасувати' }).click()

  // Редагування тексту — код той самий
  await topic.getByRole('button', { name: `Змінити ${prefix}01` }).click()
  const edit = topic.getByRole('form', { name: `Зміна ${prefix}01` })
  await edit.getByRole('textbox', { name: 'Очікуваний результат' }).fill('ДЕМО: перший результат (уточнено)')
  await edit.getByRole('button', { name: 'Зберегти' }).click()
  await expect(topic.getByRole('listitem').filter({ hasText: `${prefix}01` })).toContainText('(уточнено)')

  // Архів — номер 02 не перевикористовується
  await topic.getByRole('button', { name: `Архівувати ${prefix}02` }).click()
  await expect(topic.getByRole('button', { name: 'Архів (1)' })).toBeVisible()
  await add('ДЕМО: третій результат')
  await expect(topic.getByText(`${prefix}03`)).toBeVisible()

  // Порядок: 03 — вище 01 (кнопкою; перетягування — те саме збереження)
  await topic.getByRole('button', { name: `${prefix}03 — вище` }).click()
  await expect(topic.getByRole('list', { name: /Результати/ }).getByRole('listitem').first()).toContainText(`${prefix}03`)
  await page.reload()
  const topicAfter = section.getByRole('group', { name: 'Тема 1. ДЕМО: ручна тема' })
  // Єдина тема розділу відкрита одразу
  await expect(topicAfter.getByRole('list', { name: /Результати/ }).getByRole('listitem').first()).toContainText(`${prefix}03`)

  // Номер теми з результатами заблокований; назву змінити можна
  await topicAfter.getByRole('button', { name: 'Змінити тему' }).click()
  await expect(topicAfter.getByRole('spinbutton', { name: '№' })).toBeDisabled()
  await expect(topicAfter).toContainText('Номер уже є в кодах результатів')
  await topicAfter.getByRole('textbox', { name: 'Назва', exact: true }).fill('ДЕМО: ручна тема (нова назва)')
  await topicAfter.getByRole('button', { name: 'Зберегти' }).click()
  await expect(section.getByText('Тема 1. ДЕМО: ручна тема (нова назва)')).toBeVisible()
})
