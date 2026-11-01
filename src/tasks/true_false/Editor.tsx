import type { TaskContent, TaskKey } from '@shared/schemas/tasks/index.ts'
import { FieldError, PromptField } from '../editorKit'
import { nextId, useTaskParts } from '../editorHooks'
import classes from '../editor.module.css'

const MAX = 10

/** Редактор «Так / ні»: твердження й правильна відповідь для кожного (SPEC 10.3) */
export function TrueFalseEditor() {
  const { content, key, setContent, setKey } = useTaskParts<TaskContent<'true_false'>, TaskKey<'true_false'>>()
  const statements = content.statements ?? []
  const answers = key.answers ?? {}
  const remove = (id: string) => {
    setContent({ ...content, statements: statements.filter((s) => s.id !== id) })
    setKey({ answers: Object.fromEntries(Object.entries(answers).filter(([k]) => k !== id)) })
  }
  return (
    <>
      <PromptField label="Вказівка" />
      <fieldset className={classes.fieldset}>
        <legend className={classes.label}>
          Твердження <span className={classes.hint}>— для кожного: правильне чи ні</span>
        </legend>
        {statements.map((s, i) => (
          <div key={s.id} className={classes.item}>
            <div className={classes.row}>
              <input
                className={classes.input}
                value={s.text}
                aria-label={`Твердження ${i + 1}`}
                onChange={(e) => setContent({ ...content, statements: statements.map((x) => (x.id === s.id ? { ...x, text: e.target.value } : x)) })}
              />
              <div className={classes.segmented} role="group" aria-label={`Твердження ${i + 1}: відповідь`}>
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    className={classes.segment}
                    aria-pressed={answers[s.id] === v}
                    onClick={() => setKey({ answers: { ...answers, [s.id]: v } })}
                  >
                    {v ? 'Так' : 'Ні'}
                  </button>
                ))}
              </div>
              <button type="button" className={classes.remove} aria-label={`Прибрати твердження ${i + 1}`} disabled={statements.length <= 1} onClick={() => remove(s.id)}>
                ×
              </button>
            </div>
            <FieldError path={`content.statements.${i}.text`} />
          </div>
        ))}
        {statements.length < MAX && (
          <button
            type="button"
            className={classes.add}
            onClick={() => {
              const id = nextId(statements.map((s) => s.id), 's')
              setContent({ ...content, statements: [...statements, { id, text: '' }] })
              setKey({ answers: { ...answers, [id]: true } })
            }}
          >
            + твердження
          </button>
        )}
        <FieldError path="content.statements" />
        <FieldError path="key" />
      </fieldset>
    </>
  )
}
