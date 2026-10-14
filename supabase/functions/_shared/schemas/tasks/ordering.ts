import { z } from 'zod'
import { Id, Text, uniqueIds } from '../common.ts'

/**
 * Режим підрахунку упорядкування: явний `scoring` або за замовчуванням — `exact` для ≤ 4 елементів
 * (короткий ряд оцінюємо цілком), `pairs` від 5 (частка правильних сусідніх пар).
 */
export const orderingMode = (c: { items: readonly unknown[]; scoring?: 'exact' | 'pairs' }) =>
  c.scoring ?? (c.items.length <= 4 ? 'exact' : 'pairs')

/**
 * 5. Упорядкування; кнопки «вище / нижче», перетягування — Фаза 3 (SPEC 7).
 * `scoring`: `exact` — бал лише за повністю правильний порядок; `pairs` — частка правильних
 * сусідніх пар (так само рахує квіз, SPEC 9.2). Не задано — за orderingMode.
 */
export const OrderingContent = z
  .object({
    prompt: Text,
    items: z.array(z.object({ id: Id, text: Text })).min(3).max(8).refine(uniqueIds, 'id мають бути унікальні'),
    scoring: z.enum(['exact', 'pairs']).optional(),
  })
  .transform((c) => ({ ...c, scoring: orderingMode(c) }))
export const OrderingKey = z.object({ correctOrder: z.array(Id).min(3) })
export const OrderingAnswer = z.object({ order: z.array(Id) })
