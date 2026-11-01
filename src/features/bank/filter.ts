import type { BankTask } from '@/api/tasks'

/** Фільтри банку завдань (SPEC 10.3): клас — тег завдання або клас уроку, де воно використовується */
const norm = (s: string) => s.toLocaleLowerCase('uk')

export interface Filters {
  q: string
  grade: string
  type: string
  level: string
  grp: string
  visibility: string
  archived: boolean
}

export const EMPTY_FILTERS: Filters = { q: '', grade: '', type: '', level: '', grp: '', visibility: '', archived: false }

export function filterBank(tasks: BankTask[], f: Filters): BankTask[] {
  const q = norm(f.q.trim())
  return tasks.filter(
    (x) =>
      x.archived === f.archived &&
      (!q || norm(x.prompt).includes(q)) &&
      (!f.grade || x.grade === Number(f.grade) || x.usage.some((u) => u.grade === Number(f.grade))) &&
      (!f.type || x.type === f.type) &&
      (!f.level || x.level === f.level) &&
      (!f.grp || x.grp === f.grp) &&
      (!f.visibility || x.visibility === f.visibility),
  )
}

