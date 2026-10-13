import { z } from 'zod'
import { Id, Option, Text, uniqueIds } from '../common.ts'

/** 2. Кілька правильних; часткові бали (SPEC 7). */
export const MultipleChoiceContent = z.object({
  prompt: Text,
  options: z.array(Option).min(3).max(8).refine(uniqueIds, 'id варіантів мають бути унікальні'),
  shuffle: z.boolean().default(true),
})
export const MultipleChoiceKey = z.object({ correct: z.array(Id).min(1) })
export const MultipleChoiceAnswer = z.object({ selected: z.array(Id) })
