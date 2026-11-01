import { useFormState } from 'react-hook-form'
import { errorAt, nextId, useTaskParts } from './editorHooks'
import type { Option } from '@shared/schemas/common.ts'
import type { TaskFormValues } from '@/features/bank/taskForm'
import classes from './editor.module.css'

/*
 * Спільне для редакторів типів (SPEC 10.3): форма — React Hook Form (useFormContext) над
 * TaskFormValues; зміст і ключ — content / key, перевірка — zod-схема типу (taskForm.ts).
 */

export function FieldError({ path }: { path: string }) {
  const { errors } = useFormState<TaskFormValues>()
  const message = errorAt(errors, path)
  return message ? (
    <span className={classes.error} role="alert">
      {message}
    </span>
  ) : null
}

export function PromptField({ label = 'Текст завдання', placeholder }: { label?: string; placeholder?: string }) {
  const { content, setContent } = useTaskParts<{ prompt?: string }, unknown>()
  return (
    <label className={classes.field}>
      <span className={classes.label}>{label}</span>
      <textarea
        className={classes.textarea}
        value={content.prompt ?? ''}
        placeholder={placeholder}
        onChange={(e) => setContent({ ...content, prompt: e.target.value })}
      />
      <FieldError path="content.prompt" />
    </label>
  )
}

const Check = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12l5 5 9-10" />
  </svg>
)

/**
 * Варіанти відповіді з позначкою правильних (макет TaskEditor): одна правильна (вибір) або кілька;
 * додати / прибрати / «Перемішувати варіанти».
 */
export function OptionsEditor({ multiple, min, max }: { multiple: boolean; min: number; max: number }) {
  const { content, key, setContent, setKey } = useTaskParts<{ options: Option[]; shuffle?: boolean }, { correct: string | string[] }>()
  const options = content.options ?? []
  const correct = Array.isArray(key.correct) ? key.correct : key.correct ? [key.correct] : []
  const isCorrect = (id: string) => correct.includes(id)
  const toggle = (id: string) => {
    if (!multiple) return setKey({ correct: id })
    setKey({
      correct: isCorrect(id) ? correct.filter((x) => x !== id) : [...correct, id],
    })
  }
  const remove = (id: string) => {
    setContent({ ...content, options: options.filter((o) => o.id !== id) })
    if (isCorrect(id))
      setKey({
        correct: multiple ? correct.filter((x) => x !== id) : (options.find((o) => o.id !== id)?.id ?? ''),
      })
  }
  return (
    <fieldset className={classes.fieldset}>
      <legend className={classes.label}>
        Варіанти відповіді <span className={classes.hint}>— познач {multiple ? 'усі правильні' : 'правильний'}</span>
      </legend>
      {options.map((o, i) => (
        <div key={o.id} className={classes.item}>
          <div className={classes.row}>
            <button
              type="button"
              className={classes.mark}
              aria-pressed={isCorrect(o.id)}
              aria-label={`Варіант ${i + 1} — правильний`}
              onClick={() => toggle(o.id)}
            >
              <Check />
            </button>
            <input
              className={classes.input}
              value={o.text}
              aria-label={`Варіант ${i + 1}`}
              onChange={(e) =>
                setContent({
                  ...content,
                  options: options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)),
                })
              }
            />
            <button
              type="button"
              className={classes.remove}
              aria-label={`Прибрати варіант ${i + 1}`}
              disabled={options.length <= min}
              onClick={() => remove(o.id)}
            >
              ×
            </button>
          </div>
          <FieldError path={`content.options.${i}.text`} />
        </div>
      ))}
      {options.length < max && (
        <button
          type="button"
          className={classes.add}
          onClick={() =>
            setContent({
              ...content,
              options: [...options, { id: nextId(options.map((o) => o.id)), text: '' }],
            })
          }
        >
          + варіант
        </button>
      )}
      <label className={classes.check}>
        <input type="checkbox" checked={content.shuffle ?? true} onChange={(e) => setContent({ ...content, shuffle: e.target.checked })} />
        Перемішувати варіанти
      </label>
      <FieldError path="content.options" />
      <FieldError path="key.correct" />
      <FieldError path="key" />
    </fieldset>
  )
}
