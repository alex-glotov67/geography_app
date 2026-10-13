import { useState } from 'react'
import type { TaskViewProps } from '../types'
import classes from '../tasks.module.css'

const Arrow = ({ up }: { up?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
  </svg>
)

/** Упорядкування кнопками «вище / нижче» (MoreTasks.dc.html); оголошує переміщення для екранних читачів. */
export function Ordering({ content, value, onChange, disabled, details }: TaskViewProps<'ordering'>) {
  const [announce, setAnnounce] = useState('')
  const text = (id: string) => content.items.find((i) => i.id === id)?.text ?? id
  const move = (i: number, d: -1 | 1) => {
    const next = [...value.order]
    const j = i + d
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    onChange({ order: next })
    setAnnounce(`«${text(next[j]!)}» тепер на місці ${j + 1} з ${next.length}`)
  }
  return (
    <div className={classes.stack}>
      <ol className={classes.stack} style={{ listStyle: 'none' }} aria-label="Поточний порядок">
        {value.order.map((id, i) => (
          <li key={id} className={classes.orderItem}>
            <span className={classes.orderNum} aria-hidden="true">
              {i + 1}
            </span>
            <span className={classes.orderText}>{text(id)}</span>
            <button type="button" className={classes.iconButton} aria-label={`Вище: ${text(id)}`} disabled={disabled || i === 0} onClick={() => move(i, -1)}>
              <Arrow up />
            </button>
            <button type="button" className={classes.iconButton} aria-label={`Нижче: ${text(id)}`} disabled={disabled || i === value.order.length - 1} onClick={() => move(i, 1)}>
              <Arrow />
            </button>
          </li>
        ))}
      </ol>
      <p className={classes.srOnly} aria-live="polite">
        {announce}
      </p>
      {details && !details.exact && (
        <p className={classes.hint}>
          Правильних сусідніх пар: {String(details.correctPairs)} з {String(details.totalPairs)}
        </p>
      )}
    </div>
  )
}
