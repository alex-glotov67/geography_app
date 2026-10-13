import { z } from 'zod'
import { Id, Text, uniqueIds } from '../common.ts'

/** 6. Розподіл карток за групами: «торкнись картки, потім групи»; часткові бали (SPEC 7). */
export const CategorizeContent = z.object({
  prompt: Text,
  groups: z.array(z.object({ id: Id, title: Text })).min(2).max(4).refine(uniqueIds, 'id груп мають бути унікальні'),
  cards: z.array(z.object({ id: Id, text: Text })).min(2).max(12).refine(uniqueIds, 'id карток мають бути унікальні'),
})
export const CategorizeKey = z.object({ groups: z.record(Id, Id) })
export const CategorizeAnswer = z.object({ groups: z.record(Id, Id.nullable()) })
