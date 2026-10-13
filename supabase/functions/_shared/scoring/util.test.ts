import { clamp01, share } from './util.ts'

describe('util', () => {
  it('share: порожній список — 0, інакше частка true', () => {
    expect(share([])).toBe(0)
    expect(share([true, false, true, true])).toBe(0.75)
  })
  it('clamp01 тримає частку в межах 0–1', () => {
    expect(clamp01(-0.5)).toBe(0)
    expect(clamp01(1.5)).toBe(1)
    expect(clamp01(0.4)).toBe(0.4)
  })
})
