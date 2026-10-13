import { z } from 'zod'
import { Id, Text, uniqueIds } from '../common.ts'

/** 3. Серія тверджень «так / ні»; бали за кожне твердження (SPEC 7). */
export const TrueFalseContent = z.object({
  prompt: Text.default('Чи правильні твердження?'),
  statements: z
    .array(z.object({ id: Id, text: Text }))
    .min(1)
    .max(10)
    .refine(uniqueIds, 'id тверджень мають бути унікальні'),
})
export const TrueFalseKey = z.object({ answers: z.record(Id, z.boolean()) })
export const TrueFalseAnswer = z.object({ answers: z.record(Id, z.boolean()) })
