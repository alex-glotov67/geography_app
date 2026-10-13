import { z } from 'zod'
import { Id, Text, uniqueIds } from '../common.ts'

const Side = z.array(z.object({ id: Id, text: Text })).refine(uniqueIds, 'id мають бути унікальні')

/**
 * 4. Відповідність: кожному елементу зліва — один справа. Справа можуть бути зайві варіанти.
 * На телефоні — рядок з варіантами-кнопками, на комп'ютері ще й перетягування (SPEC 7).
 */
export const MatchingContent = z.object({
  prompt: Text,
  left: Side.min(2).max(8),
  right: Side.min(2).max(10),
})
export const MatchingKey = z.object({ pairs: z.record(Id, Id) })
export const MatchingAnswer = z.object({ pairs: z.record(Id, Id.nullable()) })
