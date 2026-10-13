import { useState } from 'react'
import { itemResult, type TaskViewProps } from '../types'
import classes from '../tasks.module.css'

/**
 * Групи: «торкнись картки, потім групи» (SPEC 7, MoreTasks.dc.html). Картку в групі можна
 * повернути назад. Усе — звичайні кнопки, тож працює з клавіатури.
 */
export function Categorize({ content, value, onChange, disabled, details }: TaskViewProps<'categorize'>) {
  const [picked, setPicked] = useState<string | null>(null)
  const pool = content.cards.filter((c) => !value.groups[c.id])
  const place = (groupId: string | null, cardId: string) => {
    onChange({ groups: { ...value.groups, [cardId]: groupId } })
    setPicked(null)
  }
  const pickedText = content.cards.find((c) => c.id === picked)?.text
  return (
    <div className={classes.stack}>
      <p className={classes.hint} aria-live="polite">
        {picked ? `Обрано «${pickedText}». Тепер торкнись групи.` : pool.length ? 'Торкнись картки, потім групи.' : 'Усі картки розподілено.'}
      </p>
      <div className={classes.pool}>
        {pool.map((c) => (
          <button
            key={c.id}
            type="button"
            className={classes.card2}
            aria-pressed={picked === c.id}
            disabled={disabled}
            onClick={() => setPicked(picked === c.id ? null : c.id)}
          >
            {c.text}
          </button>
        ))}
      </div>
      <div className={classes.groups}>
        {content.groups.map((g) => (
          <section key={g.id} className={classes.group} aria-label={g.title}>
            <button
              type="button"
              className={classes.groupButton}
              disabled={disabled || !picked}
              onClick={() => picked && place(g.id, picked)}
            >
              {g.title}
              {picked && <span className={classes.srOnly}>: покласти сюди «{pickedText}»</span>}
            </button>
            {content.cards
              .filter((c) => value.groups[c.id] === g.id)
              .map((c) => (
                <span key={c.id} className={classes.placed} data-result={itemResult(details, c.id)}>
                  {c.text}
                  {!disabled && (
                    <button type="button" className={classes.iconButton} aria-label={`Повернути «${c.text}»`} onClick={() => place(null, c.id)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  )}
                </span>
              ))}
          </section>
        ))}
      </div>
    </div>
  )
}
