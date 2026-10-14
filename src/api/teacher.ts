import { queryOptions } from '@tanstack/react-query'
import { classLoginPrefix } from '@shared/accounts/index.ts'
import {
  FunctionError,
  type ManageStudentsRequest,
  type ManageStudentsResponse,
} from '@shared/schemas/students.ts'
import { getSupabase } from '@/supabase'

/*
 * Кабінет вчителя (SPEC 8.2): класи, учні, налаштування. Читання — напряму з таблиць (RLS дає
 * лише свої класи); акаунти учнів — лише через Edge Function manage-students.
 * Ключі запитів починаються з 't' — після виходу їх прибирає api/auth.ts.
 */

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

/** Навчальний рік за датою: з 1 серпня — новий (2026-2027) */
export function currentSchoolYear(now = new Date()): string {
  const y = now.getFullYear()
  return now.getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

export interface ClassItem {
  id: string
  name: string
  grade: number
  schoolYear: string
  loginPrefix: string
  archived: boolean
  studentCount: number
}

export interface StudentItem {
  id: string
  number: number
  lastName: string
  firstInitial: string
  displayName: string
  nameKey: string
  login: string
  simplifiedMode: boolean
  archived: boolean
  lastLoginAt: string | null
}

const POLICY = { staleTime: 60_000, refetchOnWindowFocus: false } as const

export const classesQuery = () =>
  queryOptions({
    ...POLICY,
    queryKey: ['t', 'classes'],
    queryFn: async (): Promise<ClassItem[]> => {
      const db = await getSupabase()
      const { data, error } = await db
        .from('classes')
        .select('id, name, grade, school_year, login_prefix, archived, students(count)')
        .eq('students.archived', false)
        .order('school_year', { ascending: false })
        .order('name')
      fail(error)
      return (data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        grade: c.grade,
        schoolYear: c.school_year,
        loginPrefix: c.login_prefix,
        archived: c.archived,
        studentCount: c.students[0]?.count ?? 0,
      }))
    },
  })

export const classStudentsQuery = (classId: string) =>
  queryOptions({
    ...POLICY,
    queryKey: ['t', 'students', classId],
    queryFn: async (): Promise<StudentItem[]> => {
      const db = await getSupabase()
      const { data, error } = await db
        .from('students')
        .select('id, number, last_name, first_initial, display_name, name_key, login, simplified_mode, archived, last_login_at')
        .eq('class_id', classId)
        .order('number')
      fail(error)
      return (data ?? []).map((s) => ({
        id: s.id,
        number: s.number,
        lastName: s.last_name,
        firstInitial: s.first_initial,
        displayName: s.display_name ?? `${s.last_name} ${s.first_initial}.`,
        nameKey: s.name_key ?? '',
        login: s.login,
        simplifiedMode: s.simplified_mode,
        archived: s.archived,
        lastLoginAt: s.last_login_at,
      }))
    },
  })

export async function createClass(name: string, schoolYear = currentSchoolYear()): Promise<string> {
  const db = await getSupabase()
  const { data, error } = await db
    .from('classes')
    .insert({ name, grade: Number(name[0]), school_year: schoolYear, login_prefix: classLoginPrefix(name) })
    .select('id')
    .single()
  if (error?.code === '23505') throw new Error(`Клас ${name} на ${schoolYear} уже є`)
  fail(error)
  return data!.id
}

export async function setSimplified(studentId: string, simplifiedMode: boolean) {
  const db = await getSupabase()
  const { error } = await db.from('students').update({ simplified_mode: simplifiedMode }).eq('id', studentId)
  fail(error)
}

export interface TeacherSettings {
  schoolName: string
  loginPrefix: string
  studentsCanChangePassword: boolean
}

export async function saveSettings(teacherId: string, schoolId: string, s: TeacherSettings) {
  const db = await getSupabase()
  const t = await db
    .from('teachers')
    .update({ login_prefix: s.loginPrefix, students_can_change_password: s.studentsCanChangePassword })
    .eq('id', teacherId)
  fail(t.error)
  const sc = await db.from('schools').update({ name: s.schoolName }).eq('id', schoolId)
  fail(sc.error)
}

/** Виклик manage-students; помилка функції → Error з українським повідомленням */
export async function manageStudents(req: ManageStudentsRequest): Promise<ManageStudentsResponse> {
  const db = await getSupabase()
  const { data, error } = await db.functions.invoke<ManageStudentsResponse>('manage-students', { body: req })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const body = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null
    const parsed = FunctionError.safeParse(body)
    throw new Error(parsed.success ? parsed.data.error.message : 'Немає зв\'язку з сервером. Спробуй ще раз.')
  }
  return data!
}
