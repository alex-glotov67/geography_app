import { expect, test } from '@playwright/test'

/*
 * Горизонталі в шапках (зауваження до Фази 2): жодних видимих кінців ліній — контури обрізає лише
 * правий/нижній край шапки, зліва й згори вони цілі; не наближаються до кнопки «Увійти».
 */
const PAGES = ['/', '/lesson/demo-relief', '/grade/6']

for (const width of [360, 768, 1440]) {
  for (const path of PAGES) {
    test(`${path} при ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(path)
      await page.locator('svg[data-contours]').first().waitFor()
      await expect(page.locator('#splash')).toHaveCount(0, { timeout: 2000 })
      const report = await page.$$eval('svg[data-contours]', (svgs) =>
        svgs.map((svg) => {
          const frame = svg.parentElement!.getBoundingClientRect()
          const login = [...document.querySelectorAll('a')].find((a) => a.textContent?.trim() === 'Увійти')?.getBoundingClientRect()
          const problems: string[] = []
          for (const p of svg.querySelectorAll('path')) {
            const r = p.getBoundingClientRect()
            if (r.left < frame.left + 1) problems.push(`обрізано зліва: ${Math.round(r.left)} < ${Math.round(frame.left)}`)
            if (r.top < frame.top + 1) problems.push(`обрізано згори: ${Math.round(r.top)} < ${Math.round(frame.top)}`)
            if (login && r.top < login.bottom + 8 && r.right > login.left - 8 && r.left < login.right + 8)
              problems.push(`близько до «Увійти»: верх ${Math.round(r.top)}, кнопка до ${Math.round(login.bottom)}`)
          }
          return problems
        }),
      )
      expect(report.flat()).toEqual([])
    })
  }
}
