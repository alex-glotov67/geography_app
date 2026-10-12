import type { CSSProperties } from 'react'

/**
 * Мотив «ізоліній» — тонкі замкнені горизонталі, як на фізичній карті (SPEC 13.3).
 * Лише в шапках і на тлі квізу; суто декоративний, тому прихований від екранних читачів.
 */
const SHAPES = {
  // Головна і вхід: «пагорб» з відкритими горизонталями схилу
  hero: {
    viewBox: '0 0 390 260',
    paths: [
      'M150 140 C 170 70, 300 50, 350 110 S 360 230, 270 230 S 130 210, 150 140 Z',
      'M180 140 C 195 95, 290 80, 325 120 S 330 205, 268 205 S 165 190, 180 140 Z',
      'M210 142 C 220 115, 280 105, 300 128 S 302 182, 265 182 S 200 170, 210 142 Z',
      'M238 143 C 244 130, 270 126, 279 138 S 278 160, 262 160 S 233 155, 238 143 Z',
      'M90 140 C 110 30, 330 10, 390 80',
      'M40 170 C 70 40, 360 -10, 400 50',
    ],
  },
  // Шапка уроку, тло квізу: лише замкнені горизонталі вершини
  peak: {
    viewBox: '0 0 300 220',
    paths: [
      'M40 120 C 50 50, 200 30, 250 90 S 250 200, 160 200 S 30 190, 40 120 Z',
      'M75 122 C 85 75, 195 62, 225 102 S 222 175, 158 175 S 68 168, 75 122 Z',
      'M108 124 C 115 98, 182 90, 200 112 S 196 152, 158 152 S 102 146, 108 124 Z',
      'M138 126 C 142 115, 165 112, 172 122 S 168 136, 157 136 S 135 133, 138 126 Z',
    ],
  },
} as const

export type ContourShape = keyof typeof SHAPES

export interface ContourBackgroundProps {
  shape?: ContourShape
  /** Колір ліній — CSS-значення, зазвичай токен: `var(--water)`, `var(--grade-8)`. */
  color?: string
  /** Прозорість ліній, у межах 0,12–0,35 за SPEC 13.3. */
  opacity?: number
  strokeWidth?: number
  width: number
  height: number
  /** Позиціонування всередині шапки (`position: relative` у батька). */
  style?: CSSProperties
  className?: string
}

export function ContourBackground({
  shape = 'hero',
  color = 'var(--water)',
  opacity = 0.35,
  strokeWidth = 1,
  width,
  height,
  style,
  className,
}: ContourBackgroundProps) {
  const { viewBox, paths } = SHAPES[shape]
  const clamped = Math.min(0.35, Math.max(0.12, opacity))
  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBox}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ position: 'absolute', pointerEvents: 'none', opacity: clamped, ...style }}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
