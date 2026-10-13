import { z } from 'zod'
import { Id, Text, uniqueIds } from '../common.ts'

/**
 * 5. Упорядкування; кнопки «вище / нижче» + перетягування (SPEC 7).
 * `scoring`: `exact` — бал лише за повністю правильний порядок; `pairs` — частка правильних
 * сусідніх пар (так само рахує квіз, SPEC 9.2).
 */
export const OrderingContent = z.object({
  prompt: Text,
  items: z.array(z.object({ id: Id, text: Text })).min(3).max(8).refine(uniqueIds, 'id мають бути унікальні'),
  scoring: z.enum(['exact', 'pairs']).default('pairs'),
})
export const OrderingKey = z.object({ correctOrder: z.array(Id).min(3) })
export const OrderingAnswer = z.object({ order: z.array(Id) })
