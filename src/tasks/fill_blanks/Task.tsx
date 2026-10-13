import { Fragment } from 'react'
import { itemResult, type TaskViewProps } from '../types'
import classes from '../tasks.module.css'

const PART = /(\{\{b\d+\}\})/

/** Пропуски в тексті: випадний список (select) або поле введення (input), SPEC 7. */
export function FillBlanks({ uid, content, value, onChange, disabled, details }: TaskViewProps<'fill_blanks'>) {
  let n = 0
  const set = (id: string, v: string) => onChange({ blanks: { ...value.blanks, [id]: v } })
  return (
    <p className={classes.blankText}>
      {content.text.split(PART).map((part, i) => {
        const m = /^\{\{(b\d+)\}\}$/.exec(part)
        if (!m) return <Fragment key={i}>{part}</Fragment>
        const id = m[1]!
        n++
        const common = {
          id: `${uid}-${id}`,
          className: classes.blankField,
          'aria-label': `Пропуск ${n}`,
          disabled,
          'data-result': itemResult(details, id),
          value: value.blanks[id] ?? '',
        }
        return content.mode === 'select' ? (
          <select key={i} {...common} onChange={(e) => set(id, e.target.value)}>
            <option value="">—</option>
            {(content.options?.[id] ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input key={i} {...common} type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} size={12} onChange={(e) => set(id, e.target.value)} />
        )
      })}
    </p>
  )
}
