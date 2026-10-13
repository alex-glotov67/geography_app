import type { Option } from '@shared/schemas/common.ts'
import { useShuffled } from './shuffle'
import classes from './tasks.module.css'

interface Props {
  uid: string
  legend: string
  options: Option[]
  shuffle: boolean
  multiple: boolean
  selected: string[]
  onToggle: (id: string) => void
  disabled?: boolean
  /** id → 'ok' | 'err' після перевірки */
  resultOf?: (id: string) => 'ok' | 'err' | undefined
}

/** Варіанти відповіді: radio (одна) або checkbox (кілька); 52 px, як у Tasks.dc.html. */
export function OptionList({ uid, legend, options, shuffle, multiple, selected, onToggle, disabled, resultOf }: Props) {
  const ordered = useShuffled(options, shuffle)
  return (
    <fieldset className={classes.stack}>
      <legend className={classes.srOnly}>{legend}</legend>
      {ordered.map((o) => {
        const checked = selected.includes(o.id)
        return (
          <label key={o.id} className={classes.option} data-checked={checked} data-result={resultOf?.(o.id)}>
            <input
              className={classes.nativeInput}
              type={multiple ? 'checkbox' : 'radio'}
              name={uid}
              value={o.id}
              checked={checked}
              disabled={disabled}
              onChange={() => onToggle(o.id)}
            />
            <span className={classes.mark} data-shape={multiple ? 'square' : 'circle'} aria-hidden="true" />
            {o.text}
          </label>
        )
      })}
    </fieldset>
  )
}

