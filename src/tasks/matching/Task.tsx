import { useState } from 'react'
import { DragBoard, Draggable } from '../DragBoard'
import { useDropZone } from '../dnd'
import { itemResult, type TaskViewProps } from '../types'
import classes from '../tasks.module.css'

type Item = { id: string; text: string }

function Slot({ left, value, picked, disabled, result, onPlace, onClear }: {
  left: Item
  value: Item | undefined
  picked: Item | undefined
  disabled?: boolean
  result?: 'ok' | 'err'
  onPlace: () => void
  onClear: () => void
}) {
  const drop = useDropZone(`slot:${left.id}`, disabled)
  return (
    <div className={classes.matchRow}>
      <span className={classes.rowTitle} aria-hidden="true">
        {left.text}
      </span>
      <div className={classes.slotLine}>
        <button
          type="button"
          {...drop}
          className={classes.slot}
          data-filled={!!value || undefined}
          data-result={result}
          disabled={disabled || (!picked && !value)}
          aria-label={value ? `${left.text}: ${value.text}` : picked ? `Покласти «${picked.text}» у «${left.text}»` : `${left.text}: порожньо`}
          onClick={onPlace}
        >
          {value ? value.text : picked ? `Покласти «${picked.text}»` : 'Перетягни або торкнись варіанта'}
        </button>
        {value && !disabled && (
          <button type="button" className={classes.iconButton} aria-label={`Прибрати «${value.text}» з «${left.text}»`} onClick={onClear}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>
      {result && (
        <span className={classes.rowResult} data-result={result}>
          {result === 'ok' ? 'Правильно' : 'Неправильно'}
        </span>
      )}
    </div>
  )
}

/**
 * Відповідність (SPEC 7): варіант справа перетягують у рядок зліва (миша, палець) або
 * «торкнись варіанта → торкнись рядка» (клавіатура, читачі екрана). Варіант можна обрати
 * для кількох рядків; значення в рядку можна прибрати.
 */
export function Matching({ content, value, onChange, disabled, details }: TaskViewProps<'matching'>) {
  const [picked, setPicked] = useState<string | null>(null)
  const right = (id: string | null | undefined) => content.right.find((r) => r.id === id)
  const assign = (leftId: string, rightId: string | null) => {
    onChange({ pairs: { ...value.pairs, [leftId]: rightId } })
    setPicked(null)
  }
  return (
    <DragBoard
      label={(id) => right(id.replace(/^opt:/, ''))?.text ?? ''}
      onDrop={(drag, target) => {
        if (target?.startsWith('slot:')) assign(target.slice(5), drag.replace(/^opt:/, ''))
      }}
    >
      <div className={classes.stack}>
        <p className={classes.hint} aria-live="polite">
          {picked ? `Обрано «${right(picked)?.text}». Тепер торкнись рядка.` : 'Перетягни варіант у рядок або торкнись варіанта, потім рядка.'}
        </p>
        <div className={classes.pool} role="group" aria-label="Варіанти">
          {content.right.map((r) => (
            <Draggable key={r.id} id={`opt:${r.id}`} disabled={disabled}>
              {({ bind }) => (
                <button
                  type="button"
                  {...bind}
                  className={`${classes.card2} ${classes.draggable}`}
                  aria-pressed={picked === r.id}
                  disabled={disabled}
                  onClick={() => setPicked(picked === r.id ? null : r.id)}
                >
                  {r.text}
                </button>
              )}
            </Draggable>
          ))}
        </div>
        {content.left.map((l) => (
          <Slot
            key={l.id}
            left={l}
            value={right(value.pairs[l.id])}
            picked={right(picked)}
            disabled={disabled}
            result={itemResult(details, l.id)}
            onPlace={() => picked && assign(l.id, picked)}
            onClear={() => assign(l.id, null)}
          />
        ))}
      </div>
    </DragBoard>
  )
}
