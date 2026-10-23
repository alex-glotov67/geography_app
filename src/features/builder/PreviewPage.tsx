import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Me } from '@/api/auth'
import { builderLessonQuery, directoryQuery } from '@/api/builder'
import layout from '@/features/lesson/lessonLayout.module.css'
import { LessonView } from '@/features/lesson/LessonView'
import { SectionAside } from '@/features/lesson/SectionAside'
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
export function PreviewPage({ me, lessonId, simplified: initialSimplified }: { me: Extract<Me, { kind: 'teacher' }>; lessonId: string; simplified: boolean }) {
  const lesson = useQuery(builderLessonQuery(lessonId))
  const directory = useQuery(directoryQuery(me.id))
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
  const section = directory.data?.find((x) => x.id === d.sectionId)
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
      // Як в учня на комп'ютері: список уроків розділу, чернетка — на своєму місці
      aside={
        <SectionAside
          grade={d.grade}
          slug={d.slug}
          inSection={(l) => (l.section?.id ?? null) === d.sectionId}
          draft={{ slug: d.slug, number: d.number, title: d.title || 'Без теми', section: section ? { number: section.number, title: section.title } : null }}
        />
      }
    />
  )
}
