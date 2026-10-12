import { LEVELS, LEVEL_LABEL, type Level } from '@/lib/levels'
import classes from './LevelIcon.module.css'

const BARS = [
  { x: 0, y: 16, h: 8 },
  { x: 9, y: 11, h: 13 },
  { x: 18, y: 6, h: 18 },
  { x: 27, y: 0, h: 24 },
] as const

export interface LevelIconProps {
  level: Level
  /** Показати слово поруч: «Базовий рівень». Без нього іконка має `aria-label`. */
  withLabel?: boolean
  /** Ширина іконки в px; висота — пропорційно (34 × 24 у макетах). */
  size?: number
}

/**
 * Іконка «сходинки висоти»: рівень завдання — кількість зафарбованих сходинок кольором рівня
 * (SPEC 7, 13.1). Колір не єдиний носій змісту: є кількість сходинок і слово.
 */
export function LevelIcon({ level, withLabel = false, size = 34 }: LevelIconProps) {
  const n = LEVELS.indexOf(level) + 1
  const label = `${LEVEL_LABEL[level]} рівень`
  const icon = (
    <svg
      width={size}
      height={(size * 24) / 34}
      viewBox="0 0 34 24"
      role={withLabel ? undefined : 'img'}
      aria-label={withLabel ? undefined : label}
      aria-hidden={withLabel ? true : undefined}
      focusable="false"
      data-level={level}
    >
      {BARS.map((b, i) => (
        <rect
          key={b.x}
          x={b.x}
          y={b.y}
          width={6}
          height={b.h}
          rx={1.5}
          fill={i < n ? `var(--level-${level})` : 'var(--line)'}
          data-filled={i < n}
        />
      ))}
    </svg>
  )
  if (!withLabel) return icon
  return (
    <span className={classes.withLabel}>
      {icon}
      <span className={classes.label} style={{ color: `var(--level-${level}-fg)` }}>
        {label}
      </span>
    </span>
  )
}
