/**
 * Горизонталі для фону шапок (SPEC 13.3): вкладені замкнені контури «пагорба» з рівним кроком.
 *
 * Правила композиції (зауваження вчителя до Фази 2):
 * - жодних видимих кінців ліній: усі контури замкнені; що не вміщується — обрізає край шапки
 *   (overflow: hidden), а не рамка SVG — тому зліва контури повністю всередині viewBox;
 * - рівні проміжки, без перетинів: контур i = базова форма + i·крок по радіусу;
 * - композиція прив'язана до правого краю і масштабується з висотою шапки (viewBox 320×200,
 *   висота SVG = висота шапки); верх зовнішнього контуру — нижче зони кнопки «Увійти».
 */

export const VIEW_W = 320
export const VIEW_H = 200

export interface ContourOptions {
  cx?: number
  cy?: number
  /** Півосі найменшого контуру (овал вершини) */
  a?: number
  b?: number
  /** Сталий відступ між сусідніми контурами по радіусу */
  step?: number
  count?: number
}

/** Полярний радіус овалу з легкою «живою» гармонікою — плавна вершина пагорба, не коло */
const base = (t: number, a: number, b: number) =>
  ((a * b) / Math.hypot(b * Math.cos(t), a * Math.sin(t))) * (1 + 0.03 * Math.cos(3 * t + 0.8))

/** Замкнений плавний контур через точки (Catmull-Rom → кубічні Безьє) */
function closedPath(points: [number, number][]): string {
  const n = points.length
  const p = (i: number) => points[(i + n) % n]!
  const f = (x: number) => x.toFixed(1)
  let d = `M${f(p(0)[0])} ${f(p(0)[1])}`
  for (let i = 0; i < n; i++) {
    const [x0, y0] = p(i - 1)
    const [x1, y1] = p(i)
    const [x2, y2] = p(i + 1)
    const [x3, y3] = p(i + 2)
    d += `C${f(x1 + (x2 - x0) / 6)} ${f(y1 + (y2 - y0) / 6)} ${f(x2 - (x3 - x1) / 6)} ${f(y2 - (y3 - y1) / 6)} ${f(x2)} ${f(y2)}`
  }
  return d + 'Z'
}

export interface Contour {
  d: string
  /** Межі контуру — для перевірок композиції */
  minX: number
  maxX: number
  minY: number
}

/**
 * Контур i = базовий овал + i·step по радіусу: проміжки рівні, контури не перетинаються.
 * За замовчуванням: вершина внизу праворуч, найлівіша точка зовнішнього контуру — всередині
 * viewBox (x ≥ 6), верх — y ≥ 90 із 200 (нижче кнопки «Увійти»).
 */
export function contours({ cx = 202, cy = 196, a = 34, b = 18, step = 16, count = 6 }: ContourOptions = {}): Contour[] {
  const N = 64
  return Array.from({ length: count }, (_, i) => {
    const pts = Array.from({ length: N }, (_, k): [number, number] => {
      const t = (k / N) * Math.PI * 2
      const r = base(t, a, b) + i * step
      return [cx + r * Math.cos(t), cy + r * Math.sin(t)]
    })
    const xs = pts.map((q) => q[0])
    return { d: closedPath(pts), minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...pts.map((q) => q[1])) }
  })
}
