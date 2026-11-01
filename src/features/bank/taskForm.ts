import { z } from 'zod'
import { Feedback, Group, Level } from '@shared/schemas/common.ts'
import { keyIssues, TASK_SCHEMAS, type TaskType } from '@shared/schemas/tasks/index.ts'

/*
 * Форма редактора завдання (SPEC 10.3): спільні поля + зміст і ключ типу. Одна zod-схема для
 * перевірки форми (React Hook Form) і для збереження; узгодженість змісту й ключа — keyIssues,
 * ті самі правила, що й для пакетів. Рядок БД ↔ форма ↔ payload save_task — тут, без React.
 */

export type Visibility = 'open' | 'secure'

export interface TaskFormValues {
  type: TaskType
  level: z.infer<typeof Level>
  grp: z.infer<typeof Group>
  points: number
  visibility: Visibility
  /** Клас — тег для фільтра банку (tags.grade) */
  grade: number | null
  hint: string
  feedbackCorrect: string
  feedbackIncorrect: string
  content: Record<string, unknown>
  key: Record<string, unknown>
}

/** Рядок tasks + ключ з task_keys */
export interface TaskRow {
  type: string
  level: string
  grp: string
  points: number
  visibility: string
  tags: Record<string, unknown> | null
  hint: string | null
  feedback: { correct?: string; incorrect?: string } | null
  content: Record<string, unknown>
  key: Record<string, unknown>
}

export function fromRow(row: TaskRow): TaskFormValues {
  return {
    type: row.type as TaskType,
    level: row.level as TaskFormValues['level'],
    grp: row.grp as TaskFormValues['grp'],
    points: Number(row.points),
    visibility: row.visibility as Visibility,
    grade: typeof row.tags?.grade === 'number' ? row.tags.grade : null,
    hint: row.hint ?? '',
    feedbackCorrect: row.feedback?.correct ?? '',
    feedbackIncorrect: row.feedback?.incorrect ?? '',
    content: row.content,
    key: row.key,
  }
}

const opt = (s: string) => (s.trim() ? s.trim() : undefined)

/** Payload для RPC save_task: p_task (стовпці tasks) і p_key */
export function toSavePayload(v: TaskFormValues): { task: Record<string, unknown>; key: Record<string, unknown> } {
  const feedback = { correct: opt(v.feedbackCorrect), incorrect: opt(v.feedbackIncorrect) }
  return {
    task: {
      type: v.type,
      level: v.level,
      grp: v.grp,
      points: v.points,
      visibility: v.visibility,
      tags: v.grade ? { grade: v.grade } : {},
      content: v.content,
      hint: opt(v.hint) ?? null,
      feedback: feedback.correct || feedback.incorrect ? JSON.parse(JSON.stringify(feedback)) : null,
      printOverride: null,
    },
    key: v.key,
  }
}

const Meta = z.object({
  level: Level,
  grp: Group,
  points: z.number({ error: 'Бали — число' }).positive('більше 0').max(100).multipleOf(0.5, 'кратне 0,5'),
  visibility: z.enum(['open', 'secure']),
  grade: z.number().int().min(6).max(9).nullable(),
  hint: z.string().max(500),
  feedbackCorrect: z.string().max(500),
  feedbackIncorrect: z.string().max(500),
})

/** Схема форми для типу: спільні поля + зміст і ключ типу + узгодженість ключа зі змістом */
export function taskFormSchema(type: TaskType) {
  const s = TASK_SCHEMAS[type]
  return Meta.extend({ type: z.literal(type), content: s.content, key: s.key }).superRefine((v, ctx) => {
    // Помилки полів zod уже показав; тут — лише зв'язок ключа зі змістом (правильний варіант існує тощо)
    const c = s.content.safeParse(v.content)
    const k = s.key.safeParse(v.key)
    if (!c.success || !k.success) return
    for (const message of keyIssues(type, v.content, v.key)) ctx.addIssue({ code: 'custom', path: ['key'], message: message.replace(/^ключ:\s*/, '') })
  })
}

/** Текст завдання для списку банку й заголовка; у «Так чи ні» — ще й перше твердження (вказівка однакова) */
export const taskPrompt = (content: unknown): string => {
  const c = content as { prompt?: unknown; statements?: { text?: unknown }[] } | null
  const prompt = typeof c?.prompt === 'string' ? c.prompt.trim() : ''
  const first = c?.statements?.[0]?.text
  const statement = typeof first === 'string' && first.trim() ? first.trim() : ''
  if (statement) return prompt ? `${prompt} ${statement}` : statement
  return prompt || 'Без тексту'
}

export const LEVEL_OPTIONS: { value: TaskFormValues['level']; label: string }[] = [
  { value: 'base', label: 'Базовий' },
  { value: 'middle', label: 'Середній' },
  { value: 'sufficient', label: 'Достатній' },
  { value: 'high', label: 'Високий' },
]

export const GROUP_OPTIONS = Group.options.map((g) => ({ value: g, label: g }))

/** Feedback (SPEC 6.1) — для перегляду в TaskCard */
export const feedbackOf = (v: Pick<TaskFormValues, 'feedbackCorrect' | 'feedbackIncorrect'>): z.infer<typeof Feedback> | null => {
  const f = { correct: opt(v.feedbackCorrect), incorrect: opt(v.feedbackIncorrect) }
  return f.correct || f.incorrect ? f : null
}

