import { z } from 'zod'
import { Id, Option, Text, uniqueIds } from '../common.ts'

/** 1. Одна правильна відповідь з 3–5 (SPEC 7). */
export const SingleChoiceContent = z.object({
  prompt: Text,
  options: z.array(Option).min(3).max(5).refine(uniqueIds, 'id варіантів мають бути унікальні'),
  shuffle: z.boolean().default(true),
})
export const SingleChoiceKey = z.object({ correct: Id })
export const SingleChoiceAnswer = z.object({ selected: Id.nullable() })
