import { expect, test, type Page } from '@playwright/test'

/*
 * Робота в завданні не перебивається (зауваження до Фази 2): фокус вікна, інвалідація запиту,
 * перехід туди-назад і перезавантаження вкладки — вміст і відповідь на місці, скелетона немає.
 * Потрібна збірка з тестовим хуком: npm run build:e2e
 */
const BUSY = '[aria-busy="true"]'

async function watchSkeleton(page: Page) {
  await page.evaluate((sel) => {
    const w = window as unknown as { __skeletonSeen: number }
    w.__skeletonSeen = 0
    new MutationObserver(() => {
      if (document.querySelector(sel)) w.__skeletonSeen++
    }).observe(document.body, { childList: true, subtree: true, attributes: true })
  }, BUSY)
}
const skeletonSeen = (page: Page) => page.evaluate(() => (window as unknown as { __skeletonSeen: number }).__skeletonSeen)

test('відповідь і вміст переживають фокус, інвалідацію, перехід і перезавантаження', async ({ page }) => {
  await page.goto('/lesson/demo-relief/practice')
  const answer = page.getByRole('radio', { name: 'Низовини й височини' })
  await answer.check()
  await page.getByRole('radio', { name: 'Гори' }).first().isVisible()
  const order = page.getByRole('heading', { name: /розташуй від найнижчого/ }).locator('xpath=ancestor::section[1]').getByRole('listitem')
  const orderBefore = await order.allInnerTexts()
  expect(orderBefore).toHaveLength(3)
  await watchSkeleton(page)

  // 1. Вкладка у фоні й назад, фокус вікна
  await page.evaluate(() => {
    for (const state of ['hidden', 'visible']) {
      Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    window.dispatchEvent(new Event('blur'))
    window.dispatchEvent(new Event('focus'))
  })
  // 2. Інвалідація запитів (фоновий перезапит)
  const hooked = await page.evaluate(async () => {
    const qc = (window as unknown as { __geoQueryClient?: { invalidateQueries: () => Promise<void> } }).__geoQueryClient
    if (!qc) return false
    await qc.invalidateQueries()
    return true
  })
  expect(hooked, 'потрібна збірка npm run build:e2e').toBe(true)
  await page.waitForTimeout(800)
  await expect(answer).toBeChecked()
  expect(await order.allInnerTexts()).toEqual(orderBefore)

  // 3. Перехід до уроку і назад — дані з кешу, без скелетона; відповідь на місці
  await page.getByRole('link', { name: /ДЕМО: рельєф/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'ДЕМО: рельєф' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('radio', { name: 'Низовини й височини' })).toBeChecked()
  expect(await skeletonSeen(page)).toBe(0)

  // 4. Перезавантаження вкладки (телефон вивантажив фонову вкладку) — відповідь і порядок збережено
  await page.reload()
  await expect(page.getByRole('radio', { name: 'Низовини й височини' })).toBeChecked()
  expect(await order.allInnerTexts()).toEqual(orderBefore)
})

test('перевірена відповідь лишається перевіреною після перемонтування', async ({ page }) => {
  await page.goto('/lesson/demo-relief/practice?level=base')
  await page.getByRole('radio', { name: 'Низовини й височини' }).check()
  await page.getByRole('button', { name: 'Перевірити' }).first().click()
  await expect(page.getByRole('status').first()).toContainText('Так!')
  await page.getByRole('link', { name: 'Усі рівні' }).click()
  await page.getByRole('link', { name: 'Базовий', exact: false }).first().click()
  await expect(page.getByRole('status').first()).toContainText('Так!')
})
