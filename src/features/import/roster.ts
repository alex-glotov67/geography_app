import { nameKey, normalizeLastName, UA_LETTERS } from '@shared/accounts/index.ts'

/**
 * Імпорт списку класу (SPEC 5.2) — чиста логіка: стовпці, розбір ПІБ, план «у файлі → буде
 * збережено → статус». Зберігаємо лише прізвище й ініціал імені; по батькові відкидається.
 * Читання файлів — adapters/readGrid.ts.
 */

export type NameColumns = { mode: 'full'; col: number } | { mode: 'split'; last: number; first: number }

export interface Mapping {
  /** Перший рядок — заголовок (не учень) */
  headerRow: boolean
  name: NameColumns
  /** Стовпець «Клас» — якщо у файлі кілька класів; null — усі в поточний клас */
  classCol: number | null
}

export interface RosterRow {
  /** Номер рядка у файлі (з 1) */
  line: number
  /** Як записано у файлі — для стовпця «У файлі» */
  source: string
  lastName: string
  firstInitial: string
  /** «8-Б» або null, якщо стовпця класу немає */
  className: string | null
  error?: string
}

const norm = (s: string) => s.trim().toLocaleLowerCase('uk').replace(/[’ʼ`]/g, "'").replace(/\s+/g, ' ')

const FULL_HEADERS = ['піб', 'п.і.б.', 'п. і. б.', 'прізвище та ім\'я', 'прізвище, ім\'я', 'прізвище ім\'я', 'прізвище, ім\'я, по батькові', 'учень', 'учні', 'прізвище та ім\'я учня', 'ім\'я учня']
const LAST_HEADERS = ['прізвище']
const FIRST_HEADERS = ['ім\'я']
const CLASS_HEADERS = ['клас']

/** Стовпці за заголовком; якщо заголовка немає — перший стовпець вважаємо ПІБ */
export function detectMapping(grid: string[][]): Mapping {
  const header = (grid[0] ?? []).map(norm)
  const find = (names: string[]) => header.findIndex((h) => names.includes(h))
  const full = find(FULL_HEADERS)
  const last = find(LAST_HEADERS)
  const first = find(FIRST_HEADERS)
  const cls = find(CLASS_HEADERS)
  const headerRow = full >= 0 || last >= 0 || cls >= 0
  const name: NameColumns =
    full < 0 && last >= 0 && first >= 0 ? { mode: 'split', last, first } : { mode: 'full', col: Math.max(full, last, 0) }
  return { headerRow, name, classCol: cls >= 0 ? cls : null }
}

/** Латинські двійники кириличних літер (часто трапляються в журналах): B — це «В», не «Б» */
const LATIN_LOOKALIKES: Record<string, string> = { A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', I: 'І', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х' }

/** «8б», «8 Б», «8-б клас», «8(Б)» → «8-Б»; не клас 6–9 — null */
export function normalizeClassName(raw: string): string | null {
  const m = /^\s*([6-9])\s*[-–—(]?\s*([A-Za-zА-Яа-яҐґЄєІіЇї])\)?(\s*клас)?\s*$/i.exec(raw)
  if (!m) return null
  const up = m[2]!.toLocaleUpperCase('uk')
  const letter = LATIN_LOOKALIKES[up] ?? up
  return UA_LETTERS.includes(letter) ? `${m[1]}-${letter}` : null
}

const INITIAL = new RegExp(`^[${UA_LETTERS}A-Z]$`)

/** Перша літера імені великою; «О.П.» → «О» */
function initialOf(first: string): string | null {
  const ch = first.trim().replace(/^["'«]/, '').charAt(0).toLocaleUpperCase('uk')
  return INITIAL.test(ch) ? ch : null
}

/** «Коваль Олена Петрівна», «КОВАЛЬ О.П.», «Коваль О. П.» → прізвище й ініціал; по батькові відкидаємо */
export function parseFullName(raw: string): { lastName: string; firstInitial: string } | null {
  const parts = raw.trim().replace(/\s+/g, ' ').replace(/\.(?=\S)/g, '. ').split(' ')
  if (parts.length < 2) return null
  const initial = initialOf(parts[1]!)
  if (!initial) return null
  return { lastName: normalizeLastName(parts[0]!), firstInitial: initial }
}

export function parseRoster(grid: string[][], mapping: Mapping): RosterRow[] {
  const rows: RosterRow[] = []
  grid.forEach((cells, i) => {
    if (mapping.headerRow && i === 0) return
    const cell = (c: number) => (cells[c] ?? '').trim()
    if (cells.every((c) => c.trim() === '')) return // порожні рядки пропускаємо
    const line = i + 1
    const rawClass = mapping.classCol === null ? null : cell(mapping.classCol)
    const className = rawClass === null ? null : normalizeClassName(rawClass)
    let source: string
    let parsed: { lastName: string; firstInitial: string } | null
    if (mapping.name.mode === 'full') {
      source = cell(mapping.name.col)
      parsed = parseFullName(source)
    } else {
      const last = cell(mapping.name.last)
      const first = cell(mapping.name.first)
      source = `${last} ${first}`.trim()
      const initial = initialOf(first)
      parsed = last && initial ? { lastName: normalizeLastName(last), firstInitial: initial } : null
    }
    const base = { line, source, className, lastName: parsed?.lastName ?? '', firstInitial: parsed?.firstInitial ?? '' }
    if (!source) rows.push({ ...base, error: 'Немає прізвища' })
    else if (!parsed) rows.push({ ...base, error: 'Потрібні прізвище та ім\'я' })
    else if (rawClass !== null && !className) rows.push({ ...base, error: `Клас «${rawClass}» — очікується 6–9 і літера, напр. 8-Б` })
    else rows.push(base)
  })
  return rows
}

export type RowStatus =
  | 'new' //               новий учень
  | 'exists' //            уже є в класі — пропустити
  | 'duplicate' //         той самий учень двічі у файлі — пропустити
  | 'error'

export interface PlannedRow extends RosterRow {
  /** Клас, у який піде учень */
  target: string
  status: RowStatus
}

/**
 * План імпорту: учні класу currentClass (або класу з файлу) порівнюються за прізвищем та ініціалом
 * з наявними (existing: назва класу → ключі name_key) і між собою. Неоднозначні рядки
 * (exists, duplicate) вчитель може позначити «Це інший учень» — тоді вони створюються.
 */
export function planRoster(rows: RosterRow[], currentClass: string, existing: Map<string, Set<string>>): PlannedRow[] {
  const seen = new Map<string, Set<string>>()
  return rows.map((r) => {
    const target = r.className ?? currentClass
    if (r.error) return { ...r, target, status: 'error' }
    const key = nameKey(r.lastName, r.firstInitial)
    const inFile = seen.get(target) ?? new Set()
    seen.set(target, inFile)
    const status: RowStatus = existing.get(target)?.has(key) ? 'exists' : inFile.has(key) ? 'duplicate' : 'new'
    inFile.add(key)
    return { ...r, target, status }
  })
}

/** Класи з файлу, яких ще немає у вчителя, — створяться під час імпорту */
export const missingClasses = (plan: PlannedRow[], known: string[]) =>
  [...new Set(plan.filter((r) => r.status !== 'error').map((r) => r.target))].filter((c) => !known.includes(c)).sort()
