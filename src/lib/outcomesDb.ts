import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { planOutcomes, type OutcomePlan, type OutcomeRow } from './outcomes'

type Db = SupabaseClient<Database>

const fail = (what: string, error: { message: string } | null) => {
  if (error) throw new Error(`${what}: ${error.message}`)
}

async function load(db: Db, ownerId: string) {
  const { data: sections, error: sErr } = await db.from('sections').select('id, grade, number, title').eq('owner_id', ownerId)
  fail('Розділи', sErr)
  const { data: topics, error: tErr } = await db
    .from('topics')
    .select('id, number, title, sections!inner(grade, number)')
    .eq('owner_id', ownerId)
  fail('Теми', tErr)
  const { data: outcomes, error: oErr } = await db
    .from('program_outcomes')
    .select('id, code, grade, text, source, archived, topics!inner(number, sections!inner(number))')
    .eq('owner_id', ownerId)
  fail('Результати', oErr)
  return {
    sections: sections ?? [],
    topics: (topics ?? []).map((t) => ({ id: t.id, grade: t.sections.grade, sectionNumber: t.sections.number, number: t.number, title: t.title })),
    outcomes: (outcomes ?? []).map((o) => ({
      id: o.id, code: o.code, grade: o.grade, sectionNumber: o.topics.sections.number, topicNumber: o.topics.number,
      text: o.text, source: o.source, archived: o.archived,
    })),
  }
}

/** Застосування плану імпорту довідника (SPEC 10.6) для вчителя ownerId: розділи → теми → результати. */
export async function applyOutcomes(
  db: Db,
  rows: OutcomeRow[],
  { ownerId, schoolId, isDemo = false }: { ownerId: string; schoolId: string; isDemo?: boolean },
): Promise<OutcomePlan> {
  const before = await load(db, ownerId)
  const plan = planOutcomes(rows, before.sections, before.topics, before.outcomes)
  const owned = { owner_id: ownerId, school_id: schoolId, is_demo: isDemo }

  if (plan.sections.create.length) {
    const { error } = await db.from('sections').insert(plan.sections.create.map((s) => ({ ...owned, ...s })))
    fail('Нові розділи', error)
  }
  for (const r of plan.sections.rename) fail('Назва розділу', (await db.from('sections').update({ title: r.title }).eq('id', r.id)).error)

  const { data: secs, error: sErr } = await db.from('sections').select('id, grade, number').eq('owner_id', ownerId)
  fail('Розділи', sErr)
  const sectionId = (grade: number, number: number) => secs!.find((s) => s.grade === grade && s.number === number)!.id

  if (plan.topics.create.length) {
    const { error } = await db
      .from('topics')
      .insert(plan.topics.create.map((t) => ({ ...owned, section_id: sectionId(t.grade, t.sectionNumber), number: t.number, title: t.title })))
    fail('Нові теми', error)
  }
  for (const r of plan.topics.rename) fail('Назва теми', (await db.from('topics').update({ title: r.title }).eq('id', r.id)).error)

  const after = await load(db, ownerId)
  const topicId = (r: OutcomeRow) =>
    after.topics.find((t) => t.grade === r.grade && t.sectionNumber === r.sectionNumber && t.number === r.topicNumber)!.id

  if (plan.outcomes.create.length) {
    const { error } = await db.from('program_outcomes').insert(
      plan.outcomes.create.map((o) => ({ ...owned, code: o.code, grade: o.grade, topic_id: topicId(o), text: o.text, source: o.source })),
    )
    fail('Нові результати', error)
  }
  for (const u of plan.outcomes.update) {
    fail(`Результат ${u.code}`, (await db.from('program_outcomes').update({ text: u.text, source: u.source, archived: false }).eq('id', u.id)).error)
  }
  return plan
}
