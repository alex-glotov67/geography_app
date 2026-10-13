import classes from './tasks.module.css'

interface Props {
  name: string
  legend: string
  choices: { id: string; text: string }[]
  selected: string | null | undefined
  onSelect: (id: string) => void
  disabled?: boolean
  wide?: boolean
  result?: 'ok' | 'err'
}

/** Рядок варіантів-«пігулок» (radio): відповідність, «так / ні». 44 px, як у Tasks.dc.html. */
export function ChipGroup({ name, legend, choices, selected, onSelect, disabled, wide, result }: Props) {
  return (
    <fieldset className={`${classes.row} ${classes.stack}`}>
      <legend className={classes.rowTitle}>{legend}</legend>
      <div className={`${classes.chips} ${wide ? classes.chipsWide : ''}`}>
        {choices.map((c) => (
          <label key={c.id} className={classes.chip} data-checked={selected === c.id}>
            <input
              className={classes.nativeInput}
              type="radio"
              name={name}
              value={c.id}
              checked={selected === c.id}
              disabled={disabled}
              onChange={() => onSelect(c.id)}
            />
            {c.text}
          </label>
        ))}
      </div>
      {result && (
        <span className={classes.rowResult} data-result={result}>
          {result === 'ok' ? 'Правильно' : 'Неправильно'}
        </span>
      )}
    </fieldset>
  )
}
