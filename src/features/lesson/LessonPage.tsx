import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { gradeLessonsQuery, lessonQuery } from '@/api/content'
import { useViewSettings } from '@/stores/viewSettings'
import layout from './lessonLayout.module.css'
import { LessonView } from './LessonView'

/** Список уроків того ж розділу (комп'ютер, LessonDesktop.dc.html); дані — з кешу сторінки класу */
function SectionAside({ grade, slug, sectionNumber }: { grade: number; slug: string; sectionNumber: number | null }) {
  const { data } = useQuery(gradeLessonsQuery(grade))
  const lessons = (data ?? []).filter((l) => (l.section?.number ?? null) === sectionNumber)
  const section = lessons[0]?.section
  return (
    <nav className={layout.aside} aria-label="Уроки розділу">
      {section && (
        <span className={layout.asideTitle}>
          Розділ {section.number}. {section.title}
        </span>
      )}
      {lessons.map((l) => (
        <Link key={l.slug} to="/lesson/$slug" params={{ slug: l.slug }} className={layout.asideLink} aria-current={l.slug === slug ? 'page' : undefined}>
          <span className={layout.asideNum}>{l.number}</span>
          {l.title}
        </Link>
      ))}
    </nav>
  )
}

export function LessonPage({ slug }: { slug: string }) {
  const { data } = useSuspenseQuery(lessonQuery(slug))
  const { simplified, setSimplified } = useViewSettings()
  const s = data.snapshot
  return (
    <LessonView
      lesson={{
        slug, grade: s.grade, number: s.number, title: s.title, textbookRef: s.textbookRef, blocks: s.blocks,
        simplifiedBlocks: s.simplified?.blocks, isDemo: data.isDemo,
        homeworkCount: simplified ? (s.simplified?.homeworkCount ?? data.homeworkCount) : data.homeworkCount,
      }}
      refs={{ media: data.media, videos: data.videos, practiceTasks: data.practiceTasks }}
      simplified={simplified}
      onSimplifiedChange={setSimplified}
      aside={<SectionAside grade={s.grade} slug={slug} sectionNumber={s.section?.number ?? null} />}
    />
  )
}
