import { OutcomeRow as RowSchema, type OutcomeRow as Row } from '@shared/schemas/outcomes.ts'
import { readTable } from './csv'

/**
 * Імпорт довідника розділів, тем і очікуваних результатів (SPEC 10.6). Чиста логіка: розбір,
 * перевірка (zod), план змін. Запис у БД — src/lib/outcomesDb.ts (зараз скрипт, у Фазі 3 — конструктор).
 * Формат: Код;Клас;№ розділу;Назва розділу;№ теми;Назва теми;Результат;Джерело — код 8-2-3-07,
 * вступ — розділ 0, тема 0.
 */

export type OutcomeRow = Row & { line: number }

export interface RowError {
  line: number
  message: string
}

/** Стовпець файлу → поле рядка. «Код» — необов'язковий (порожній — згенерується). */
const COLUMNS = {
  'клас': 'grade',
  '№ розділу': 'sectionNumber',
  'назва розділу': 'sectionTitle',
  '№ теми': 'topicNumber',
  'назва теми': 'topicTitle',
  'результат': 'text',
  'джерело': 'source',
} as const
const NAMES: Record<string, string> = {
  code: 'Код', grade: 'Клас', sectionNumber: '№ розділу', sectionTitle: 'Назва розділу',
  topicNumber: '№ теми', topicTitle: 'Назва теми', text: 'Результат', source: 'Джерело',
}

/** Як text_norm у БД: без регістру, крайніх і подвійних пробілів. */
export const normText = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('uk')

const topicKey = (r: { grade: number; sectionNumber: number; topicNumber: number }) => `${r.grade}-${r.sectionNumber}-${r.topicNumber}`

export function parseOutcomes(bytes: Uint8Array): { rows: OutcomeRow[]; errors: RowError[]; encoding: string } {
  const { header, records, encoding } = readTable(bytes)
  const missing = Object.keys(COLUMNS).filter((h) => !header.includes(h))
  if (missing.length) {
    return { rows: [], encoding, errors: [{ line: 1, message: `Немає стовпців: ${missing.map((m) => `«${m}»`).join(', ')}` }] }
  }
  if (header.includes('гр')) {
    return { rows: [], encoding, errors: [{ line: 1, message: 'Стовпець «ГР» більше не потрібен: ГР — тег завдань, а не довідника (SPEC 10.6)' }] }
  }

  const rows: OutcomeRow[] = []
  const errors: RowError[] = []
  for (const r of records) {
    if (r.empty) continue
    const raw: Record<string, unknown> = { code: r.values['код'] || null }
    for (const [col, field] of Object.entries(COLUMNS)) raw[field] = r.values[col] === '' ? undefined : r.values[col]
    const parsed = RowSchema.safeParse(raw)
    if (!parsed.success) {
      const msgs = parsed.error.issues.map((i) => {
        const field = String(i.path[0] ?? '')
        return i.code === 'custom' ? i.message : `«${NAMES[field] ?? field}»: ${raw[field] == null ? 'не заповнено' : i.message}`
      })
      errors.push({ line: r.line, message: [...new Set(msgs)].join('; ') })
      continue
    }
    rows.push({ ...parsed.data, line: r.line })
  }

  // Однакові назви розділу й теми в усіх рядках; без дублів результатів і кодів
  const sectionTitle = new Map<string, OutcomeRow>()
  const topicTitle = new Map<string, OutcomeRow>()
  const seenText = new Map<string, number>()
  const seenCode = new Map<string, number>()
  const ok: OutcomeRow[] = []
  for (const row of rows) {
    const sk = `${row.grade}-${row.sectionNumber}`
    const tk = topicKey(row)
    const s = sectionTitle.get(sk)
    const t = topicTitle.get(tk)
    const textKey = `${tk}-${normText(row.text)}`
    const problem =
      s && normText(s.sectionTitle) !== normText(row.sectionTitle)
        ? `Розділ ${row.sectionNumber} (${row.grade} клас) уже має іншу назву в рядку ${s.line}`
        : t && normText(t.topicTitle) !== normText(row.topicTitle)
          ? `Тема ${row.topicNumber} розділу ${row.sectionNumber} уже має іншу назву в рядку ${t.line}`
          : seenText.has(textKey)
            ? `Той самий результат цієї теми уже є в рядку ${seenText.get(textKey)}`
            : row.code && seenCode.has(row.code)
              ? `Код ${row.code} уже є в рядку ${seenCode.get(row.code)}`
              : null
    if (problem) {
      errors.push({ line: row.line, message: problem })
      continue
    }
    if (!s) sectionTitle.set(sk, row)
    if (!t) topicTitle.set(tk, row)
    seenText.set(textKey, row.line)
    if (row.code) seenCode.set(row.code, row.line)
    ok.push(row)
  }
  errors.sort((a, b) => a.line - b.line)
  return { rows: ok, errors, encoding }
}

export interface ExistingSection {
  id: string
  grade: number
  number: number
  title: string
}

export interface ExistingTopic {
  id: string
  grade: number
  sectionNumber: number
  number: number
  title: string
}

export interface ExistingOutcome {
  id: string
  code: string
  grade: number
  sectionNumber: number
  topicNumber: number
  text: string
  source: string
  archived: boolean
}

export interface OutcomePlan {
  sections: { create: { grade: number; number: number; title: string }[]; rename: { id: string; title: string }[] }
  topics: {
    create: { grade: number; sectionNumber: number; number: number; title: string }[]
    rename: { id: string; title: string }[]
  }
  outcomes: {
    create: (OutcomeRow & { code: string })[]
    update: { id: string; code: string; text: string; source: string; unarchive: boolean }[]
    unchanged: string[]
    /** Є в базі, немає у файлі — показати з пропозицією архівувати, не видаляти (SPEC 10.6) */
    missing: ExistingOutcome[]
  }
}

/** План змін: зіставлення за кодом, без коду — за «тема + текст»; нові коди — наступні вільні в темі. */
export function planOutcomes(
  rows: OutcomeRow[],
  sections: ExistingSection[],
  topics: ExistingTopic[],
  outcomes: ExistingOutcome[],
): OutcomePlan {
  const plan: OutcomePlan = {
    sections: { create: [], rename: [] },
    topics: { create: [], rename: [] },
    outcomes: { create: [], update: [], unchanged: [], missing: [] },
  }
  const sectionBy = new Map(sections.map((s) => [`${s.grade}-${s.number}`, s]))
  const topicBy = new Map(topics.map((t) => [`${t.grade}-${t.sectionNumber}-${t.number}`, t]))
  const seenSection = new Set<string>()
  const seenTopic = new Set<string>()
  for (const row of rows) {
    const sk = `${row.grade}-${row.sectionNumber}`
    if (!seenSection.has(sk)) {
      seenSection.add(sk)
      const s = sectionBy.get(sk)
      if (!s) plan.sections.create.push({ grade: row.grade, number: row.sectionNumber, title: row.sectionTitle })
      else if (s.title !== row.sectionTitle) plan.sections.rename.push({ id: s.id, title: row.sectionTitle })
    }
    const tk = topicKey(row)
    if (!seenTopic.has(tk)) {
      seenTopic.add(tk)
      const t = topicBy.get(tk)
      if (!t) plan.topics.create.push({ grade: row.grade, sectionNumber: row.sectionNumber, number: row.topicNumber, title: row.topicTitle })
      else if (t.title !== row.topicTitle) plan.topics.rename.push({ id: t.id, title: row.topicTitle })
    }
  }

  const byCode = new Map(outcomes.map((o) => [o.code, o]))
  const byText = new Map(outcomes.map((o) => [`${topicKey({ ...o, topicNumber: o.topicNumber })}-${normText(o.text)}`, o]))
  const usedCodes = new Set([...outcomes.map((o) => o.code), ...rows.flatMap((r) => (r.code ? [r.code] : []))])
  const matched = new Set<string>()
  const nextCode = (row: OutcomeRow) => {
    for (let n = 1; ; n++) {
      const code = `${topicKey(row)}-${String(n).padStart(2, '0')}`
      if (!usedCodes.has(code)) {
        usedCodes.add(code)
        return code
      }
    }
  }

  for (const row of rows) {
    const existing = (row.code && byCode.get(row.code)) || byText.get(`${topicKey(row)}-${normText(row.text)}`)
    if (existing) {
      matched.add(existing.id)
      if (existing.text === row.text && existing.source === row.source && !existing.archived) plan.outcomes.unchanged.push(existing.code)
      else plan.outcomes.update.push({ id: existing.id, code: existing.code, text: row.text, source: row.source, unarchive: existing.archived })
    } else {
      plan.outcomes.create.push({ ...row, code: row.code ?? nextCode(row) })
    }
  }
  plan.outcomes.missing = outcomes.filter((o) => !matched.has(o.id) && !o.archived)
  return plan
}
