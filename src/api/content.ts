import { queryOptions } from '@tanstack/react-query'
import { notFound } from '@tanstack/react-router'
import type { LessonSnapshot } from '@shared/schemas/lesson.ts'
import type { MediaInfo, VideoInfo } from '@/blocks/lessonContext'
import type { Level } from '@/lib/levels'
import { getSupabase } from '@/supabase'
import type { PracticeTask } from '@/tasks/TaskCard'

/*
 * Публічний зміст (SPEC 6.2): гість і учень читають лише знімки публікації — lesson_versions,
 * lesson_version_tasks → task_versions (open), media і videos поточного знімка. RLS дає лише це.
 */

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

export interface LessonListItem {
  lessonId: string
  slug: string
  number: number | null
  title: string
  isDemo: boolean
  section: { id: string; number: number; title: string } | null
}

/**
 * Політика оновлення (зауваження до Фази 2): скелетон — лише коли даних ще немає; фонові
 * оновлення не підміняють вміст. Список уроків класу змінюється рідко (вчитель публікує) —
 * оновлюється не частіше ніж раз на 5 хв і лише при переході, не від фокуса чи мережі.
 */
const LIST_POLICY = { staleTime: 5 * 60_000, refetchOnWindowFocus: false, refetchOnReconnect: false } as const

/** Опублікований знімок незмінний (нова публікація — нова версія): ніколи не перезапитуємо. */
const SNAPSHOT_POLICY = {
  staleTime: Infinity,
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false,
} as const

/** Опубліковані уроки класу, за розділами й номерами */
export const gradeLessonsQuery = (grade: number) =>
  queryOptions({
    ...LIST_POLICY,
    queryKey: ['grade-lessons', grade],
    queryFn: async (): Promise<LessonListItem[]> => {
      const db = await getSupabase()
      const { data, error } = await db
        .from('lesson_versions')
        .select('lesson_id, slug, number, title, is_demo, sections(id, number, title)')
        .eq('grade', grade)
        .eq('is_current', true)
        .order('number', { ascending: true, nullsFirst: false })
      fail(error)
      return (data ?? [])
        .map((r) => ({
          lessonId: r.lesson_id,
          slug: r.slug,
          number: r.number,
          title: r.title,
          isDemo: r.is_demo,
          section: r.sections ? { id: r.sections.id, number: r.sections.number, title: r.sections.title } : null,
        }))
        .sort((a, b) => (a.section?.number ?? 999) - (b.section?.number ?? 999) || (a.number ?? 999) - (b.number ?? 999))
    },
  })

export interface LessonData {
  lessonId: string
  /** Версія знімка — частина ключа збережених відповідей учня */
  version: number
  snapshot: LessonSnapshot
  isDemo: boolean
  homeworkCount: number
  practiceTasks: Record<string, PracticeTask>
  media: Record<string, MediaInfo>
  videos: Record<string, VideoInfo>
}

/** Опублікований урок за адресою /lesson/<slug> з усім, що потрібно блокам */
export const lessonQuery = (slug: string) =>
  queryOptions({
    ...SNAPSHOT_POLICY,
    queryKey: ['lesson', slug],
    queryFn: async (): Promise<LessonData> => {
      const db = await getSupabase()
      const { data: lv, error } = await db
        .from('lesson_versions')
        // Завдання тренування — вкладено в той самий запит (на один мережевий обмін менше)
        .select(
          'lesson_id, version, snapshot, media_ids, video_ids, homework_count, is_demo, lesson_version_tasks(position, role, task_versions(task_id, type, level, points, content, key, hint, feedback))',
        )
        .eq('slug', slug)
        .eq('is_current', true)
        .eq('lesson_version_tasks.role', 'practice')
        .maybeSingle()
      fail(error)
      if (!lv) throw notFound()
      // zod-схема — окремим чанком: головна сторінка її не вантажить
      const { LessonSnapshot: Schema } = await import('@shared/schemas/lesson.ts')
      const snapshot = Schema.parse(lv.snapshot)

      const [mediaRes, videosRes] = await Promise.all([
        lv.media_ids.length
          ? db.from('media').select('id, bucket_path, kind, alt, caption, source, license, width, height').in('id', lv.media_ids)
          : Promise.resolve({ data: [], error: null }),
        lv.video_ids.length
          ? db.from('videos').select('id, youtube_id, title, channel, duration_sec, start_sec, end_sec').in('id', lv.video_ids)
          : Promise.resolve({ data: [], error: null }),
      ])
      fail(mediaRes.error)
      fail(videosRes.error)

      const practiceTasks: Record<string, PracticeTask> = {}
      for (const row of [...lv.lesson_version_tasks].sort((a, b) => a.position - b.position)) {
        const t = row.task_versions
        if (!t) continue
        practiceTasks[t.task_id] = {
          id: t.task_id, type: t.type, level: t.level as Level, points: Number(t.points), content: t.content, key: t.key,
          hint: t.hint, feedback: t.feedback as PracticeTask['feedback'],
        }
      }
      const storage = db.storage.from('lesson-media')
      const media: Record<string, MediaInfo> = {}
      for (const m of mediaRes.data ?? []) {
        media[m.id] = {
          id: m.id, url: storage.getPublicUrl(m.bucket_path).data.publicUrl, kind: m.kind as MediaInfo['kind'], alt: m.alt,
          caption: m.caption, source: m.source, license: m.license, width: m.width, height: m.height,
        }
      }
      const videos: Record<string, VideoInfo> = {}
      for (const v of videosRes.data ?? []) {
        videos[v.id] = { id: v.id, youtubeId: v.youtube_id, title: v.title, channel: v.channel, durationSec: v.duration_sec, startSec: v.start_sec, endSec: v.end_sec }
      }
      return { lessonId: lv.lesson_id, version: lv.version, snapshot, isDemo: lv.is_demo, homeworkCount: lv.homework_count, practiceTasks, media, videos }
    },
  })
