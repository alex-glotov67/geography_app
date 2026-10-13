import { Link } from '@tanstack/react-router'
import type { z } from 'zod'
import type { PracticeBlock } from '@shared/schemas/blocks.ts'
import layout from '@/features/lesson/lessonLayout.module.css'
import { LevelIcon } from '@/components/LevelIcon'
import { LEVELS, LEVEL_LABEL } from '@/lib/levels'
import { tasksWord } from '@/lib/plural'
import { useLesson } from '../lessonContext'
import classes from '../blocks.module.css'

/** «Завдання» на сторінці уроку: рівні «сходинками» з кількістю, перехід у тренування (Lesson.dc.html). */
export function PracticeView({ block }: { block: z.infer<typeof PracticeBlock> }) {
  const { slug, practiceTasks } = useLesson()
  const tasks = block.taskIds.map((id) => practiceTasks[id]).filter((t) => t !== undefined)
  const levels = LEVELS.map((level) => ({ level, count: tasks.filter((t) => t.level === level).length })).filter((l) => l.count > 0)
  if (!levels.length) return null
  return (
    <section className={layout.section}>
      <h2 className={layout.h2}>{block.title ?? 'Завдання'}</h2>
      <p className={classes.lead}>Почни з першого рівня й піднімайся вище, як на гору.</p>
      {levels.map(({ level, count }) => (
        <Link key={level} to="/lesson/$slug/practice" params={{ slug }} search={{ level }} className={classes.linkRow}>
          <LevelIcon level={level} />
          <span className={classes.linkTitle}>{LEVEL_LABEL[level]}</span>
          <span className={classes.linkMeta}>{tasksWord(count)}</span>
        </Link>
      ))}
    </section>
  )
}
