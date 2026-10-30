import { z } from 'zod'
import { Grade, Text } from './common.ts'

/**
 * Довідник очікуваних результатів програми (SPEC 6.1, 10.6): розділ → тема → результат.
 * Код: клас-розділ-тема-номер, напр. 8-2-3-07; вступ — розділ 0, тема 0. ГР — не тут, а тег завдань.
 */
export const OUTCOME_CODE = /^([6-9])-(\d+)-(\d+)-(\d{2,})$/
export const OutcomeCode = z.string().regex(OUTCOME_CODE, 'Код результату виду 8-2-3-07 (клас-розділ-тема-номер)')

/** Номер розділу чи теми: ціле ≥ 0 (0 — вступ) */
const Num = z.coerce.number().int('ціле число').min(0, 'від 0 (0 — вступ)')

/** Поля рядка довідника — ті самі правила для імпорту й ручного редагування (pick) */
export const OutcomeFields = z.object({
  code: OutcomeCode.nullable(),
  grade: z.coerce.number().pipe(Grade),
  sectionNumber: Num,
  sectionTitle: Text,
  topicNumber: Num,
  topicTitle: Text,
  text: Text,
  source: Text,
})

/** Один рядок CSV після розбору (назви стовпців — у src/lib/outcomes.ts) */
export const OutcomeRow = OutcomeFields.superRefine((r, ctx) => {
    const m = r.code ? OUTCOME_CODE.exec(r.code) : null
    if (m && (Number(m[1]) !== r.grade || Number(m[2]) !== r.sectionNumber || Number(m[3]) !== r.topicNumber)) {
      ctx.addIssue({ code: 'custom', path: ['code'], message: `Код ${r.code} не відповідає класу, розділу або темі рядка` })
    }
  })
export type OutcomeRow = z.infer<typeof OutcomeRow>
