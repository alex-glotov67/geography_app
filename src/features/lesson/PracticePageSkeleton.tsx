import { SkeletonLine, TaskCardSkeleton } from '@/components/Skeletons'
import { PracticeBack as Back } from './PracticeBack'
import classes from './PracticePage.module.css'

/** Скелетон тренування — окремий легкий файл, щоб рушій завдань не потрапляв у головний чанк */
export function PracticePageSkeleton({ slug }: { slug: string }) {
  return (
    <div className={classes.page} aria-busy="true">
      <header className={classes.header}>
        <div className={classes.inner}>
          <Back slug={slug} title={<SkeletonLine width={140} />} />
          <h1 className={classes.h1}>Перевір себе</h1>
          {/* Рядок фільтрів рівнів тієї ж висоти — щоб картки не зсувались, коли дані прийдуть */}
          <div className={classes.filters} aria-hidden="true">
            {[96, 104, 112, 116, 100].map((w) => (
              <SkeletonLine key={w} width={w} height={44} radius={999} />
            ))}
          </div>
        </div>
      </header>
      <main className={classes.main}>
        <div className={classes.list}>
          <TaskCardSkeleton />
          <TaskCardSkeleton />
        </div>
      </main>
    </div>
  )
}
