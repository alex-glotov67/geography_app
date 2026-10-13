import { z } from 'zod'
import { Feedback, Group, Level, Text } from '../common.ts'
import { CategorizeAnswer, CategorizeContent, CategorizeKey } from './categorize.ts'
import { FillBlanksAnswer, FillBlanksContent, FillBlanksKey, blankIds } from './fill_blanks.ts'
import { MatchingAnswer, MatchingContent, MatchingKey } from './matching.ts'
import { MultipleChoiceAnswer, MultipleChoiceContent, MultipleChoiceKey } from './multiple_choice.ts'
import { NumericAnswer, NumericContent, NumericKey } from './numeric.ts'
import { OrderingAnswer, OrderingContent, OrderingKey } from './ordering.ts'
import { SingleChoiceAnswer, SingleChoiceContent, SingleChoiceKey } from './single_choice.ts'
import { TrueFalseAnswer, TrueFalseContent, TrueFalseKey } from './true_false.ts'

export * from './categorize.ts'
export * from './fill_blanks.ts'
export * from './matching.ts'
export * from './multiple_choice.ts'
export * from './numeric.ts'
export * from './ordering.ts'
export * from './single_choice.ts'
export * from './true_false.ts'

/**
 * Реєстр типів завдань (SPEC 7): зміст (без ключа), ключ, відповідь учня.
 * Новий тип — новий файл тут + `check` у ../../scoring + модуль у src/tasks/<type>/.
 */
export const TASK_SCHEMAS = {
  single_choice: { content: SingleChoiceContent, key: SingleChoiceKey, answer: SingleChoiceAnswer },
  multiple_choice: { content: MultipleChoiceContent, key: MultipleChoiceKey, answer: MultipleChoiceAnswer },
  true_false: { content: TrueFalseContent, key: TrueFalseKey, answer: TrueFalseAnswer },
  matching: { content: MatchingContent, key: MatchingKey, answer: MatchingAnswer },
  ordering: { content: OrderingContent, key: OrderingKey, answer: OrderingAnswer },
  categorize: { content: CategorizeContent, key: CategorizeKey, answer: CategorizeAnswer },
  fill_blanks: { content: FillBlanksContent, key: FillBlanksKey, answer: FillBlanksAnswer },
  numeric: { content: NumericContent, key: NumericKey, answer: NumericAnswer },
} as const

export type TaskType = keyof typeof TASK_SCHEMAS
export const TASK_TYPES = Object.keys(TASK_SCHEMAS) as TaskType[]
export const TaskType = z.enum(TASK_TYPES as [TaskType, ...TaskType[]])

export type TaskContent<T extends TaskType = TaskType> = z.infer<(typeof TASK_SCHEMAS)[T]['content']>
export type TaskKey<T extends TaskType = TaskType> = z.infer<(typeof TASK_SCHEMAS)[T]['key']>
export type TaskAnswer<T extends TaskType = TaskType> = z.infer<(typeof TASK_SCHEMAS)[T]['answer']>

/** Спільні поля завдання (SPEC 6.1) — стовпці tasks / task_versions. */
export const TaskMeta = z.object({
  level: Level,
  grp: Group,
  points: z.number().positive().max(100).multipleOf(0.5).default(1),
  hint: Text.optional(),
  feedback: Feedback.optional(),
  visibility: z.enum(['open', 'secure']),
})

/** Ті самі елементи, кожен рівно один раз (порядок не важливий). */
const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && new Set(a).size === a.length && b.every((x) => a.includes(x))

/**
 * Узгодженість змісту й ключа: правильні id існують у змісті, пари й порядок покривають усі
 * елементи. Повертає список проблем (порожній — усе гаразд).
 */
export function keyIssues(type: TaskType, content: unknown, key: unknown): string[] {
  const issues: string[] = []
  const c = TASK_SCHEMAS[type].content.safeParse(content)
  const k = TASK_SCHEMAS[type].key.safeParse(key)
  if (!c.success) issues.push(...c.error.issues.map((i) => `зміст.${i.path.join('.')}: ${i.message}`))
  if (!k.success) issues.push(...k.error.issues.map((i) => `ключ.${i.path.join('.')}: ${i.message}`))
  if (!c.success || !k.success) return issues
  const cv = c.data as never
  const kv = k.data as never

  switch (type) {
    case 'single_choice': {
      const { options } = cv as TaskContent<'single_choice'>
      const { correct } = kv as TaskKey<'single_choice'>
      if (!options.some((o) => o.id === correct)) issues.push(`ключ: варіанта «${correct}» немає`)
      break
    }
    case 'multiple_choice': {
      const ids = (cv as TaskContent<'multiple_choice'>).options.map((o) => o.id)
      const { correct } = kv as TaskKey<'multiple_choice'>
      for (const id of correct) if (!ids.includes(id)) issues.push(`ключ: варіанта «${id}» немає`)
      if (new Set(correct).size !== correct.length) issues.push('ключ: правильні варіанти повторюються')
      if (correct.length === ids.length) issues.push('ключ: усі варіанти правильні — завдання не перевіряє знання')
      break
    }
    case 'true_false': {
      const ids = (cv as TaskContent<'true_false'>).statements.map((s) => s.id)
      if (!sameSet(Object.keys((kv as TaskKey<'true_false'>).answers), ids))
        issues.push('ключ: відповіді мають бути рівно для всіх тверджень')
      break
    }
    case 'matching': {
      const { left, right } = cv as TaskContent<'matching'>
      const { pairs } = kv as TaskKey<'matching'>
      if (!sameSet(Object.keys(pairs), left.map((l) => l.id))) issues.push('ключ: пари мають бути для всіх елементів зліва')
      for (const r of Object.values(pairs)) if (!right.some((x) => x.id === r)) issues.push(`ключ: справа немає «${r}»`)
      break
    }
    case 'ordering': {
      const ids = (cv as TaskContent<'ordering'>).items.map((i) => i.id)
      if (!sameSet((kv as TaskKey<'ordering'>).correctOrder, ids)) issues.push('ключ: порядок має містити всі елементи по одному разу')
      break
    }
    case 'categorize': {
      const { cards, groups } = cv as TaskContent<'categorize'>
      const map = (kv as TaskKey<'categorize'>).groups
      if (!sameSet(Object.keys(map), cards.map((x) => x.id))) issues.push('ключ: групу треба вказати для кожної картки')
      for (const g of Object.values(map)) if (!groups.some((x) => x.id === g)) issues.push(`ключ: групи «${g}» немає`)
      break
    }
    case 'fill_blanks': {
      const fc = cv as TaskContent<'fill_blanks'>
      const { blanks } = kv as TaskKey<'fill_blanks'>
      const ids = blankIds(fc.text)
      if (!sameSet(Object.keys(blanks), ids)) issues.push('ключ: відповіді мають бути для всіх пропусків')
      if (fc.mode === 'select') {
        for (const id of ids) {
          const ok = blanks[id]?.some((a) => fc.options?.[id]?.includes(a))
          if (!ok) issues.push(`ключ: правильної відповіді для {{${id}}} немає серед варіантів`)
        }
      }
      break
    }
    case 'numeric':
      break
  }
  return issues
}
