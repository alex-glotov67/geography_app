import {
  generatePassword,
  nameKey,
  normalizeLastName,
  studentEmail,
  studentLogin,
} from '../_shared/accounts/index.ts'
import { errors } from '../_shared/http.ts'
import type {
  Credentials,
  ManageStudentsRequest,
  ManageStudentsResponse,
  NewStudent,
  SkippedStudent,
} from '../_shared/schemas/students.ts'

/**
 * Логіка manage-students (SPEC 5.1, 6.3) без Deno й supabase-js: доступ до БД і Auth — через
 * інтерфейс Deps (у функції — сервісний клієнт, у тестах — підробка). Пароль у відкритому
 * вигляді лише повертається у відповіді, ніде не зберігається й не потрапляє в журнал.
 */

export interface ClassRow {
  id: string
  teacher_id: string
  school_id: string
  login_prefix: string
  archived: boolean
}
export interface StudentRow {
  id: string
  class_id: string
  auth_user_id: string | null
  number: number
  display_name: string
  name_key: string
  login: string
  archived: boolean
}
export interface InsertStudent {
  class_id: string
  school_id: string
  auth_user_id: string
  number: number
  last_name: string
  first_initial: string
  login: string
}

export interface Deps {
  /** Вчитель за id користувача Auth (null — не вчитель) */
  getTeacher(userId: string): Promise<{ id: string; login_prefix: string } | null>
  getClass(classId: string): Promise<ClassRow | null>
  classStudents(classId: string): Promise<StudentRow[]>
  studentsByIds(ids: string[]): Promise<StudentRow[]>
  /** 'exists' — така адреса вже зайнята (логін використано раніше) */
  createAuthUser(email: string, password: string): Promise<{ id: string } | 'exists'>
  deleteAuthUser(id: string): Promise<void>
  setPassword(authUserId: string, password: string): Promise<void>
  /** Вимкнути (true) чи повернути (false) вхід */
  setBanned(authUserId: string, banned: boolean): Promise<void>
  insertStudent(row: InsertStudent): Promise<StudentRow>
  setArchived(ids: string[], archived: boolean): Promise<void>
  audit(teacherId: string, action: string, details: Record<string, unknown>): Promise<void>
}

export interface Caller {
  userId: string
  isAnonymous: boolean
}

async function requireTeacher(deps: Deps, caller: Caller) {
  if (caller.isAnonymous) throw errors.forbidden()
  const teacher = await deps.getTeacher(caller.userId)
  if (!teacher) throw errors.forbidden('Лише для вчителя')
  return teacher
}

/** Учні з чужих класів чи неіснуючі id — помилка на весь запит, нічого не змінюється */
async function ownStudents(deps: Deps, teacherId: string, ids: string[]): Promise<StudentRow[]> {
  const rows = await deps.studentsByIds(ids)
  if (rows.length !== new Set(ids).size) throw errors.notFound('Когось з учнів не знайдено')
  const classIds = [...new Set(rows.map((r) => r.class_id))]
  for (const id of classIds) {
    const c = await deps.getClass(id)
    if (!c || c.teacher_id !== teacherId) throw errors.forbidden('Це не твій клас')
  }
  return rows
}

export async function manageStudents(deps: Deps, caller: Caller, req: ManageStudentsRequest): Promise<ManageStudentsResponse> {
  const teacher = await requireTeacher(deps, caller)

  switch (req.action) {
    case 'create': {
      const cls = await deps.getClass(req.classId)
      if (!cls || cls.teacher_id !== teacher.id) throw errors.forbidden('Це не твій клас')
      if (cls.archived) throw errors.badRequest('Клас в архіві')
      return create(deps, teacher, cls, req.students)
    }
    case 'reset-password': {
      const rows = await ownStudents(deps, teacher.id, req.studentIds)
      const credentials: Credentials[] = []
      const skipped: SkippedStudent[] = []
      for (const s of rows) {
        if (!s.auth_user_id || s.archived) {
          skipped.push({ displayName: s.display_name, reason: 'archived' })
          continue
        }
        const password = generatePassword()
        await deps.setPassword(s.auth_user_id, password)
        credentials.push({ id: s.id, number: s.number, displayName: s.display_name, login: s.login, password })
      }
      await deps.audit(teacher.id, 'students.reset_password', { studentIds: credentials.map((c) => c.id) })
      return { credentials: credentials.sort((a, b) => a.number - b.number), skipped }
    }
    case 'archive':
    case 'unarchive': {
      const archived = req.action === 'archive'
      const rows = (await ownStudents(deps, teacher.id, req.studentIds)).filter((s) => s.archived !== archived)
      for (const s of rows) if (s.auth_user_id) await deps.setBanned(s.auth_user_id, archived)
      if (rows.length) await deps.setArchived(rows.map((s) => s.id), archived)
      await deps.audit(teacher.id, archived ? 'students.archive' : 'students.unarchive', { studentIds: rows.map((s) => s.id) })
      return { updated: rows.length }
    }
  }
}

async function create(
  deps: Deps,
  teacher: { id: string; login_prefix: string },
  cls: ClassRow,
  students: NewStudent[],
): Promise<ManageStudentsResponse> {
  const existing = await deps.classStudents(cls.id)
  const names = new Set(existing.map((s) => s.name_key))
  let next = existing.reduce((m, s) => Math.max(m, s.number), 0) + 1
  const credentials: Credentials[] = []
  const skipped: SkippedStudent[] = []

  for (const raw of students) {
    const lastName = normalizeLastName(raw.lastName)
    const firstInitial = raw.firstInitial
    const key = nameKey(lastName, firstInitial)
    const displayName = `${lastName} ${firstInitial}.`
    // Повторний імпорт не дублює учнів (SPEC 5.2); однакові імена — лише з підтвердженням вчителя
    if (names.has(key) && !raw.allowSameName) {
      skipped.push({ displayName, reason: 'same_name' })
      continue
    }
    if (next > 99) {
      skipped.push({ displayName, reason: 'class_full' })
      continue
    }
    const number = next
    const login = studentLogin(cls.login_prefix, number, teacher.login_prefix)
    const password = generatePassword()
    const user = await deps.createAuthUser(studentEmail(login), password)
    if (user === 'exists') {
      // Логін лишився від учня минулого року чи іншого класу з тим самим префіксом
      skipped.push({ displayName, reason: 'login_taken' })
      next++
      continue
    }
    try {
      const row = await deps.insertStudent({
        class_id: cls.id, school_id: cls.school_id, auth_user_id: user.id, number, last_name: lastName, first_initial: firstInitial, login,
      })
      credentials.push({ id: row.id, number, displayName: row.display_name, login, password })
      names.add(key)
      next++
    } catch (e) {
      // Без рядка в students акаунт Auth не потрібен — прибираємо, щоб не лишався «сиротою»
      await deps.deleteAuthUser(user.id)
      throw e
    }
  }

  await deps.audit(teacher.id, 'students.create', {
    classId: cls.id,
    created: credentials.map((c) => c.login),
    skipped: skipped.length,
  })
  return { credentials, skipped }
}
