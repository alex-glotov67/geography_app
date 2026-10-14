import { VIEW_H, VIEW_W, contours } from './contours'

describe('горизонталі (зауваження до Фази 2)', () => {
  const cs = contours()

  it('усі контури замкнені — жодних видимих кінців ліній', () => {
    for (const c of cs) expect(c.d.endsWith('Z')).toBe(true)
  })

  it('зліва повністю всередині viewBox — обрізає лише край шапки праворуч і знизу', () => {
    for (const c of cs) expect(c.minX).toBeGreaterThanOrEqual(6)
  })

  it('верх зовнішнього контуру — нижче зони кнопки «Увійти» (≥ 45 % висоти)', () => {
    expect(Math.min(...cs.map((c) => c.minY))).toBeGreaterThanOrEqual(VIEW_H * 0.45)
  })

  it('рівні проміжки: межі сусідніх контурів відстоять на сталий крок, без перетинів', () => {
    const gaps = cs.slice(1).map((c, i) => c.minX - cs[i]!.minX)
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0]!, 0)
    expect(gaps[0]).toBeLessThan(0) // кожен наступний — зовні попереднього
    expect(Math.max(...cs.map((c) => c.maxX))).toBeLessThanOrEqual(VIEW_W)
  })
})
