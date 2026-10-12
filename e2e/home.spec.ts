import { expect, test } from '@playwright/test'

test('головна: 4 класи, вхід і квіз; немає горизонтальної прокрутки', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Географія' })).toBeVisible()
  for (const g of [6, 7, 8, 9]) await expect(page.getByRole('link', { name: `${g} клас` })).toBeVisible()
  await expect(page.getByRole('link', { name: /Увійти$/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Живий квіз/ })).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('шрифти завантажуються локально, без зовнішніх CDN', async ({ page }) => {
  const external: string[] = []
  page.on('request', (r) => {
    const url = new URL(r.url())
    if (url.hostname !== 'localhost') external.push(r.url())
  })
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  expect(await page.evaluate(() => document.fonts.check('700 34px Unbounded', 'Географія'))).toBe(true)
  expect(await page.evaluate(() => document.fonts.check('400 17px "Golos Text"', 'Уроки'))).toBe(true)
  expect(external).toEqual([])
})

test('цілі дотику на головній — не менше 44 px', async ({ page }) => {
  await page.goto('/')
  const small = await page.$$eval('a, button, input, select, textarea', (els) =>
    els
      .map((el) => ({ text: el.textContent?.trim() ?? el.tagName, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && (box.height < 44 || box.width < 44))
      .map(({ text, box }) => `${text}: ${Math.round(box.width)}×${Math.round(box.height)}`),
  )
  expect(small).toEqual([])
})

test.describe('чисті адреси (history-режим)', () => {
  for (const path of ['/login', '/quiz', '/grade/8', '/lesson/g8-u05']) {
    test(`${path} відкривається напряму і після оновлення`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('h1')).toBeVisible()
      await page.reload()
      await expect(page.locator('h1')).toBeVisible()
      expect(new URL(page.url()).pathname).toBe(path)
    })
  }

  test('перехід з плитки класу без перезавантаження', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: '8 клас' }).click()
    await expect(page).toHaveURL(/\/grade\/8$/)
    await expect(page.getByRole('heading', { name: '8 клас' })).toBeVisible()
  })
})
