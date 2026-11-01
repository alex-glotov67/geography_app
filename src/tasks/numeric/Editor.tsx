import { useState } from 'react'
import type { TaskContent, TaskKey } from '@shared/schemas/tasks/index.ts'
import { FieldError, PromptField } from '../editorKit'
import { useTaskParts } from '../editorHooks'
import classes from '../editor.module.css'

/** «0,5» і «0.5» — те саме число (як і у відповіді учня, SPEC 7); порожнє чи не число — NaN */
const parse = (s: string) => (s.trim() === '' ? Number.NaN : Number(s.replace(/\s/g, '').replace(',', '.')))
const show = (n: number | undefined) => (n === undefined || Number.isNaN(n) ? '' : String(n).replace('.', ','))

/** Редактор «Числова відповідь»: правильне число, допуск, одиниця (SPEC 10.3) */
export function NumericEditor() {
  const { content, key, setContent, setKey } = useTaskParts<TaskContent<'numeric'>, TaskKey<'numeric'>>()
  // Текст полів — локально: «2,» під час введення ще не число
  const [answer, setAnswer] = useState(show(key.answer))
  const [tolerance, setTolerance] = useState(show(key.tolerance ?? 0))
  return (
    <>
      <PromptField placeholder="Наприклад: Яка висота гори Говерла (м)?" />
      <div className={classes.grid}>
        <label className={classes.field}>
          <span className={classes.label}>Правильна відповідь</span>
          <input
            className={classes.input}
            inputMode="decimal"
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value)
              setKey({ ...key, answer: parse(e.target.value) })
            }}
          />
          <FieldError path="key.answer" />
        </label>
        <label className={classes.field}>
          <span className={classes.label}>Допуск ±</span>
          <input
            className={classes.input}
            inputMode="decimal"
            value={tolerance}
            onChange={(e) => {
              setTolerance(e.target.value)
              setKey({ ...key, tolerance: e.target.value.trim() === '' ? 0 : parse(e.target.value) })
            }}
          />
          <FieldError path="key.tolerance" />
        </label>
        <label className={classes.field}>
          <span className={classes.label}>Одиниця</span>
          <input className={classes.input} value={content.unit ?? ''} placeholder="м, °C, км²" onChange={(e) => setContent({ ...content, unit: e.target.value || undefined })} />
        </label>
      </div>
    </>
  )
}
