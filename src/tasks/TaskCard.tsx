import { useEffect, useId, useMemo, useState } from 'react'
import { check, type Scored } from '@shared/scoring/index.ts'
import { TASK_SCHEMAS, type TaskType } from '@shared/schemas/tasks/index.ts'
import type { Level } from '@shared/schemas/common.ts'
import { LevelIcon } from '@/components/LevelIcon'
import { LEVEL_LABEL } from '@/lib/levels'
import { answerKey, useAnswers } from '@/stores/answers'
import { TASKS } from './registry'
import classes from './tasks.module.css'

/** Відкрите завдання тренування — зі знімка task_versions (SPEC 6.1): ключ доступний клієнту. */
export interface PracticeTask {
  id: string
  type: string
  level: Level
  points: number
  content: unknown
  key: unknown
  hint?: string | null
  feedback?: { correct?: string; incorrect?: string } | null
}

interface Props {
  task: PracticeTask
  /** Номер у межах сторінки тренування */
  number: number
  /** `${lessonId}@${version}` — де зберігати відповідь (stores/answers); без нього — лише в пам'яті */
  scope?: string
}

type Tone = 'ok' | 'partial' | 'err' | 'info'

function message(type: string, r: Scored, task: PracticeTask): { tone: Tone; text: string } {
  if (r.fraction === 1) return { tone: 'ok', text: task.feedback?.correct ?? 'Правильно!' }
  const items = r.details.items as Record<string, boolean> | undefined
  const base = task.feedback?.incorrect
  if (type === 'numeric' && r.details.direction) {
    const dir = r.details.direction === 'low' ? 'Замало.' : 'Забагато.'
    return { tone: 'err', text: [dir, base].filter(Boolean).join(' ') }
  }
  if (r.fraction > 0 && items) {
    const n = Object.values(items).filter(Boolean).length
    return { tone: 'partial', text: `Правильно ${n} з ${Object.keys(items).length}. ${base ?? 'Перевір інші й спробуй ще.'}` }
  }
  if (r.fraction > 0) return { tone: 'partial', text: base ?? 'Частково правильно. Спробуй ще.' }
  return { tone: 'err', text: base ?? 'Не зовсім. Спробуй ще.' }
}

/** Картка тренувального завдання (Tasks.dc.html): рівень, питання, відповідь, «Перевірити», відгук. */
export function TaskCard({ task, number, scope = 'local' }: Props) {
  const uid = useId()
  const parsed = useMemo(() => {
    if (!(task.type in TASK_SCHEMAS)) return null
    const s = TASK_SCHEMAS[task.type as TaskType]
    const content = s.content.safeParse(task.content)
    const key = s.key.safeParse(task.key)
    return content.success && key.success ? { type: task.type as TaskType, content: content.data, key: key.data } : null
  }, [task])

  const mod = parsed ? TASKS[parsed.type] : null
  const key = answerKey(scope, task.id)
  const saved = useAnswers((st) => st.answers[key])
  const save = useAnswers((st) => st.save)
  // Стартова відповідь (для упорядкування — перемішаний порядок) фіксується один раз і зберігається,
  // щоб перемонтування не перемішувало заново
  const [initial] = useState<unknown>(() => {
    if (!parsed || !mod) return null
    const empty = mod.empty(parsed.content as never) as { order?: string[] }
    // Упорядкування: стартовий порядок не має збігатися з правильним
    const correctOrder = (parsed.key as { correctOrder?: string[] }).correctOrder
    if (empty.order && correctOrder && empty.order.join() === correctOrder.join()) {
      // Зсув на одну позицію — для різних елементів завжди інший порядок (повторне тасування могло знову
      // дати правильний, і учень бачив би вже розв'язане завдання)
      return { order: [...empty.order.slice(1), empty.order[0]!] }
    }
    return empty
  })
  useEffect(() => {
    if (!saved && initial !== null) save(key, { value: initial, checked: false })
  }, [saved, initial, key, save])
  const value = saved?.value ?? initial
  const result: Scored | null =
    parsed && saved?.checked ? check(parsed.type, parsed.content as never, parsed.key as never, value as never, task.points) : null
  const [nudge, setNudge] = useState(false)

  if (!parsed || !mod) {
    return (
      <section className={classes.card}>
        <p className={classes.feedback} data-tone="err">
          Це завдання не вдалося показати. Повідом вчителя.
        </p>
      </section>
    )
  }
  const { Task } = mod as unknown as { Task: React.ComponentType<Record<string, unknown>> }
  const prompt = (parsed.content as { prompt?: string }).prompt
  const fb = result ? message(parsed.type, result, task) : null

  const onCheck = () => {
    if (!mod.isAnswered(value as never, parsed.content as never)) {
      setNudge(true)
      save(key, { value, checked: false })
      return
    }
    setNudge(false)
    save(key, { value, checked: true })
  }

  return (
    <section className={classes.card} aria-labelledby={`${uid}-h`}>
      <LevelIcon level={task.level} withLabel />
      <h2 id={`${uid}-h`} className={classes.prompt}>
        <span className={classes.srOnly}>
          Завдання {number}, {LEVEL_LABEL[task.level].toLowerCase()} рівень:
        </span>{' '}
        {prompt}
      </h2>
      <Task
        uid={uid}
        content={parsed.content}
        value={value}
        onChange={(v: unknown) => {
          save(key, { value: v, checked: false })
          setNudge(false)
        }}
        details={result?.details ?? null}
      />
      <button type="button" className={classes.primary} onClick={onCheck}>
        Перевірити
      </button>
      <div aria-live="polite">
        {nudge && (
          <p className={classes.feedback} data-tone="info">
            Спершу дай відповідь.
          </p>
        )}
        {fb && (
          <p className={classes.feedback} data-tone={fb.tone} role="status">
            {fb.text}
          </p>
        )}
        {fb && fb.tone !== 'ok' && task.hint && (
          <p className={classes.hint}>
            <strong>Підказка:</strong> {task.hint}
          </p>
        )}
      </div>
    </section>
  )
}
