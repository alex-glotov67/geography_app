import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { planOutcomes, type Grp, type OutcomePlan, type OutcomeRow } from './outcomes'

/** Застосування плану імпорту довідника (SPEC 10.6) для вчителя ownerId. */
export async function applyOutcomes(
  db: SupabaseClient<Database>,
  rows: OutcomeRow[],
  { ownerId, schoolId, isDemo = false }: { ownerId: string; schoolId: string; isDemo?: boolean },
): Promise<OutcomePlan> {
  const { data: secs, error: sErr } = await db.from('sections').select('id, grade, number, title').eq('owner_id', ownerId)
  if (sErr) throw new Error(sErr.message)
  const { data: outs, error: oErr } = await db
    .from('program_outcomes')
    .select('id, code, grade, grp, text, source, archived, sections(number)')
    .eq('owner_id', ownerId)
  if (oErr) throw new Error(oErr.message)

  const plan = planOutcomes(
    rows,
    secs ?? [],
    (outs ?? []).map((o) => ({
      id: o.id, code: o.code, grade: o.grade, grp: o.grp as Grp, text: o.text, source: o.source, archived: o.archived,
      sectionNumber: (o.sections as { number: number } | null)?.number ?? 0,
    })),
  )

  const owned = { owner_id: ownerId, school_id: schoolId, is_demo: isDemo }
  if (plan.sections.create.length) {
    const { error } = await db.from('sections').insert(plan.sections.create.map((s) => ({ ...owned, ...s })))
    if (error) throw new Error(`Розділи: ${error.message}`)
  }
  for (const r of plan.sections.rename) {
    const { error } = await db.from('sections').update({ title: r.title }).eq('id', r.id)
    if (error) throw new Error(`Розділ: ${error.message}`)
  }
  const { data: allSecs } = await db.from('sections').select('id, grade, number').eq('owner_id', ownerId)
  const sectionId = (grade: number, number: number) => allSecs!.find((s) => s.grade === grade && s.number === number)!.id
  if (plan.outcomes.create.length) {
    const { error } = await db.from('program_outcomes').insert(
      plan.outcomes.create.map((o) => ({
        ...owned, code: o.code, grade: o.grade, section_id: sectionId(o.grade, o.sectionNumber), grp: o.grp, text: o.text, source: o.source,
      })),
    )
    if (error) throw new Error(`Результати: ${error.message}`)
  }
  for (const u of plan.outcomes.update) {
    const { error } = await db.from('program_outcomes').update({ text: u.text, source: u.source, archived: false }).eq('id', u.id)
    if (error) throw new Error(`Результат ${u.code}: ${error.message}`)
  }
  return plan
}
