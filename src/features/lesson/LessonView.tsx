import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import type { Block } from '@shared/schemas/blocks.ts'
import { BlockList } from '@/blocks/BlockList'
import { LessonContext, type LessonContextValue } from '@/blocks/lessonContext'
import { ContourBackground } from '@/components/ContourBackground'
import layout from './lessonLayout.module.css'

export interface LessonViewData {
  slug: string
  grade: number
  number: number | null
  title: string
  textbookRef: { paragraph?: string; pages?: string } | null
  blocks: Block[]
  simplifiedBlocks?: Block[]
  /** Кількість завдань ДЗ — уже для обраного режиму (основний / спрощений) */
  homeworkCount: number
  isDemo: boolean
}

interface LessonViewProps {
  lesson: LessonViewData
  refs: Pick<LessonContextValue, 'media' | 'videos' | 'practiceTasks'>
  simplified: boolean
  onSimplifiedChange: (v: boolean) => void
  /** Список уроків розділу (комп'ютер) */
  aside?: ReactNode
  /** Позначка в шапці, напр. «Перегляд чернетки» */
  badge?: ReactNode
}

/**
 * Сторінка уроку (Lesson.dc.html, LessonDesktop.dc.html) — одна для опублікованого уроку й
 * перегляду чернетки в конструкторі (SPEC 10.1: перегляд = справжня сторінка учня).
 */
export function LessonView({ lesson: s, refs, simplified, onSimplifiedChange, aside, badge }: LessonViewProps) {
  const textbook = [s.textbookRef?.paragraph && `§ ${s.textbookRef.paragraph}`, s.textbookRef?.pages && `с. ${s.textbookRef.pages}`]
    .filter(Boolean)
    .join(', ')

  return (
    <LessonContext.Provider value={{ slug: s.slug, grade: s.grade, ...refs, homeworkCount: s.homeworkCount, simplified }}>
      <div className={layout.page}>
        <div className={layout.columns}>
          {aside}
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
                {s.isDemo && <span className={layout.badge}>ДЕМО</span>}
                {badge}
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
              <button type="button" role="switch" aria-checked={simplified} className={layout.switch} onClick={() => onSimplifiedChange(!simplified)}>
                <span className={layout.switchTrack} aria-hidden="true" />
                Спрощений режим
              </button>
            </header>
            <main className={layout.main}>
              <BlockList blocks={s.blocks} simplifiedBlocks={s.simplifiedBlocks} />
            </main>
          </div>
        </div>
      </div>
    </LessonContext.Provider>
  )
}
