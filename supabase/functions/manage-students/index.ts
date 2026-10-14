// Edge Function manage-students (SPEC 5.1, 6.3): акаунти учнів — створення, новий пароль, архів.
// Викликає лише вчитель цього класу. Сервісний ключ — тільки тут (змінна середовища функції),
// у клієнт не потрапляє. Логіка — service.ts (тести у Vitest), тут лише доступ до БД і Auth.
import { createClient } from '@supabase/supabase-js'
import { bearer, errors, handler, json } from '../_shared/http.ts'
import { ManageStudentsRequest } from '../_shared/schemas/students.ts'
import { manageStudents, type Deps, type StudentRow } from './service.ts'

const url = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

const STUDENT_COLUMNS = 'id, class_id, auth_user_id, number, display_name, name_key, login, archived'
/** «Назавжди» для вимкнення входу архівованого учня (~100 років) */
const BAN_FOREVER = '876000h'

const must = <T>(r: { data: T; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

const deps: Deps = {
  getTeacher: async (id) => must(await admin.from('teachers').select('id, login_prefix').eq('id', id).maybeSingle()),
  getClass: async (id) =>
    must(await admin.from('classes').select('id, teacher_id, school_id, login_prefix, archived').eq('id', id).maybeSingle()),
  classStudents: async (classId) =>
    must(await admin.from('students').select(STUDENT_COLUMNS).eq('class_id', classId)) as StudentRow[],
  studentsByIds: async (ids) => must(await admin.from('students').select(STUDENT_COLUMNS).in('id', ids)) as StudentRow[],
  createAuthUser: async (email, password) => {
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, app_metadata: { role: 'student' },
    })
    if (error) {
      if (error.code === 'email_exists' || error.status === 422) return 'exists'
      throw error
    }
    return { id: data.user.id }
  },
  deleteAuthUser: async (id) => {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) throw error
  },
  setPassword: async (id, password) => {
    const { error } = await admin.auth.admin.updateUserById(id, { password })
    if (error) throw error
  },
  setBanned: async (id, banned) => {
    const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: banned ? BAN_FOREVER : 'none' })
    if (error) throw error
  },
  insertStudent: async (row) =>
    must(await admin.from('students').insert(row).select(STUDENT_COLUMNS).single()) as StudentRow,
  setArchived: async (ids, archived) => {
    must(await admin.from('students').update({ archived }).in('id', ids))
  },
  audit: async (teacherId, action, details) => {
    must(await admin.from('audit_log').insert({ teacher_id: teacherId, action, details }))
  },
}

Deno.serve(
  handler(async (req) => {
    const { data, error } = await admin.auth.getUser(bearer(req))
    if (error || !data.user) throw errors.unauthorized()
    const body = ManageStudentsRequest.safeParse(await req.json().catch(() => null))
    if (!body.success) throw errors.badRequest('Некоректний запит')
    const result = await manageStudents(deps, { userId: data.user.id, isAnonymous: !!data.user.is_anonymous }, body.data)
    return json(result)
  }),
)
