import type { MantineColorsTuple } from '@mantine/core'

type Rgb = [number, number, number]

const toRgb = (hex: string): Rgb => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m?.[1]) throw new Error(`Очікується колір #rrggbb, отримано: ${hex}`)
  const n = Number.parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toHex = (rgb: Rgb) =>
  '#' + rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')

const mix = (from: Rgb, to: Rgb, amount: number): Rgb => [
  from[0] + (to[0] - from[0]) * amount,
  from[1] + (to[1] - from[1]) * amount,
  from[2] + (to[2] - from[2]) * amount,
]

/** Частка білого для відтінків 0–5 і чорного для 7–9; відтінок 6 — базовий колір. */
const TINTS = [0.92, 0.8, 0.64, 0.48, 0.32, 0.16] as const
const SHADES = [0.16, 0.3, 0.44] as const

/**
 * Палітра Mantine з 10 відтінків навколо базового кольору токена (SPEC 13.6).
 * Базовий колір стоїть на індексі 6 — це `primaryShade` теми, тож `color="water"` дає саме `--water`.
 * `pinned` фіксує окремі відтінки точними значеннями з макетів (напр. `--water-dark` на 7).
 */
export function palette(base: string, pinned: Partial<Record<number, string>> = {}): MantineColorsTuple {
  const rgb = toRgb(base)
  const shades = [
    ...TINTS.map((t) => toHex(mix(rgb, [255, 255, 255], t))),
    toHex(rgb),
    ...SHADES.map((t) => toHex(mix(rgb, [0, 0, 0], t))),
  ]
  for (const [i, hex] of Object.entries(pinned)) {
    if (hex) shades[Number(i)] = toHex(toRgb(hex))
  }
  return shades as unknown as MantineColorsTuple
}
