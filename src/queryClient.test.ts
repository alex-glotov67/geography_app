import { notFound } from '@tanstack/react-router'
import { shouldRetry } from './queryClient'

describe('повтори запитів', () => {
  it('мережевий збій — до 2 повторів', () => {
    expect(shouldRetry(0, new Error('Failed to fetch'))).toBe(true)
    expect(shouldRetry(1, new Error('Failed to fetch'))).toBe(true)
    expect(shouldRetry(2, new Error('Failed to fetch'))).toBe(false)
  })
  it('«не знайдено» — без повторів', () => {
    expect(shouldRetry(0, notFound())).toBe(false)
  })
})
