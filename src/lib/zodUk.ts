import { z } from 'zod'

const ukLocale = z.locales.uk().localeError

/**
 * Помилки zod зрозуміло вчителю: «не заповнено», «потрібно щонайменше 2»; решта — українська
 * локаль zod. Для конструктора уроку й редактора завдань: schema.safeParse(v, { error: ukErrors }).
 */
export const ukErrors: z.core.$ZodErrorMap = (iss) => {
  if (iss.code === 'too_small' && iss.origin === 'string') return 'не заповнено'
  if (iss.code === 'too_small' && iss.origin === 'array') return `потрібно щонайменше ${iss.minimum}`
  if (iss.code === 'too_big' && iss.origin === 'array') return `не більше ${iss.maximum}`
  if (iss.code === 'too_small' && iss.origin === 'number') return `не менше ${iss.minimum}`
  if (iss.code === 'too_big' && iss.origin === 'number') return `не більше ${iss.maximum}`
  if (iss.code === 'invalid_type' && iss.input === undefined) return 'не заповнено'
  return ukLocale(iss)
}
