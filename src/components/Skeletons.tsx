import type { CSSProperties, ReactNode } from 'react'
import { Skeleton } from '@mantine/core'
import layout from '@/features/lesson/lessonLayout.module.css'
import classes from './Skeletons.module.css'

/*
 * Скелетони (SPEC 13.7): кожен маршрут або блок, що вантажить дані, показує скелетон ТІЄЇ Ж форми й
 * розмірів, що й готовий екран. Повноекранний спінер заборонено. Статичні заголовки секцій — справжні.
 */

interface LineProps {
  width: CSSProperties['width']
  height?: number
  /** `tint` — у шапках з тлом --paper-tint */
  tone?: 'default' | 'tint'
  radius?: number
}

/** Один сірий прямокутник на місці тексту чи медіа. */
export function SkeletonLine({ width, height = 18, tone = 'default', radius }: LineProps) {
  return <Skeleton width={width} height={height} radius={radius} data-tone={tone} />
}

interface BusyProps {
  label: string
  children: ReactNode
  className?: string
}

/** Обгортка: `aria-busy` і назва для екранних читачів, щоб було зрозуміло, що вміст вантажиться. */
export function SkeletonRegion({ label, children, className }: BusyProps) {
  return (
    <div aria-busy="true" aria-label={label} role="status" className={className}>
      {children}
    </div>
  )
}

const TERM_WIDTHS = ['36%', '44%', '40%', '28%']
const TEXT_WIDTHS = ['100%', '96%', '92%', '100%', '88%', '60%']
const LEVEL_WIDTHS = ['30%', '34%', '38%', '30%']

/** Сторінка уроку, що вантажиться (макет LessonSkeleton.dc.html); та сама розмітка, що й LessonPage. */
export function LessonPageSkeleton() {
  return (
    <SkeletonRegion label="Урок завантажується" className={layout.page}>
      <div className={layout.columns}>
        <div className={layout.aside}>
          <SkeletonLine width="80%" height={16} />
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonLine key={i} width="100%" height={44} radius={10} />
          ))}
        </div>
        <div className={layout.content}>
          <header className={layout.header}>
            <SkeletonLine width={96} height={44} tone="tint" radius={10} />
            <div className={layout.headerText}>
              <SkeletonLine width={64} tone="tint" />
              <SkeletonLine width={260} height={34} tone="tint" radius={8} />
              <SkeletonLine width={200} tone="tint" />
            </div>
            <SkeletonLine width={196} height={44} tone="tint" radius={999} />
          </header>

          <main className={layout.main}>
            <section className={layout.section}>
              <h2 className={layout.h2}>Що ти дізнаєшся</h2>
              {['88%', '76%', '82%'].map((w) => (
                <SkeletonLine key={w} width={w} />
              ))}
            </section>

            <section className={layout.sectionTight}>
              <h2 className={layout.h2}>Ключові терміни</h2>
              {TERM_WIDTHS.map((w) => (
                <div key={w} className={layout.termRow}>
                  <SkeletonLine width={w} />
                </div>
              ))}
            </section>

            <section className={layout.sectionTight}>
              <h2 className={layout.h2}>Пояснення</h2>
              {TEXT_WIDTHS.map((w, i) => (
                <SkeletonLine key={i} width={w} height={17} />
              ))}
            </section>

            <section className={layout.section}>
              <h2 className={layout.h2}>Відео</h2>
              <Skeleton className={layout.video} radius={16} />
            </section>

            <section className={layout.section}>
              <h2 className={layout.h2}>Завдання</h2>
              {LEVEL_WIDTHS.map((w, i) => (
                <div key={i} className={layout.levelRow}>
                  <SkeletonLine width={34} height={24} radius={4} />
                  <SkeletonLine width={w} />
                </div>
              ))}
            </section>
          </main>
        </div>
      </div>
    </SkeletonRegion>
  )
}

/** Список уроків класу (макет Class.dc.html): картки 40-px кружок номера + назва + статус. */
export function LessonListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <SkeletonRegion label="Уроки завантажуються" className={classes.list}>
      <SkeletonLine width="70%" height={18} />
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={classes.lessonCard}>
          <Skeleton circle height={40} />
          <div className={classes.lessonText}>
            <SkeletonLine width={i % 2 ? '72%' : '58%'} height={20} />
            <SkeletonLine width={84} height={22} radius={999} />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  )
}

/** Картка одного завдання (макет Tasks.dc.html): рівень, питання, 3 варіанти, кнопка. */
export function TaskCardSkeleton() {
  return (
    <SkeletonRegion label="Завдання завантажується" className={classes.taskCard}>
      <SkeletonLine width={180} height={18} />
      <SkeletonLine width="90%" height={22} />
      {[0, 1, 2].map((i) => (
        <SkeletonLine key={i} width="100%" height={52} radius={12} />
      ))}
      <SkeletonLine width="100%" height={50} radius={12} />
    </SkeletonRegion>
  )
}
