import { OutcomeFields } from '@shared/schemas/outcomes.ts'
import { normText } from './outcomes'

/*
 * Перевірка ручних правок довідника (SPEC 16, Фаза 3) — ті самі правила, що й для імпорту
 * (OutcomeFields, normText для дублів). null — усе гаразд, інакше — повідомлення для вчителя.
 */

const LABEL: Record<string, string> = {
  grade: 'Клас', sectionNumber: '№ розділу', sectionTitle: 'Назва розділу', topicNumber: '№ теми', topicTitle: 'Назва теми',
  text: 'Результат', source: 'Джерело',
}

function firstIssue(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }): string | null {
  if (result.success) return null
  const issue = result.error!.issues[0]!
  const field = String(issue.path[0] ?? '')
  return `«${LABEL[field] ?? field}»: ${issue.message}`
}

const Section = OutcomeFields.pick({ grade: true, sectionNumber: true, sectionTitle: true })
const Topic = OutcomeFields.pick({ topicNumber: true, topicTitle: true })
const Outcome = OutcomeFields.pick({ text: true, source: true })

export function sectionError(v: { grade: number; number: number; title: string }, existing: { id?: string; grade: number; number: number }[], selfId?: string) {
  const e = firstIssue(Section.safeParse({ grade: v.grade, sectionNumber: v.number, sectionTitle: v.title }))
  if (e) return e
  if (existing.some((s) => s.id !== selfId && s.grade === v.grade && s.number === v.number)) return `Розділ ${v.number} для ${v.grade} класу вже є`
  return null
}

export function topicError(v: { number: number; title: string }, siblings: { id: string; number: number }[], selfId?: string) {
  const e = firstIssue(Topic.safeParse({ topicNumber: v.number, topicTitle: v.title }))
  if (e) return e
  if (siblings.some((t) => t.id !== selfId && t.number === v.number)) return `Тема ${v.number} у цьому розділі вже є`
  return null
}

export function outcomeError(v: { text: string; source: string }, siblings: { id: string; code: string; text: string }[], selfId?: string) {
  const e = firstIssue(Outcome.safeParse(v))
  if (e) return e
  const same = siblings.find((o) => o.id !== selfId && normText(o.text) === normText(v.text))
  return same ? `Такий результат у темі вже є (${same.code})` : null
}
