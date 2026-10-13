/**
 * Генерує src/theme/font-metrics.css — fallback-шрифти з size-adjust / ascent / descent / line-gap
 * override (SPEC 13.7), щоб поки вантажаться Golos Text і Unbounded, системний шрифт займав
 * стільки ж місця і заміна не зсувала макет.
 *
 * Запуск: npm run fonts:metrics  (після оновлення @fontsource/*), результат закомітити.
 *
 * Метрики наших шрифтів читаються з woff2 у node_modules (@capsizecss/unpack). Ширина — середня
 * ширина латинських символів (xWidthAvg підмножини latin): unpack рахує її за латиницею, кирилиця
 * в цих шрифтах має близькі пропорції; підсумковий CLS перевіряє Lighthouse (npm run perf).
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fromFile } from '@capsizecss/unpack/fs'

const ROOT = join(import.meta.dirname, '..')
const OUT = join(ROOT, 'src/theme/font-metrics.css')

interface Metrics {
  unitsPerEm: number
  ascent: number
  descent: number
  lineGap: number
  xWidthAvg: number
}

/**
 * Системні fallback-шрифти. Значення виміряні @capsizecss/unpack 13.10.2026:
 * Arial — /System/Library/Fonts/Supplemental/Arial.ttf і Arial Bold.ttf (є на iOS, macOS, Windows);
 * Roboto — @fontsource/roboto 5, latin 400 і 700 (системний шрифт Android).
 */
const FALLBACKS: { name: string; local: Record<400 | 700, string[]>; metrics: Record<400 | 700, Metrics> }[] = [
  {
    name: 'Arial',
    local: { 400: ['Arial', 'ArialMT'], 700: ['Arial Bold', 'Arial-BoldMT'] },
    metrics: {
      400: { unitsPerEm: 2048, ascent: 1854, descent: -434, lineGap: 67, xWidthAvg: 913 },
      700: { unitsPerEm: 2048, ascent: 1854, descent: -434, lineGap: 67, xWidthAvg: 983 },
    },
  },
  {
    name: 'Roboto',
    local: { 400: ['Roboto', 'Roboto-Regular'], 700: ['Roboto Bold', 'Roboto-Bold'] },
    metrics: {
      400: { unitsPerEm: 2048, ascent: 1900, descent: -500, lineGap: 0, xWidthAvg: 911 },
      700: { unitsPerEm: 2048, ascent: 1900, descent: -500, lineGap: 0, xWidthAvg: 926 },
    },
  },
]

/** Кожна вага — свій файл веб-шрифту і відповідне накреслення fallback (500 — звичайне, 600/700 — жирне) */
const FONTS = [
  ...[400, 500, 600, 700].map((weight) => ({
    family: 'Golos Text',
    weight,
    file: `@fontsource/golos-text/files/golos-text-latin-${weight}-normal.woff2`,
  })),
  { family: 'Unbounded', weight: 700, file: '@fontsource/unbounded/files/unbounded-latin-700-normal.woff2' },
]

const pct = (n: number) => `${(n * 100).toFixed(2)}%`

const blocks: string[] = []
for (const font of FONTS) {
  const m = await fromFile(join(ROOT, 'node_modules', font.file))
  for (const fb of FALLBACKS) {
    const bold = font.weight >= 600 ? 700 : 400
    const f = fb.metrics[bold]
    const sizeAdjust = m.xWidthAvg / m.unitsPerEm / (f.xWidthAvg / f.unitsPerEm)
    blocks.push(`@font-face {
  font-family: '${font.family} Fallback ${fb.name}';
  src: ${fb.local[bold].map((n) => `local('${n}')`).join(', ')};
  font-weight: ${font.weight};
  font-style: normal;
  size-adjust: ${pct(sizeAdjust)};
  ascent-override: ${pct(m.ascent / m.unitsPerEm / sizeAdjust)};
  descent-override: ${pct(Math.abs(m.descent) / m.unitsPerEm / sizeAdjust)};
  line-gap-override: ${pct(m.lineGap / m.unitsPerEm / sizeAdjust)};
}`)
  }
}

writeFileSync(
  OUT,
  `/*
 * Згенеровано scripts/font-metrics.ts (npm run fonts:metrics) — не редагувати вручну.
 * Fallback-шрифти з метриками Golos Text і Unbounded (SPEC 13.7): системний шрифт займає стільки ж
 * місця, поки вантажиться веб-шрифт. Порядок у --font-* (tokens.css): Arial, далі Roboto (Android).
 */
${blocks.join('\n\n')}
`,
)
console.log(`✓ ${OUT.replace(ROOT + '/', '')}: ${blocks.length} @font-face`)
