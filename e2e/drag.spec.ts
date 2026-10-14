import { expect, test, type Locator, type Page } from '@playwright/test'

/*
 * Перетягування (dnd-kit) у тренуванні: комп'ютер — мишею, телефон — дотиком з утриманням
 * (Chromium CDP: справжні touch-події). Швидкий змах без утримання не тягне — прокрутка не ламається.
 */

const center = async (l: Locator) => {
  const b = (await l.boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

async function drag(page: Page, from: Locator, to: Locator, { hold = 260 } = {}) {
  await from.scrollIntoViewIfNeeded()
  const a = await center(from)
  const isTouch = test.info().project.name === 'phone'
  if (!isTouch) {
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.mouse.move(a.x + 10, a.y + 10, { steps: 3 })
    const b = await center(to)
    await page.mouse.move(b.x, b.y, { steps: 12 })
    await page.mouse.up()
    return
  }
  const cdp = await page.context().newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
  const b = await center(to)
  if (hold === 0) {
    // Швидкий змах: дотик і перший рух — одним пакетом, без очікування між ними (як на телефоні,
    // де перший touchmove приходить за ~16 мс); інакше під навантаженням тест сам «утримує» палець
    await Promise.all([touch('touchStart', a.x, a.y), touch('touchMove', a.x, a.y + (b.y - a.y) / 2)])
  } else {
    await touch('touchStart', a.x, a.y)
    await page.waitForTimeout(hold) // утримання > 180 мс — починається перетягування
  }
  for (let i = 1; i <= 12; i++) await touch('touchMove', a.x + ((b.x - a.x) * i) / 12, a.y + ((b.y - a.y) * i) / 12)
  await page.waitForTimeout(50)
  await touch('touchEnd', b.x, b.y)
}

const card = (page: Page, title: RegExp) => page.getByRole('heading', { name: title }).locator('xpath=ancestor::section[1]')

test.beforeEach(async ({ page }) => {
  await page.goto('/lesson/demo-relief/practice')
  await expect(page.getByRole('heading', { level: 1, name: 'Перевір себе' })).toBeVisible()
  // splash (до 1,5 с) лежить поверх сторінки — тягнути лише після нього
  await expect(page.locator('#splash')).toHaveCount(0)
})

test('ordering: перетягнути «Низовина» на перше місце', async ({ page }) => {
  const box = card(page, /розташуй від найнижчого/)
  const rows = box.getByRole('listitem')
  await drag(page, rows.filter({ hasText: 'Низовина' }), rows.first())
  await expect(rows.first()).toContainText('Низовина')
})

test('matching: перетягнути варіант у рядок', async ({ page }) => {
  const box = card(page, /встанови відповідність/)
  await drag(page, box.getByRole('group', { name: 'Варіанти' }).getByRole('button', { name: 'до 200 м' }), box.getByRole('button', { name: 'Низовина: порожньо' }))
  await expect(box.getByRole('button', { name: 'Низовина: до 200 м' })).toBeVisible()
})

test('categorize: перетягнути картку в групу і назад', async ({ page }) => {
  const box = card(page, /розподіли рівнини/)
  const group = box.getByRole('region', { name: 'Низовини' })
  await drag(page, box.getByRole('region', { name: 'Нерозподілені картки' }).getByRole('button', { name: 'Поліська' }), group)
  await expect(group).toContainText('Поліська')
  await drag(page, group.getByText('Поліська'), box.getByRole('region', { name: 'Нерозподілені картки' }))
  await expect(box.getByRole('region', { name: 'Нерозподілені картки' }).getByRole('button', { name: 'Поліська' })).toBeVisible()
})

test.describe('дотик: прокрутка', () => {
  // Залежить від того, чи встигне головний потік обробити перший рух до 180 мс таймера утримання:
  // під паралельним навантаженням тестів зрідка ні (на телефоні перший touchmove — ~16 мс). Повтори
  // лише тут; решта тестів перетягування — без повторів.
  test.describe.configure({ retries: 2 })

  test('швидкий змах без утримання не перетягує', async ({ page }) => {
  test.skip(test.info().project.name !== 'phone', 'лише для дотику')
  const box = card(page, /розташуй від найнижчого/)
  const rows = box.getByRole('listitem')
  const before = await rows.allInnerTexts()
  await drag(page, rows.last(), rows.first(), { hold: 0 })
  expect(await rows.allInnerTexts()).toEqual(before)
})
})
