import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { gradeLessonsQuery, type LessonListItem } from '@/api/content'
import layout from './lessonLayout.module.css'

interface DraftEntry {
  slug: string
  number: number | null
  title: string
  section: { number: number; title: string } | null
}

interface Props {
  grade: number
  slug: string
  /** Чи урок списку з того ж розділу */
  inSection: (l: LessonListItem) => boolean
  /** Перегляд чернетки: урок ще не опубліковано — показати його в списку на своєму місці */
  draft?: DraftEntry
}

/** Список уроків того ж розділу (комп'ютер, LessonDesktop.dc.html); дані — з кешу сторінки класу */
export function SectionAside({ grade, slug, inSection, draft }: Props) {
  const { data } = useQuery(gradeLessonsQuery(grade))
  const published = (data ?? []).filter((l) => inSection(l) && l.slug !== draft?.slug)
  const lessons: Pick<DraftEntry, 'slug' | 'number' | 'title'>[] = draft
    ? [...published, draft].sort((a, b) => (a.number ?? 999) - (b.number ?? 999))
    : published
  const section = draft?.section ?? published[0]?.section
  return (
    <nav className={layout.aside} aria-label="Уроки розділу">
      {section && (
        <span className={layout.asideTitle}>
          {section.number === 0 ? 'Вступ' : `Розділ ${section.number}`}. {section.title}
        </span>
      )}
      {lessons.map((l) =>
        l.slug === slug ? (
          <span key={l.slug} className={layout.asideLink} aria-current="page">
            <span className={layout.asideNum}>{l.number}</span>
            {l.title}
          </span>
        ) : (
          <Link key={l.slug} to="/lesson/$slug" params={{ slug: l.slug }} className={layout.asideLink}>
            <span className={layout.asideNum}>{l.number}</span>
            {l.title}
          </Link>
        ),
      )}
    </nav>
  )
}
