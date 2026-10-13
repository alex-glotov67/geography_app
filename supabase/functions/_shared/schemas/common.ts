import { z } from 'zod'

/** Спільні типи змісту (SPEC 6.1). Ці самі схеми — для рендеру, імпорту, конструктора й функцій. */

export const Id = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, 'Лише латиниця, цифри, - і _')
export const Uuid = z.uuid()

export const Level = z.enum(['base', 'middle', 'sufficient', 'high'])
export type Level = z.infer<typeof Level>

export const Group = z.enum(['ГР1', 'ГР2', 'ГР3'])
export type Group = z.infer<typeof Group>

export const Grade = z.union([z.literal(6), z.literal(7), z.literal(8), z.literal(9)])
export type Grade = z.infer<typeof Grade>

export const Text = z.string().trim().min(1)

/** Числовий факт у змісті: кожне число — з джерелом і датою актуальності (CLAUDE.md, SPEC 2.1). */
export const SourceMeta = z.object({
  source: Text,
  asOf: Text,
})

/** Варіант відповіді / елемент списку. `id` — стабільний, незалежний від порядку показу. */
export const Option = z.object({
  id: Id,
  text: Text,
  mediaId: Uuid.optional(),
})
export type Option = z.infer<typeof Option>

/** Унікальні id у списку — помилка валідації з назвою поля. */
export const uniqueIds = <T extends { id: string }>(items: T[]) => new Set(items.map((i) => i.id)).size === items.length

export const Feedback = z.object({
  correct: Text.optional(),
  incorrect: Text.optional(),
})
