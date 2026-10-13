import { useState } from 'react'
import type { TaskViewProps } from '../types'
import { parseNumber } from './parse'
import classes from '../tasks.module.css'

export function NumericTask({ uid, content, value, onChange, disabled }: TaskViewProps<'numeric'>) {
  const [raw, setRaw] = useState(value.value === null ? '' : String(value.value).replace('.', ','))
  const invalid = raw.trim() !== '' && parseNumber(raw) === null
  return (
    <div className={classes.stack}>
      <label htmlFor={`${uid}-n`} className={classes.srOnly}>
        Відповідь{content.unit ? `, ${content.unit}` : ''}
      </label>
      <div className={classes.numberRow}>
        <input
          id={`${uid}-n`}
          className={classes.numberInput}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={raw}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${uid}-err` : undefined}
          onChange={(e) => {
            setRaw(e.target.value)
            onChange({ value: parseNumber(e.target.value) })
          }}
        />
        {content.unit && <span className={classes.unit}>{content.unit}</span>}
      </div>
      {invalid && (
        <p id={`${uid}-err`} className={classes.hint}>
          Введи число, наприклад 2061 або 0,5
        </p>
      )}
    </div>
  )
}
