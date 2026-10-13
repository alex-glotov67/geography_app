import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import classes from './PracticePage.module.css'

/** «← назва уроку» у шапці тренування — спільне для сторінки і скелетона */
export const PracticeBack = ({ slug, title }: { slug: string; title: ReactNode }) => (
  <Link to="/lesson/$slug" params={{ slug }} className={classes.back}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
    {title}
  </Link>
)

