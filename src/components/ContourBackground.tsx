import { contours, VIEW_H, VIEW_W } from './contours'

const PATHS = contours().map((c) => c.d)

export interface ContourBackgroundProps {
  /** Колір ліній — токен: `var(--water)`, `var(--grade-8)` */
  color?: string
  /** Прозорість ліній, у межах 0,12–0,35 за SPEC 13.3 */
  opacity?: number
}

/**
 * Горизонталі у фоні шапки (SPEC 13.3): вкладені замкнені контури з рівним кроком (contours.ts).
 * Прив'язані до правого краю й масштабуються з висотою шапки; батько — `position: relative;
 * overflow: hidden`, тож зайве обрізає край шапки, а не рамка малюнка. Суто декоративні.
 */
export function ContourBackground({ color = 'var(--water)', opacity = 0.35 }: ContourBackgroundProps) {
  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMaxYMax meet"
      fill="none"
      stroke={color}
      strokeWidth={1}
      vectorEffect="non-scaling-stroke"
      aria-hidden="true"
      focusable="false"
      data-contours=""
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        height: '100%',
        aspectRatio: `${VIEW_W} / ${VIEW_H}`,
        pointerEvents: 'none',
        opacity: Math.min(0.35, Math.max(0.12, opacity)),
      }}
    >
      {PATHS.map((d) => (
        <path key={d} d={d} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}
