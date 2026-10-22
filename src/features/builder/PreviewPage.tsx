import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { builderLessonQuery } from '@/api/builder'
import layout from '@/features/lesson/lessonLayout.module.css'
import { LessonView } from '@/features/lesson/LessonView'
import { TeacherPageSkeleton } from '@/features/teacher/TeacherSkeletons'
import type { PracticeTask } from '@/tasks/TaskCard'
import type { Level } from '@/lib/levels'
import type { LessonDraftState } from './draft'
import { backupKey, readBackup } from './store'

/**
 * Перегляд чернетки очима учня (SPEC 10.1) — у iframe конструктора, лише вчителю (маршрут під /t).
 * Та сама сторінка уроку, що й опублікована; чернетку бере з localStorage і оновлюється з кожною
 * правкою (подія storage з вкладки конструктора).
 */
export function PreviewPage({ lessonId, simplified: initialSimplified }: { lessonId: string; simplified: boolean }) {
  const lesson = useQuery(builderLessonQuery(lessonId))
  const [draft, setDraft] = useState<LessonDraftState | null>(() => readBackup(lessonId)?.draft ?? null)
  const [simplified, setSimplified] = useState(initialSimplified)

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === backupKey(lessonId)) setDraft(readBackup(lessonId)?.draft ?? null)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [lessonId])

  if (!lesson.data) return <TeacherPageSkeleton standalone />
  const d = draft ?? lesson.data.draft
  const refs = lesson.data
  const practiceTasks: Record<string, PracticeTask> = Object.fromEntries(
    Object.values(refs.tasks)
      .filter((x) => x.visibility === 'open')
      .map((x) => [x.id, { id: x.id, type: x.type, level: x.level as Level, points: x.points, content: x.content, key: x.key, hint: x.hint, feedback: x.feedback }]),
  )
  const homework = d.homework?.taskIds.length ?? 0
  return (
    <LessonView
      lesson={{
        slug: d.slug, grade: d.grade, number: d.number, title: d.title || 'Без теми', textbookRef: d.textbookRef,
        blocks: d.blocks, simplifiedBlocks: d.simplified?.blocks, isDemo: refs.isDemo,
        homeworkCount: simplified ? (d.simplified?.homeworkTaskIds?.length ?? homework) : homework,
      }}
      refs={{ media: refs.media, videos: refs.videos, practiceTasks }}
      simplified={simplified}
      onSimplifiedChange={setSimplified}
      badge={<span className={layout.badge}>Перегляд чернетки</span>}
    />
  )
}
