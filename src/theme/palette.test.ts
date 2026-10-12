import { palette } from './palette'

describe('palette', () => {
  it('дає 10 відтінків від світлого до темного з базовим кольором на індексі 6', () => {
    const p = palette('#1D5E8C')
    expect(p).toHaveLength(10)
    expect(p[6]).toBe('#1d5e8c')
    const lum = (hex: string) => Number.parseInt(hex.slice(1, 3), 16) + Number.parseInt(hex.slice(3, 5), 16) + Number.parseInt(hex.slice(5, 7), 16)
    for (let i = 1; i < 10; i++) expect(lum(p[i]!)).toBeLessThan(lum(p[i - 1]!))
  })

  it('фіксує задані відтінки точними значеннями токенів', () => {
    const p = palette('#1D5E8C', { 0: '#EEF4F9', 7: '#123F60' })
    expect(p[0]).toBe('#eef4f9')
    expect(p[7]).toBe('#123f60')
  })

  it('відхиляє колір не у форматі #rrggbb', () => {
    expect(() => palette('blue')).toThrow(/#rrggbb/)
  })
})
