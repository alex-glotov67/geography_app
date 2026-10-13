import { useMemo, useState, type ReactNode } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { gradeLessonsQuery, type LessonListItem } from '@/api/content'
import { ContourBackground } from '@/components/ContourBackground'
import { LessonListSkeleton } from '@/components/Skeletons'
import classes from './GradePage.module.css'

/** Шапка класу (Class.dc.html): колір «висоти», велике число, пошук. Однакова для готової сторінки й скелетона. */
function GradeShell({ grade, search, children }: { grade: number; search?: ReactNode; children: ReactNode }) {
  return (
    <div className={classes.page}>
      <header className={classes.header} style={{ background: `var(--grade-${grade})` }}>
        <div className={classes.headerInner}>
          <Link to="/" className={classes.back}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            Усі класи
          </Link>
          <h1 className={classes.title}>
            <span className={classes.titleNumber}>{grade}</span>
            <span className={classes.titleWord}>клас</span>
          </h1>
          {search}
        </div>
      </header>
      {children}
    </div>
  )
}

function SearchField({ value, onChange, disabled }: { value: string; onChange?: (v: string) => void; disabled?: boolean }) {
  return (
    <label className={classes.search}>
      <span>Знайти урок</span>
      <input
        className={classes.searchInput}
        type="search"
        placeholder="Наприклад: рельєф"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </label>
  )
}

/** Поки опублікованих уроків немає (зокрема на prod у Фазі 1) — SPEC 8.1 */
function Empty() {
  return (
    <section className={classes.empty}>
      <ContourBackground shape="peak" width={300} height={220} color="var(--water)" style={{ right: -90, bottom: -80 }} />
      <h2>Уроки готуються</h2>
      <p>Вчитель саме додає уроки цього класу. Зазирни трохи згодом — або повернись до вибору класу.</p>
    </section>
  )
}

function LessonList({ lessons, query }: { lessons: LessonListItem[]; query: string }) {
  const q = query.trim().toLocaleLowerCase('uk')
  const shown = q ? lessons.filter((l) => l.title.toLocaleLowerCase('uk').includes(q)) : lessons
  if (!lessons.length) return <Empty />
  if (!shown.length) return <p className={classes.sectionTitle}>Нічого не знайдено за запитом «{query}».</p>
  // Групи за розділами в порядку появи (дані вже відсортовані за розділом і номером)
  const groups: { key: string; title: string; lessons: LessonListItem[] }[] = []
  for (const l of shown) {
    const key = l.section?.id ?? 'other'
    const last = groups[groups.length - 1]
    if (last?.key === key) last.lessons.push(l)
    else groups.push({ key, title: l.section ? `Розділ ${l.section.number}. ${l.section.title}` : 'Інші уроки', lessons: [l] })
  }
  return (
    <>
      {groups.map((g) => (
        <section key={g.key} className={classes.group} aria-labelledby={`sec-${g.key}`}>
          <h2 id={`sec-${g.key}`} className={classes.sectionTitle}>
            {g.title}
          </h2>
          {g.lessons.map((l) => (
            <Link key={l.slug} to="/lesson/$slug" params={{ slug: l.slug }} className={classes.card}>
              <span className={classes.num} aria-hidden="true">
                {l.number ?? '•'}
              </span>
              <span className={classes.cardText}>
                <span className={classes.cardTitle}>
                  {l.number ? <span className={classes.srOnly}>Урок {l.number}. </span> : null}
                  {l.title}
                </span>
                {l.isDemo && <span className={classes.badge}>ДЕМО</span>}
              </span>
            </Link>
          ))}
        </section>
      ))}
    </>
  )
}

export function GradePage({ grade }: { grade: number }) {
  const { data } = useSuspenseQuery(gradeLessonsQuery(grade))
  const [query, setQuery] = useState('')
  const lessons = useMemo(() => data, [data])
  return (
    // Пошук є завжди (і на скелетоні) — шапка не змінює висоту, коли дані приходять
    <GradeShell grade={grade} search={<SearchField value={query} onChange={setQuery} disabled={!lessons.length} />}>
      <main className={classes.main}>
        <LessonList lessons={lessons} query={query} />
      </main>
    </GradeShell>
  )
}

export function GradePageSkeleton({ grade }: { grade: number }) {
  return (
    <GradeShell grade={grade} search={<SearchField value="" disabled />}>
      <main className={classes.main} style={{ padding: 0 }}>
        <LessonListSkeleton />
      </main>
    </GradeShell>
  )
}
