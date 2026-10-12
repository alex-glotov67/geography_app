/** Рівні завдань (SPEC 6.1, 7): порядок — від нижчої «сходинки» до вищої. */
export const LEVELS = ['base', 'middle', 'sufficient', 'high'] as const
export type Level = (typeof LEVELS)[number]

export const LEVEL_LABEL: Record<Level, string> = {
  base: 'Базовий',
  middle: 'Середній',
  sufficient: 'Достатній',
  high: 'Високий',
}
