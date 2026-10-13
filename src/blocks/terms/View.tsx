import { useId, useState } from 'react'
import type { z } from 'zod'
import type { TermsBlock } from '@shared/schemas/blocks.ts'
import layout from '@/features/lesson/lessonLayout.module.css'
import classes from '../blocks.module.css'

/** Ключові терміни: розгортаються по одному (кнопка з aria-expanded), рядок 52 px. */
export function TermsView({ block }: { block: z.infer<typeof TermsBlock> }) {
  const uid = useId()
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section className={layout.sectionTight}>
      <h2 className={layout.h2}>Ключові терміни</h2>
      {block.items.map((t, i) => (
        <div key={t.term} className={classes.term}>
          <button
            type="button"
            className={classes.termButton}
            aria-expanded={open === i}
            aria-controls={`${uid}-${i}`}
            onClick={() => setOpen(open === i ? null : i)}
          >
            {t.term}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--water)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <p id={`${uid}-${i}`} className={classes.termDef} hidden={open !== i}>
            {t.definition}
          </p>
        </div>
      ))}
    </section>
  )
}
