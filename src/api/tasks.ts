import { queryOptions } from '@tanstack/react-query'
import { notFound } from '@tanstack/react-router'
import { fromRow, taskPrompt, toSavePayload, type TaskFormValues } from '@/features/bank/taskForm'
import { getSupabase } from '@/supabase'
import type { Json } from '@/types/database.types'
import { RevisionConflict } from './builder'

/*
 * Банк завдань вчителя (SPEC 10.3). Робоча копія — tasks + task_keys (ключ бачить лише власник);
 * збереження — RPC save_task (завдання й ключ однією транзакцією, з ревізією). «Де
 * використовується» — view task_usage. Ключі запитів 't' — після виходу їх прибирає api/auth.ts.
 */

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

export interface TaskUsage {
  lessonId: string
  lessonSlug: string
  lessonTitle: string
  grade: number
  lessonNumber: number | null
  role: 'practice' | 'homework' | 'quiz_pool'
  /** Завдання стоїть у поточній опублікованій версії уроку */
  published: boolean
}

export interface BankTask {
  id: string
  type: string
  level: string
  grp: string
  points: number
  visibility: 'open' | 'secure'
  grade: number | null
  prompt: string
  archived: boolean
  version: number
  updatedAt: string
  usage: TaskUsage[]
}

const usageOf = (rows: { task_id: string | null; lesson_id: string | null; lesson_slug: string | null; lesson_title: string | null; grade: number | null; lesson_number: number | null; role: string | null; published: boolean | null }[]) => {
  const by = new Map<string, TaskUsage[]>()
  for (const r of rows) {
    if (!r.task_id || !r.lesson_id) continue
    const list = by.get(r.task_id) ?? []
    list.push({
      lessonId: r.lesson_id, lessonSlug: r.lesson_slug ?? '', lessonTitle: r.lesson_title ?? '', grade: r.grade ?? 0,
      lessonNumber: r.lesson_number, role: r.role as TaskUsage['role'], published: !!r.published,
    })
    by.set(r.task_id, list)
  }
  return by
}

export const bankQuery = (ownerId: string) =>
  queryOptions({
    queryKey: ['t', 'bank', ownerId],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<BankTask[]> => {
      const db = await getSupabase()
      const [tasks, usage] = await Promise.all([
        db
          .from('tasks')
          .select('id, type, level, grp, points, visibility, tags, content, archived, version, updated_at')
          .eq('owner_id', ownerId)
          .order('updated_at', { ascending: false }),
        db.from('task_usage').select('*'),
      ])
      fail(tasks.error)
      fail(usage.error)
      const used = usageOf(usage.data ?? [])
      return (tasks.data ?? []).map((t) => {
        const tags = t.tags as { grade?: unknown } | null
        return {
          id: t.id, type: t.type, level: t.level, grp: t.grp, points: Number(t.points), visibility: t.visibility as BankTask['visibility'],
          grade: typeof tags?.grade === 'number' ? tags.grade : null, prompt: taskPrompt(t.content),
          archived: t.archived, version: t.version, updatedAt: t.updated_at, usage: used.get(t.id) ?? [],
        }
      })
    },
  })

export interface EditableTask {
  id: string
  values: TaskFormValues
  revision: number
  version: number
  archived: boolean
  /** Поточна версія вже зафіксована в публікації (правка створить нову версію) */
  usage: TaskUsage[]
}

export const taskQuery = (taskId: string) =>
  queryOptions({
    queryKey: ['t', 'task', taskId],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<EditableTask> => {
      const db = await getSupabase()
      const [task, key, usage] = await Promise.all([
        db.from('tasks').select('id, type, level, grp, points, visibility, tags, content, hint, feedback, revision, version, archived').eq('id', taskId).maybeSingle(),
        db.from('task_keys').select('key').eq('task_id', taskId).maybeSingle(),
        db.from('task_usage').select('*').eq('task_id', taskId),
      ])
      fail(task.error)
      fail(key.error)
      fail(usage.error)
      if (!task.data) throw notFound()
      const t = task.data
      return {
        id: t.id,
        revision: t.revision,
        version: t.version,
        archived: t.archived,
        usage: usageOf(usage.data ?? []).get(t.id) ?? [],
        values: fromRow({
          type: t.type, level: t.level, grp: t.grp, points: Number(t.points), visibility: t.visibility, tags: t.tags as Record<string, unknown>,
          hint: t.hint, feedback: t.feedback as { correct?: string; incorrect?: string } | null, content: t.content as Record<string, unknown>,
          key: (key.data?.key ?? {}) as Record<string, unknown>,
        }),
      }
    },
  })

/** Збереження (нове — id null); revision null — «Перезаписати моїми змінями» */
export async function saveTask(id: string | null, revision: number | null, values: TaskFormValues): Promise<{ id: string; revision: number; version: number }> {
  const db = await getSupabase()
  const { task, key } = toSavePayload(values)
  const { data, error } = await db.rpc('save_task', { p_id: id as string, p_revision: revision as number, p_task: task as Json, p_key: key as Json })
  if (error?.code === 'PT409') throw new RevisionConflict()
  fail(error)
  return data![0]!
}

export async function setTaskArchived(id: string, archived: boolean) {
  const db = await getSupabase()
  const { error } = await db.from('tasks').update({ archived }).eq('id', id)
  fail(error)
}

/** Копія завдання (з ключем): «Дублювати» або «Створити захищену копію» (SPEC 10.3) */
export async function copyTask(id: string, visibility?: 'open' | 'secure'): Promise<string> {
  const db = await getSupabase()
  const source = await db.from('tasks').select('type, level, grp, points, visibility, tags, content, hint, feedback').eq('id', id).single()
  fail(source.error)
  const key = await db.from('task_keys').select('key').eq('task_id', id).maybeSingle()
  fail(key.error)
  const t = source.data!
  const values = fromRow({
    type: t.type, level: t.level, grp: t.grp, points: Number(t.points), visibility: visibility ?? t.visibility, tags: t.tags as Record<string, unknown>,
    hint: t.hint, feedback: t.feedback as { correct?: string; incorrect?: string } | null, content: t.content as Record<string, unknown>,
    key: (key.data?.key ?? {}) as Record<string, unknown>,
  })
  return (await saveTask(null, null, values)).id
}
