import { z } from 'zod'
import { Id, Text } from '../common.ts'

const BLANK = /\{\{(b\d+)\}\}/g

/** Id пропусків у тексті в порядку появи: «Найвища точка — {{b1}}» → ['b1'] */
export const blankIds = (text: string) => [...text.matchAll(BLANK)].map((m) => m[1]!)

/**
 * 7. Пропуски в тексті: `{{b1}}`, `{{b2}}`… (SPEC 7, 17). `select` — вибір зі списку (варіанти
 * видимі в змісті); `input` — введення, порівняння без регістру й зайвих пробілів, кілька
 * допустимих написань у ключі.
 */
export const FillBlanksContent = z
  .object({
    prompt: Text.default('Заповни пропуски'),
    text: Text,
    mode: z.enum(['select', 'input']),
    options: z.record(Id, z.array(Text).min(2)).optional(),
  })
  .superRefine((c, ctx) => {
    const ids = blankIds(c.text)
    if (ids.length === 0) ctx.addIssue({ code: 'custom', message: 'У тексті немає пропусків {{bN}}', path: ['text'] })
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Пропуски {{bN}} повторюються', path: ['text'] })
    if (c.mode === 'select') {
      for (const id of ids) {
        if (!c.options?.[id]) ctx.addIssue({ code: 'custom', message: `Немає варіантів для {{${id}}}`, path: ['options', id] })
      }
    }
  })
export const FillBlanksKey = z.object({ blanks: z.record(Id, z.array(Text).min(1)) })
export const FillBlanksAnswer = z.object({ blanks: z.record(Id, z.string()) })
