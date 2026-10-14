import { z } from 'zod'
import { UA_LETTERS } from '../accounts/index.ts'
import { Uuid } from './common.ts'

/**
 * Payload-и Edge Function manage-students (SPEC 5.1, 6.3). Одна схема — для клієнта (типи запиту
 * й відповіді) і функції (валідація). Паролі є лише у відповіді й показуються вчителю один раз.
 */

export const LastName = z.string().trim().min(1, 'Прізвище порожнє').max(60, 'Прізвище задовге')
export const FirstInitial = z
  .string()
  .trim()
  .regex(new RegExp(`^[${UA_LETTERS}A-Z]$`), 'Ініціал — одна велика літера')

export const NewStudent = z.object({
  lastName: LastName,
  firstInitial: FirstInitial,
  /** Учень з таким самим прізвищем та ініціалом уже є, і вчитель підтвердив, що це інша людина */
  allowSameName: z.boolean().optional(),
})
export type NewStudent = z.infer<typeof NewStudent>

const StudentIds = z.array(Uuid).min(1).max(60)

export const ManageStudentsRequest = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), classId: Uuid, students: z.array(NewStudent).min(1).max(60) }),
  z.object({ action: z.literal('reset-password'), studentIds: StudentIds }),
  z.object({ action: z.literal('archive'), studentIds: StudentIds }),
  z.object({ action: z.literal('unarchive'), studentIds: StudentIds }),
])
export type ManageStudentsRequest = z.infer<typeof ManageStudentsRequest>

/** Логін і пароль для показу й карток входу — лише в цій відповіді */
export const Credentials = z.object({
  id: Uuid,
  number: z.number().int(),
  displayName: z.string(),
  login: z.string(),
  password: z.string(),
})
export type Credentials = z.infer<typeof Credentials>

export const SkippedStudent = z.object({
  displayName: z.string(),
  /** same_name — такий учень уже є; login_taken — логін зайнятий; class_full — понад 99 учнів; archived — учень в архіві */
  reason: z.enum(['same_name', 'login_taken', 'class_full', 'archived']),
})
export type SkippedStudent = z.infer<typeof SkippedStudent>

export const ManageStudentsResponse = z.union([
  z.object({ credentials: z.array(Credentials), skipped: z.array(SkippedStudent) }), // create, reset-password
  z.object({ updated: z.number().int() }), // archive, unarchive
])
export type ManageStudentsResponse = z.infer<typeof ManageStudentsResponse>

/** Єдиний формат помилок функцій (SPEC 6.3) */
export const FunctionError = z.object({ error: z.object({ code: z.string(), message: z.string() }) })
export type FunctionError = z.infer<typeof FunctionError>
