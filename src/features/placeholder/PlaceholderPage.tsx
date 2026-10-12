import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import classes from './PlaceholderPage.module.css'

interface PlaceholderPageProps {
  title: string
  children?: ReactNode
}

/** Тимчасова сторінка для маршрутів, що з'являться в наступних фазах (SPEC 16). */
export function PlaceholderPage({ title, children }: PlaceholderPageProps) {
  return (
    <main className={classes.page}>
      <Link to="/" className={classes.back}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Усі класи
      </Link>
      <h1 className={classes.title}>{title}</h1>
      <p className={classes.text}>{children ?? 'Цей розділ ще готується.'}</p>
    </main>
  )
}
