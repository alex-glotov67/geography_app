import { readTable } from './csv'

/**
 * Імпорт довідника розділів і очікуваних результатів (SPEC 10.6). Чиста логіка: розбір, перевірка,
 * план змін. Запис у БД робить виклик (scripts/import-outcomes.ts зараз, конструктор — у Фазі 3).
 */

export type Grp = 'ГР1' | 'ГР2' | 'ГР3'

export interface OutcomeRow {
  line: number
  code: string | null
  grade: number
  sectionNumber: number
  sectionTitle: string
  grp: Grp
  text: string
  source: string
}

export interface RowError {
  line: number
  message: string
}

const REQUIRED = ['клас', '№ розділу', 'назва розділу', 'гр', 'результат', 'джерело'] as const
const CODE = /^([6-9])-([1-9][0-9]*)-(ГР[1-3])-([0-9]{2,})$/

/** Як text_norm у БД: без регістру, крайніх і подвійних пробілів. */
export const normText = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('uk')

/** «ГР1», «ГР 1», «гр1», «1» → «ГР1» */
export function normGrp(raw: string): Grp | null {
  const m = /^(?:гр\s*)?([1-3])$/i.exec(raw.trim())
  return m ? (`ГР${m[1]}` as Grp) : null
}

export function parseOutcomes(bytes: Uint8Array): { rows: OutcomeRow[]; errors: RowError[]; encoding: string } {
  const { header, records, encoding } = readTable(bytes)
  const missing = REQUIRED.filter((h) => !header.includes(h))
  if (missing.length) {
    return { rows: [], encoding, errors: [{ line: 1, message: `Немає стовпців: ${missing.map((m) => `«${m}»`).join(', ')}` }] }
  }
  const rows: OutcomeRow[] = []
  const errors: RowError[] = []
  const titles = new Map<string, { title: string; line: number }>()
  for (const r of records) {
    if (r.empty) continue
    const v = r.values
    const problems: string[] = []
    const grade = Number(v['клас'])
    if (![6, 7, 8, 9].includes(grade)) problems.push('«Клас» — 6, 7, 8 або 9')
    const sectionNumber = Number(v['№ розділу'])
    if (!Number.isInteger(sectionNumber) || sectionNumber < 1) problems.push('«№ розділу» — ціле число від 1')
    const grp = normGrp(v['гр'] ?? '')
    if (!grp) problems.push('«ГР» — ГР1, ГР2 або ГР3')
    for (const [col, name] of [['назва розділу', 'Назва розділу'], ['результат', 'Результат'], ['джерело', 'Джерело']] as const) {
      if (!v[col]) problems.push(`«${name}» не заповнено`)
    }
    const code = v['код'] || null
    if (code) {
      const m = CODE.exec(code)
      if (!m) problems.push('«Код» має вигляд 8-1-ГР2-03')
      else if (Number(m[1]) !== grade || Number(m[2]) !== sectionNumber || m[3] !== grp)
        problems.push(`«Код» ${code} не відповідає класу, розділу або ГР рядка`)
    }
    if (problems.length) {
      errors.push({ line: r.line, message: problems.join('; ') })
      continue
    }
    const key = `${grade}-${sectionNumber}`
    const seen = titles.get(key)
    if (seen && normText(seen.title) !== normText(v['назва розділу']!)) {
      errors.push({ line: r.line, message: `Розділ ${sectionNumber} (${grade} клас) уже має іншу назву в рядку ${seen.line}` })
      continue
    }
    if (!seen) titles.set(key, { title: v['назва розділу']!, line: r.line })
    rows.push({ line: r.line, code, grade, sectionNumber, sectionTitle: v['назва розділу']!, grp: grp!, text: v['результат']!, source: v['джерело']! })
  }
  // Дублікати в межах файлу
  const seenRows = new Map<string, number>()
  const seenCodes = new Map<string, number>()
  for (const row of rows) {
    const k = `${row.grade}-${row.sectionNumber}-${row.grp}-${normText(row.text)}`
    if (seenRows.has(k)) errors.push({ line: row.line, message: `Той самий результат уже є в рядку ${seenRows.get(k)}` })
    else seenRows.set(k, row.line)
    if (row.code) {
      if (seenCodes.has(row.code)) errors.push({ line: row.line, message: `Код ${row.code} уже є в рядку ${seenCodes.get(row.code)}` })
      else seenCodes.set(row.code, row.line)
    }
  }
  return { rows, errors, encoding }
}

export interface ExistingSection {
  id: string
  grade: number
  number: number
  title: string
}

export interface ExistingOutcome {
  id: string
  code: string
  grade: number
  sectionNumber: number
  grp: Grp
  text: string
  source: string
  archived: boolean
}

export interface OutcomePlan {
  sections: { create: { grade: number; number: number; title: string }[]; rename: { id: string; title: string }[] }
  outcomes: {
    create: (OutcomeRow & { code: string })[]
    update: { id: string; code: string; text: string; source: string; unarchive: boolean }[]
    unchanged: string[]
    /** Є в базі, немає у файлі — показати з пропозицією архівувати, не видаляти (SPEC 10.6) */
    missing: ExistingOutcome[]
  }
}

/** План змін: зіставлення за кодом, без коду — за «розділ + ГР + текст»; нові коди — наступні вільні. */
export function planOutcomes(rows: OutcomeRow[], sections: ExistingSection[], outcomes: ExistingOutcome[]): OutcomePlan {
  const plan: OutcomePlan = {
    sections: { create: [], rename: [] },
    outcomes: { create: [], update: [], unchanged: [], missing: [] },
  }
  const sectionByKey = new Map(sections.map((s) => [`${s.grade}-${s.number}`, s]))
  for (const row of rows) {
    const key = `${row.grade}-${row.sectionNumber}`
    const s = sectionByKey.get(key)
    if (!s) {
      if (!plan.sections.create.some((c) => `${c.grade}-${c.number}` === key))
        plan.sections.create.push({ grade: row.grade, number: row.sectionNumber, title: row.sectionTitle })
    } else if (s.title !== row.sectionTitle && !plan.sections.rename.some((r) => r.id === s.id)) {
      plan.sections.rename.push({ id: s.id, title: row.sectionTitle })
    }
  }

  const byCode = new Map(outcomes.map((o) => [o.code, o]))
  const byText = new Map(outcomes.map((o) => [`${o.grade}-${o.sectionNumber}-${o.grp}-${normText(o.text)}`, o]))
  const usedCodes = new Set(outcomes.map((o) => o.code).concat(rows.flatMap((r) => (r.code ? [r.code] : []))))
  const matched = new Set<string>()

  const nextCode = (row: OutcomeRow) => {
    for (let n = 1; ; n++) {
      const code = `${row.grade}-${row.sectionNumber}-${row.grp}-${String(n).padStart(2, '0')}`
      if (!usedCodes.has(code)) {
        usedCodes.add(code)
        return code
      }
    }
  }

  for (const row of rows) {
    const existing = (row.code && byCode.get(row.code)) || byText.get(`${row.grade}-${row.sectionNumber}-${row.grp}-${normText(row.text)}`)
    if (existing) {
      matched.add(existing.id)
      const same = existing.text === row.text && existing.source === row.source && !existing.archived
      if (same) plan.outcomes.unchanged.push(existing.code)
      else plan.outcomes.update.push({ id: existing.id, code: existing.code, text: row.text, source: row.source, unarchive: existing.archived })
    } else {
      plan.outcomes.create.push({ ...row, code: row.code ?? nextCode(row) })
    }
  }
  plan.outcomes.missing = outcomes.filter((o) => !matched.has(o.id) && !o.archived)
  return plan
}
