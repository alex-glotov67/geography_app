import { queryOptions } from '@tanstack/react-query'
import { notFound } from '@tanstack/react-router'
import { lessonMediaIds, lessonTaskIds, lessonVideoIds, toSaveFields, type LessonDraftState } from '@/features/builder/draft'
import { getSupabase } from '@/supabase'
import type { Json } from '@/types/database.types'

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

// ── Конструктор уроку (SPEC 10.1–10.2) ──────────────────────────────────────────────────

/** Урок змінено в іншій вкладці чи на іншому пристрої: PostgREST віддає 409 з кодом PT409 (SQL revision_conflict) */
export class RevisionConflict extends Error {
  constructor() {
    super('Урок змінено в іншій вкладці чи на іншому пристрої')
  }
}

const rpcError = (error: { code?: string; message: string } | null) => {
  if (!error) return
  if (error.code === 'PT409') throw new RevisionConflict()
  throw new Error(error.message)
}

export interface BuilderTask {
  id: string
  type: string
  level: string
  grp: string
  points: number
  visibility: 'open' | 'secure'
  content: Record<string, unknown>
  key: Record<string, unknown>
  hint: string | null
  feedback: { correct?: string; incorrect?: string } | null
  archived: boolean
}

export interface BuilderMedia {
  id: string
  url: string
  kind: 'image' | 'pdf'
  alt: string | null
  caption: string | null
  source: string | null
  license: string | null
  width: number | null
  height: number | null
}

export interface BuilderVideo {
  id: string
  youtubeId: string
  title: string
  channel: string | null
  durationSec: number | null
  startSec: number | null
  endSec: number | null
  approved: boolean
}

export interface BuilderLesson {
  id: string
  draft: LessonDraftState
  revision: number
  /** Остання опублікована версія (зберігається й після зняття з публікації) */
  publishedVersion: number | null
  /** Урок зараз опублікований (учні бачать поточну версію) */
  isPublished: boolean
  /** Після публікації є збережені зміни, яких учні ще не бачать */
  changedSincePublish: boolean
  isDemo: boolean
  tasks: Record<string, BuilderTask>
  media: Record<string, BuilderMedia>
  videos: Record<string, BuilderVideo>
}

/** Завдання, медіа й відео, на які посилається чернетка (для перегляду й перевірки) */
export async function loadRefs(ids: { tasks: string[]; media: string[]; videos: string[] }) {
  const db = await getSupabase()
  const [tasks, keys, media, videos] = await Promise.all([
    ids.tasks.length
      ? db.from('tasks').select('id, type, level, grp, points, visibility, content, hint, feedback, archived').in('id', ids.tasks)
      : Promise.resolve({ data: [], error: null }),
    ids.tasks.length ? db.from('task_keys').select('task_id, key').in('task_id', ids.tasks) : Promise.resolve({ data: [], error: null }),
    ids.media.length
      ? db.from('media').select('id, bucket_path, kind, alt, caption, source, license, width, height').in('id', ids.media)
      : Promise.resolve({ data: [], error: null }),
    ids.videos.length
      ? db.from('videos').select('id, youtube_id, title, channel, duration_sec, start_sec, end_sec, approved').in('id', ids.videos)
      : Promise.resolve({ data: [], error: null }),
  ])
  for (const r of [tasks, keys, media, videos]) fail(r.error)
  const keyBy = new Map((keys.data ?? []).map((k) => [k.task_id, k.key as Record<string, unknown>]))
  const storage = db.storage.from('lesson-media')
  return {
    tasks: Object.fromEntries(
      (tasks.data ?? []).map((t) => [
        t.id,
        {
          id: t.id, type: t.type, level: t.level, grp: t.grp, points: Number(t.points), visibility: t.visibility as BuilderTask['visibility'],
          content: t.content as Record<string, unknown>, key: keyBy.get(t.id) ?? {}, hint: t.hint,
          feedback: t.feedback as BuilderTask['feedback'], archived: t.archived,
        } satisfies BuilderTask,
      ]),
    ),
    media: Object.fromEntries(
      (media.data ?? []).map((m) => [
        m.id,
        {
          id: m.id, url: storage.getPublicUrl(m.bucket_path).data.publicUrl, kind: m.kind as BuilderMedia['kind'], alt: m.alt,
          caption: m.caption, source: m.source, license: m.license, width: m.width, height: m.height,
        } satisfies BuilderMedia,
      ]),
    ),
    videos: Object.fromEntries(
      (videos.data ?? []).map((v) => [
        v.id,
        {
          id: v.id, youtubeId: v.youtube_id, title: v.title, channel: v.channel, durationSec: v.duration_sec,
          startSec: v.start_sec, endSec: v.end_sec, approved: v.approved,
        } satisfies BuilderVideo,
      ]),
    ),
  }
}

/** Робоча копія уроку для конструктора. Без перезапиту від фокуса: чернетку тримає store. */
export const builderLessonQuery = (lessonId: string) =>
  queryOptions({
    queryKey: ['t', 'builder', lessonId],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async (): Promise<BuilderLesson> => {
      const db = await getSupabase()
      const { data: l, error } = await db
        .from('lessons')
        .select(
          'id, slug, grade, section_id, number, title, textbook_ref, ktp_ref, blocks, homework, simplified, revision, published_version, updated_at, is_demo, lesson_outcomes(outcome_id), lesson_versions(published_at, is_current)',
        )
        .eq('id', lessonId)
        .maybeSingle()
      fail(error)
      if (!l) throw notFound()
      const draft: LessonDraftState = {
        slug: l.slug, grade: l.grade, sectionId: l.section_id, number: l.number, title: l.title,
        textbookRef: (l.textbook_ref as LessonDraftState['textbookRef']) ?? null, ktpRef: l.ktp_ref,
        blocks: (l.blocks ?? []) as LessonDraftState['blocks'], homework: (l.homework as LessonDraftState['homework']) ?? null,
        simplified: (l.simplified as LessonDraftState['simplified']) ?? null,
        outcomeIds: l.lesson_outcomes.map((o) => o.outcome_id),
      }
      const current = l.lesson_versions.find((v) => v.is_current)
      const refs = await loadRefs({ tasks: lessonTaskIds(draft), media: lessonMediaIds(draft), videos: lessonVideoIds(draft) })
      return {
        id: l.id, draft, revision: l.revision, publishedVersion: l.published_version, isPublished: !!current,
        changedSincePublish: !!current && new Date(l.updated_at) > new Date(current.published_at), isDemo: l.is_demo, ...refs,
      }
    },
  })

/** Збереження чернетки; revision null — «Перезаписати моїми змінями». Повертає нову ревізію. */
export async function saveLesson(lessonId: string, revision: number | null, draft: LessonDraftState): Promise<number> {
  const db = await getSupabase()
  const { data, error } = await db.rpc('save_lesson', {
    p_id: lessonId,
    p_revision: revision as number,
    p_fields: toSaveFields(draft) as Json,
    p_outcome_ids: draft.outcomeIds,
  })
  rpcError(error)
  return data!
}

/** Позначка «перевірено вчителем» і публікація саме переглянутої ревізії (SPEC 10.2) */
export async function publishLesson(lessonId: string, revision: number): Promise<number> {
  const db = await getSupabase()
  const { data, error } = await db.rpc('publish_lesson_reviewed', { p_lesson_id: lessonId, p_revision: revision })
  rpcError(error)
  return data!
}

export async function unpublishLesson(lessonId: string): Promise<void> {
  const db = await getSupabase()
  const { error } = await db.rpc('unpublish_lesson', { p_lesson_id: lessonId })
  rpcError(error)
}
