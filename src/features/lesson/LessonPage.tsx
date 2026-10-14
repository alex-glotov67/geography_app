import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { gradeLessonsQuery, lessonQuery } from '@/api/content'
import { BlockList } from '@/blocks/BlockList'
import { LessonContext } from '@/blocks/lessonContext'
import { ContourBackground } from '@/components/ContourBackground'
import { useViewSettings } from '@/stores/viewSettings'
import layout from './lessonLayout.module.css'

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
  const textbook = [s.textbookRef?.paragraph && `§ ${s.textbookRef.paragraph}`, s.textbookRef?.pages && `с. ${s.textbookRef.pages}`]
    .filter(Boolean)
    .join(', ')

  return (
    <LessonContext.Provider
      value={{
        slug, grade: s.grade, media: data.media, videos: data.videos, practiceTasks: data.practiceTasks,
        homeworkCount: simplified ? (s.simplified?.homeworkCount ?? data.homeworkCount) : data.homeworkCount,
        simplified,
      }}
    >
      <div className={layout.page}>
        <div className={layout.columns}>
          <SectionAside grade={s.grade} slug={slug} sectionNumber={s.section?.number ?? null} />
          <div className={layout.content}>
            <header className={layout.header}>
              <ContourBackground color={`var(--grade-${s.grade})`} />
              <div className={layout.headerTop}>
                <Link to="/grade/$grade" params={{ grade: String(s.grade) }} className={layout.back}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 6l-6 6 6 6" />
                  </svg>
                  {s.grade} клас
                </Link>
                {data.isDemo && <span className={layout.badge}>ДЕМО</span>}
              </div>
              <div className={layout.headerText} style={{ position: 'relative' }}>
                {s.number && <span className={layout.kicker}>Урок {s.number}</span>}
                <h1 className={layout.h1}>{s.title}</h1>
                {textbook && (
                  <span className={layout.textbook}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
                      <path d="M4 19V5" />
                    </svg>
                    Підручник: {textbook}
                  </span>
                )}
              </div>
              <button type="button" role="switch" aria-checked={simplified} className={layout.switch} onClick={() => setSimplified(!simplified)}>
                <span className={layout.switchTrack} aria-hidden="true" />
                Спрощений режим
              </button>
            </header>
            <main className={layout.main}>
              <BlockList blocks={s.blocks} simplifiedBlocks={s.simplified?.blocks} />
            </main>
          </div>
        </div>
      </div>
    </LessonContext.Provider>
  )
}
