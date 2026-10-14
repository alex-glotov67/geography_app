import { useState, type ReactNode } from 'react'
import { DragBoard, Draggable } from '../DragBoard'
import { useDropZone } from '../dnd'
import { itemResult, type TaskViewProps } from '../types'
import classes from '../tasks.module.css'

function Zone({ id, className, label, children }: { id: string; className?: string; label: string; children: ReactNode }) {
  const drop = useDropZone(id)
  return (
    <section {...drop} className={className} aria-label={label}>
      {children}
    </section>
  )
}

/**
 * Групи (SPEC 7, MoreTasks.dc.html): картку перетягують у групу, між групами й назад (миша, палець)
 * або «торкнись картки, потім групи» (клавіатура, читачі екрана); картку в групі можна повернути.
 */
export function Categorize({ content, value, onChange, disabled, details }: TaskViewProps<'categorize'>) {
  const [picked, setPicked] = useState<string | null>(null)
  const pool = content.cards.filter((c) => !value.groups[c.id])
  const card = (id: string | null) => content.cards.find((c) => c.id === id)
  const place = (groupId: string | null, cardId: string) => {
    onChange({ groups: { ...value.groups, [cardId]: groupId } })
    setPicked(null)
  }
  const pickedText = card(picked)?.text
  return (
    <DragBoard
      label={(id) => card(id.replace(/^card:/, ''))?.text ?? ''}
      onDrop={(drag, target) => {
        const cardId = drag.replace(/^card:/, '')
        if (target === 'pool') place(null, cardId)
        else if (target?.startsWith('group:')) place(target.slice(6), cardId)
      }}
    >
      <div className={classes.stack}>
        <p className={classes.hint} aria-live="polite">
          {picked
            ? `Обрано «${pickedText}». Тепер торкнись групи.`
            : pool.length
              ? 'Перетягни картку в групу або торкнись картки, потім групи.'
              : 'Усі картки розподілено.'}
        </p>
        <Zone id="pool" className={classes.pool} label="Нерозподілені картки">
          {pool.map((c) => (
            <Draggable key={c.id} id={`card:${c.id}`} disabled={disabled}>
              {({ bind }) => (
                <button
                  type="button"
                  {...bind}
                  className={`${classes.card2} ${classes.draggable}`}
                  aria-pressed={picked === c.id}
                  disabled={disabled}
                  onClick={() => setPicked(picked === c.id ? null : c.id)}
                >
                  {c.text}
                </button>
              )}
            </Draggable>
          ))}
        </Zone>
        <div className={classes.groups}>
          {content.groups.map((g) => (
            <Zone key={g.id} id={`group:${g.id}`} className={classes.group} label={g.title}>
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
                  <Draggable key={c.id} id={`card:${c.id}`} disabled={disabled}>
                    {({ bind }) => (
                      <span {...bind} className={`${classes.placed} ${disabled ? '' : classes.draggable}`} data-result={itemResult(details, c.id)}>
                        {c.text}
                        {!disabled && (
                          <button type="button" className={classes.iconButton} aria-label={`Повернути «${c.text}»`} onClick={() => place(null, c.id)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                              <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                          </button>
                        )}
                      </span>
                    )}
                  </Draggable>
                ))}
            </Zone>
          ))}
        </div>
      </div>
    </DragBoard>
  )
}
