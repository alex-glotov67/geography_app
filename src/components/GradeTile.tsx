import { Link } from '@tanstack/react-router'
import type { Grade } from '@/lib/grades'
import classes from './GradeTile.module.css'

export interface GradeTileProps {
  grade: Grade
}

/** Плитка класу на головній: велике число в кольорі «висоти» класу (SPEC 8.1, 13.1). */
export function GradeTile({ grade }: GradeTileProps) {
  return (
    <Link
      to="/grade/$grade"
      params={{ grade: String(grade) }}
      className={classes.tile}
      style={{ background: `var(--grade-${grade})` }}
      aria-label={`${grade} клас`}
    >
      <span className={classes.number} aria-hidden="true">
        {grade}
      </span>
      <span className={classes.caption} aria-hidden="true">
        клас
      </span>
    </Link>
  )
}
