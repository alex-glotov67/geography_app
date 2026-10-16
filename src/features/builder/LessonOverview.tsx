import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { Me } from '@/api/auth'
import { lessonsQuery } from '@/api/builder'
import { TeacherPageSkeleton } from '@/features/teacher/TeacherSkeletons'
import t from '@/features/teacher/teacher.module.css'

/**
 * Сторінка уроку в кабінеті. Конструктор (SPEC 10.2) займе її в наступному кроці Фази 3 (PR 3.3);
 * поки — адреса, статус і перегляд опублікованої версії.
 */
export function LessonOverview({ me, lessonId }: { me: Extract<Me, { kind: 'teacher' }>; lessonId: string }) {
  const lessons = useQuery(lessonsQuery(me.id))
  if (lessons.isPending) return <TeacherPageSkeleton />
  const l = lessons.data?.find((x) => x.id === lessonId)
  if (!l) return <p className={t.alert}>Урок не знайдено.</p>
  return (
    <>
      <div className={t.pageHead}>
        <h1 className={t.pageTitle}>
          {l.number ? `Урок ${l.number}. ` : ''}
          {l.title}
          <span className={t.pageTitleNote}>{l.grade} клас</span>
        </h1>
        <div className={t.actions}>
          <Link to="/t/lessons" search={{ grade: l.grade }} className={t.btn}>
            До уроків
          </Link>
          {l.status !== 'draft' && (
            <Link to="/lesson/$slug" params={{ slug: l.slug }} className={t.btn}>
              Очима учня
            </Link>
          )}
        </div>
      </div>
      <section className={t.card}>
        <p className={t.note} style={{ maxWidth: 'none' }}>
          Адреса: <span className={t.mono}>/lesson/{l.slug}</span>
          {l.publishedVersion ? ` · опубліковано, версія ${l.publishedVersion}` : ' · чернетка'}
        </p>
        <p className={t.notice}>Конструктор уроку з'явиться в наступному оновленні Фази 3.</p>
      </section>
    </>
  )
}
