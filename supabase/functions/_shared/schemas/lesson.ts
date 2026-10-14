import { z } from 'zod'
import { Grade, Text } from './common.ts'
import { Block, Ref } from './blocks.ts'
import { OutcomeCode } from './outcomes.ts'

/** Адреса уроку /lesson/<slug> (SPEC 6.1) — та сама перевірка, що й у БД. */
export const Slug = z.string().max(64).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Лише малі латинські літери, цифри й дефіси')

export const TextbookRef = z.object({ paragraph: Text.optional(), pages: Text.optional() })

const blockList = z.array(Block).superRefine((blocks, ctx) => {
  const ids = blocks.map((b) => b.id)
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'id блоків мають бути унікальні' })
  if (blocks.filter((b) => b.type === 'homework').length > 1)
    ctx.addIssue({ code: 'custom', message: 'Блок ДЗ може бути лише один' })
})

/** Урок у пакеті й робочій копії (SPEC 6.1). Посилання на завдання — Ref (uuid або локальний id пакета). */
export const LessonDraft = z.object({
  slug: Slug,
  grade: Grade,
  sectionNumber: z.number().int().min(1).optional(),
  number: z.number().int().min(1).optional(),
  title: Text,
  textbookRef: TextbookRef.optional(),
  ktpRef: Text.optional(),
  outcomeCodes: z.array(OutcomeCode).default([]),
  blocks: blockList,
  homework: z.object({ taskIds: z.array(Ref).min(1).max(12) }).nullable().default(null),
  simplified: z
    .object({ blocks: blockList.optional(), homeworkTaskIds: z.array(Ref).max(6).optional() })
    .nullable()
    .default(null),
  quizPool: z.array(Ref).max(20).default([]),
})
export type LessonDraft = z.infer<typeof LessonDraft>

/**
 * Знімок публікації — те, що читають гість і учень (lesson_versions.snapshot, SQL publish_lesson).
 * ДЗ — лише кількість завдань (SPEC 6.2).
 */
export const LessonSnapshot = z.object({
  id: z.uuid(),
  slug: Slug,
  grade: Grade,
  number: z.number().int().nullable(),
  title: Text,
  textbookRef: TextbookRef.nullable(),
  ktpRef: z.string().nullable(),
  section: z.object({ number: z.number().int(), title: Text }).nullable(),
  /** Результати уроку з довідника: розділ → тема → результат (SPEC 6.1) */
  outcomes: z.array(
    z.object({
      code: OutcomeCode,
      text: Text,
      section: z.object({ number: z.number().int(), title: Text }),
      topic: z.object({ number: z.number().int(), title: Text }),
    }),
  ),
  blocks: z.array(Block),
  homework: z.object({ count: z.number().int().min(0) }).nullable(),
  simplified: z.object({ blocks: z.array(Block).optional(), homeworkCount: z.number().int().min(0) }).nullable(),
})
export type LessonSnapshot = z.infer<typeof LessonSnapshot>
