import { z } from 'zod'
import { Text } from '../common.ts'

/** 8. Обчислення з допуском (SPEC 7). Допуск — абсолютний, в одиницях відповіді. */
export const NumericContent = z.object({
  prompt: Text,
  unit: z.string().trim().max(16).optional(),
})
export const NumericKey = z.object({
  answer: z.number().finite(),
  tolerance: z.number().min(0).default(0),
})
export const NumericAnswer = z.object({ value: z.number().finite().nullable() })
