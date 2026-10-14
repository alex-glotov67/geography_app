import { parseNumber } from './parse'

describe('numeric: десятковий роздільник — кома або крапка', () => {
  it.each([
    ['2061', 2061],
    ['0,5', 0.5],
    ['0.5', 0.5],
    ['-3,25', -3.25],
    ['2 061', 2061],
    ['2 061,5', 2061.5],
    [' 35 ', 35],
  ])('«%s» → %d', (raw, n) => {
    expect(parseNumber(raw)).toBe(n)
  })
  it.each(['', 'дві', '1,2,3', '1.2.3', '1,', ',5', '1e3'])('«%s» — не число', (raw) => {
    expect(parseNumber(raw)).toBeNull()
  })
})
