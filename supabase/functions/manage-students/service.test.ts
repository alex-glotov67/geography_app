import { PASSWORD_PATTERN } from '../_shared/accounts/index.ts'
import { HttpError } from '../_shared/http.ts'
import { manageStudents, type ClassRow, type Deps, type StudentRow } from './service.ts'

const T1 = 't1'
const CLASS: ClassRow = { id: 'c1', teacher_id: T1, school_id: 's1', login_prefix: '8b', archived: false }
const caller = { userId: T1, isAnonymous: false }

/** Підробка БД і Auth у пам'яті */
function fakeDeps(opts: { students?: StudentRow[]; takenEmails?: string[]; failInsert?: boolean } = {}) {
  const students = [...(opts.students ?? [])]
  const users = new Map<string, { email: string; password: string; banned: boolean }>()
  for (const e of opts.takenEmails ?? []) users.set(`taken-${e}`, { email: e, password: 'x', banned: false })
  const audit: { action: string; details: Record<string, unknown> }[] = []
  const classes = new Map([[CLASS.id, CLASS], ['c2', { ...CLASS, id: 'c2', teacher_id: 't2' }]])
  const deps: Deps = {
    getTeacher: async (id) => (id === T1 || id === 't2' ? { id, login_prefix: '' } : null),
    getClass: async (id) => classes.get(id) ?? null,
    classStudents: async (id) => students.filter((s) => s.class_id === id),
    studentsByIds: async (ids) => students.filter((s) => ids.includes(s.id)),
    createAuthUser: async (email, password) => {
      if ([...users.values()].some((u) => u.email === email)) return 'exists'
      const id = `u${users.size + 1}`
      users.set(id, { email, password, banned: false })
      return { id }
    },
    deleteAuthUser: async (id) => void users.delete(id),
    setPassword: async (id, password) => void (users.get(id)!.password = password),
    setBanned: async (id, banned) => void (users.get(id)!.banned = banned),
    insertStudent: async (row) => {
      if (opts.failInsert) throw new Error('insert failed')
      const s: StudentRow = {
        id: `st${students.length + 1}`, class_id: row.class_id, auth_user_id: row.auth_user_id, number: row.number,
        display_name: `${row.last_name} ${row.first_initial}.`, name_key: `${row.last_name.toLowerCase()} ${row.first_initial.toLowerCase()}`,
        login: row.login, archived: false,
      }
      students.push(s)
      return s
    },
    setArchived: async (ids, archived) => students.forEach((s) => ids.includes(s.id) && (s.archived = archived)),
    audit: async (_t, action, details) => void audit.push({ action, details }),
  }
  return { deps, students, users, audit }
}

const existing = (n: number, last: string, init: string, extra: Partial<StudentRow> = {}): StudentRow => ({
  id: `e${n}`, class_id: 'c1', auth_user_id: `eu${n}`, number: n, display_name: `${last} ${init}.`,
  name_key: `${last.toLowerCase()} ${init.toLowerCase()}`, login: `8b-0${n}`, archived: false, ...extra,
})

const fails = async (p: Promise<unknown>, code: string) => {
  const e = await p.catch((x: unknown) => x)
  expect(e).toBeInstanceOf(HttpError)
  expect((e as HttpError).code).toBe(code)
}

describe('manage-students: create', () => {
  it('створює акаунти з наступними номерами; дублікат імені пропускає; пароль лише у відповіді', async () => {
    const f = fakeDeps({ students: [existing(1, 'Коваль', 'О')] })
    const r = await manageStudents(f.deps, caller, {
      action: 'create', classId: 'c1',
      students: [
        { lastName: 'МЕЛЬНИК', firstInitial: 'І' },
        { lastName: 'коваль', firstInitial: 'О' },
        { lastName: 'Коваль', firstInitial: 'О', allowSameName: true },
      ],
    })
    if (!('credentials' in r)) throw new Error('очікувались credentials')
    expect(r.credentials.map((c) => [c.number, c.login, c.displayName])).toEqual([
      [2, '8b-02', 'Мельник І.'],
      [3, '8b-03', 'Коваль О.'],
    ])
    expect(r.credentials.every((c) => PASSWORD_PATTERN.test(c.password))).toBe(true)
    expect(r.skipped).toEqual([{ displayName: 'Коваль О.', reason: 'same_name' }])
    expect([...f.users.values()].map((u) => u.email)).toEqual(['8b-02@students.invalid', '8b-03@students.invalid'])
    expect(f.audit).toEqual([{ action: 'students.create', details: { classId: 'c1', created: ['8b-02', '8b-03'], skipped: 1 } }])
    expect(JSON.stringify(f.audit)).not.toContain(r.credentials[0]!.password)
  })

  it('зайнятий логін пропускає номер і йде далі', async () => {
    const f = fakeDeps({ takenEmails: ['8b-01@students.invalid'] })
    const r = await manageStudents(f.deps, caller, {
      action: 'create', classId: 'c1', students: [{ lastName: 'А', firstInitial: 'А' }, { lastName: 'Б', firstInitial: 'Б' }],
    })
    if (!('credentials' in r)) throw new Error()
    expect(r.skipped).toEqual([{ displayName: 'А А.', reason: 'login_taken' }])
    expect(r.credentials.map((c) => c.login)).toEqual(['8b-02'])
  })

  it('понад 99 учнів — class_full', async () => {
    const f = fakeDeps({ students: [existing(99, 'Я', 'Я')] })
    const r = await manageStudents(f.deps, caller, { action: 'create', classId: 'c1', students: [{ lastName: 'Б', firstInitial: 'Б' }] })
    expect('skipped' in r && r.skipped[0]!.reason).toBe('class_full')
  })

  it('невдала вставка рядка прибирає щойно створений акаунт Auth', async () => {
    const f = fakeDeps({ failInsert: true })
    await expect(
      manageStudents(f.deps, caller, { action: 'create', classId: 'c1', students: [{ lastName: 'А', firstInitial: 'А' }] }),
    ).rejects.toThrow('insert failed')
    expect(f.users.size).toBe(0)
  })

  it('доступ: лише вчитель цього класу, не анонім, не архівований клас', async () => {
    const f = fakeDeps()
    const req = { action: 'create' as const, classId: 'c2', students: [{ lastName: 'А', firstInitial: 'А' }] }
    await fails(manageStudents(f.deps, caller, req), 'forbidden')
    await fails(manageStudents(f.deps, { userId: 'student', isAnonymous: false }, req), 'forbidden')
    await fails(manageStudents(f.deps, { userId: T1, isAnonymous: true }, req), 'forbidden')
    await fails(manageStudents(f.deps, caller, { ...req, classId: 'nope' }), 'forbidden')
    const g = fakeDeps()
    ;(await g.deps.getClass('c1'))!.archived = true
    await fails(manageStudents(g.deps, caller, { ...req, classId: 'c1' }), 'bad_request')
    CLASS.archived = false
  })
})

describe('manage-students: новий пароль і архів', () => {
  it('новий пароль — лише активним учням, у порядку списку; старий більше не діє', async () => {
    const f = fakeDeps({ students: [existing(2, 'Б', 'Б'), existing(1, 'А', 'А'), existing(3, 'В', 'В', { archived: true })] })
    for (const s of f.students) f.users.set(s.auth_user_id!, { email: s.login, password: 'old', banned: false })
    const r = await manageStudents(f.deps, caller, { action: 'reset-password', studentIds: ['e2', 'e1', 'e3'] })
    if (!('credentials' in r)) throw new Error()
    expect(r.credentials.map((c) => c.login)).toEqual(['8b-01', '8b-02'])
    expect(r.skipped).toEqual([{ displayName: 'В В.', reason: 'archived' }])
    expect(f.users.get('eu1')!.password).toBe(r.credentials[0]!.password)
    expect(f.audit[0]!.action).toBe('students.reset_password')
  })

  it('архів вимикає вхід, повернення — вмикає; повторна дія нічого не змінює', async () => {
    const f = fakeDeps({ students: [existing(1, 'А', 'А')] })
    f.users.set('eu1', { email: '8b-01', password: 'x', banned: false })
    expect(await manageStudents(f.deps, caller, { action: 'archive', studentIds: ['e1'] })).toEqual({ updated: 1 })
    expect(f.users.get('eu1')!.banned).toBe(true)
    expect(f.students[0]!.archived).toBe(true)
    expect(await manageStudents(f.deps, caller, { action: 'archive', studentIds: ['e1'] })).toEqual({ updated: 0 })
    expect(await manageStudents(f.deps, caller, { action: 'unarchive', studentIds: ['e1'] })).toEqual({ updated: 1 })
    expect(f.users.get('eu1')!.banned).toBe(false)
  })

  it('чужі чи неіснуючі учні — помилка на весь запит', async () => {
    const f = fakeDeps({ students: [existing(1, 'А', 'А'), { ...existing(2, 'Б', 'Б'), class_id: 'c2' }] })
    await fails(manageStudents(f.deps, caller, { action: 'archive', studentIds: ['e1', 'e2'] }), 'forbidden')
    await fails(manageStudents(f.deps, caller, { action: 'reset-password', studentIds: ['e1', 'nope'] }), 'not_found')
    expect(f.students[0]!.archived).toBe(false)
  })
})
