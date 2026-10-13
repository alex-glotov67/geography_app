import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { lessonQuery } from '@/api/content'
import { LevelIcon } from '@/components/LevelIcon'
import { LEVELS, LEVEL_LABEL, type Level } from '@/lib/levels'
import { TaskCard } from '@/tasks/TaskCard'
import { PracticeBack as Back } from './PracticeBack'
import classes from './PracticePage.module.css'

/** «Перевір себе»: відкриті завдання уроку з миттєвою перевіркою (SPEC 8.1); ?level — один рівень. */
export function PracticePage({ slug, level }: { slug: string; level?: Level }) {
  const { data } = useSuspenseQuery(lessonQuery(slug))
  const ids = data.snapshot.blocks.flatMap((b) => (b.type === 'practice' ? b.taskIds : []))
  const tasks = [...new Set(ids)].map((id) => data.practiceTasks[id]).filter((t) => t !== undefined)
  const levels = LEVELS.filter((l) => tasks.some((t) => t.level === l))
  const shown = level ? tasks.filter((t) => t.level === level) : tasks
  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div className={classes.inner}>
          <Back slug={slug} title={data.snapshot.title} />
          <h1 className={classes.h1}>Перевір себе</h1>
          {levels.length > 1 && (
            <nav className={classes.filters} aria-label="Рівні завдань">
              <Link to="/lesson/$slug/practice" params={{ slug }} search={{}} className={classes.filter} aria-current={!level ? 'page' : undefined}>
                Усі рівні
              </Link>
              {levels.map((l) => (
                <Link key={l} to="/lesson/$slug/practice" params={{ slug }} search={{ level: l }} className={classes.filter} aria-current={level === l ? 'page' : undefined}>
                  <LevelIcon level={l} size={24} />
                  {LEVEL_LABEL[l]}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </header>
      <main className={classes.main}>
        <div className={classes.list}>
          {shown.map((t, i) => (
            <TaskCard key={t.id} task={t} number={i + 1} />
          ))}
        </div>
      </main>
    </div>
  )
}
