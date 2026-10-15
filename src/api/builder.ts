import { queryOptions } from '@tanstack/react-query'
import { getSupabase } from '@/supabase'

/*
 * Конструктор змісту (SPEC 10): дерево уроків і довідник програми вчителя. Лише власні рядки
 * (owner_id = вчитель) — RLS дає вчителю читати й чуже опубліковане, тож фільтр явний.
 * Ключі запитів починаються з 't' — після виходу їх прибирає api/auth.ts.
 */

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

const POLICY = { staleTime: 60_000, refetchOnWindowFocus: false } as const

export interface DirOutcome {
  id: string
  code: string
  text: string
  source: string
  archived: boolean
}
export interface DirTopic {
  id: string
  number: number
  title: string
  outcomes: DirOutcome[]
}
export interface DirSection {
  id: string
  grade: number
  number: number
  title: string
  topics: DirTopic[]
}

/** Довідник вчителя: розділ → тема → результат, за номерами й кодами */
export const directoryQuery = (ownerId: string) =>
  queryOptions({
    ...POLICY,
    queryKey: ['t', 'directory', ownerId],
    queryFn: async (): Promise<DirSection[]> => {
      const db = await getSupabase()
      const { data, error } = await db
        .from('sections')
        .select('id, grade, number, title, topics(id, number, title, program_outcomes(id, code, text, source, archived))')
        .eq('owner_id', ownerId)
        .order('grade')
        .order('number')
      fail(error)
      return (data ?? []).map((s) => ({
        id: s.id,
        grade: s.grade,
        number: s.number,
        title: s.title,
        topics: [...s.topics]
          .sort((a, b) => a.number - b.number)
          .map((t) => ({
            id: t.id,
            number: t.number,
            title: t.title,
            outcomes: [...t.program_outcomes].sort((a, b) => a.code.localeCompare(b.code, 'uk', { numeric: true })),
          })),
      }))
    },
  })

export type LessonStatus = 'draft' | 'published' | 'changed'

export interface LessonRow {
  id: string
  slug: string
  grade: number
  sectionId: string | null
  number: number | null
  title: string
  status: LessonStatus
  publishedVersion: number | null
  updatedAt: string
  isDemo: boolean
}

/** Уроки вчителя зі статусом: чернетка / опубліковано / опубліковано, але є неопубліковані зміни */
export const lessonsQuery = (ownerId: string) =>
  queryOptions({
    ...POLICY,
    queryKey: ['t', 'lessons', ownerId],
    queryFn: async (): Promise<LessonRow[]> => {
      const db = await getSupabase()
      const { data, error } = await db
        .from('lessons')
        .select('id, slug, grade, section_id, number, title, status, published_version, updated_at, is_demo, lesson_versions(published_at, is_current)')
        .eq('owner_id', ownerId)
        .order('grade')
        .order('number', { nullsFirst: false })
      fail(error)
      return (data ?? []).map((l) => {
        const current = l.lesson_versions.find((v) => v.is_current)
        const status: LessonStatus = !current ? 'draft' : new Date(l.updated_at) > new Date(current.published_at) ? 'changed' : 'published'
        return {
          id: l.id,
          slug: l.slug,
          grade: l.grade,
          sectionId: l.section_id,
          number: l.number,
          title: l.title,
          status,
          publishedVersion: current ? l.published_version : null,
          updatedAt: l.updated_at,
          isDemo: l.is_demo,
        }
      })
    },
  })

/** Адреса уроку за класом і номером, як у SPEC 8.1: g8-u05 */
export const lessonSlug = (grade: number, number: number) => `g${grade}-u${String(number).padStart(2, '0')}`

/** Вільна адреса: g8-u05, g8-u05-2, g8-u05-3… */
export function freeSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  if (!used.has(base)) return base
  for (let i = 2; ; i++) if (!used.has(`${base}-${i}`)) return `${base}-${i}`
}

export async function createLesson(input: { grade: number; sectionId: string | null; number: number; title: string; slug: string }) {
  const db = await getSupabase()
  const { data, error } = await db
    .from('lessons')
    .insert({ grade: input.grade, section_id: input.sectionId, number: input.number, title: input.title, slug: input.slug })
    .select('id')
    .single()
  if (error?.code === '23505') throw new Error(`Урок з адресою /lesson/${input.slug} уже є`)
  fail(error)
  return data!.id
}

export async function archiveOutcomes(ids: string[]) {
  if (!ids.length) return
  const db = await getSupabase()
  const { error } = await db.from('program_outcomes').update({ archived: true }).in('id', ids)
  fail(error)
}

const csvCell = (v: string | number) => {
  const s = String(v)
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Експорт довідника у формат 10.6 — завжди з кодами (UTF-8 з BOM, «;» — для Excel) */
export function directoryCsv(sections: DirSection[]): string {
  const lines = [['Код', 'Клас', '№ розділу', 'Назва розділу', '№ теми', 'Назва теми', 'Результат', 'Джерело'].join(';')]
  for (const s of sections)
    for (const t of s.topics)
      for (const o of t.outcomes)
        if (!o.archived) lines.push([o.code, s.grade, s.number, s.title, t.number, t.title, o.text, o.source].map(csvCell).join(';'))
  return '﻿' + lines.join('\r\n') + '\r\n'
}
