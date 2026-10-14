import { useEffect } from 'react'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { create } from 'zustand'
import { loginToEmail } from '@shared/accounts/index.ts'
import { queryClient } from '@/queryClient'
import { useAnswers } from '@/stores/answers'
import { useCredentials } from '@/stores/credentials'
import { getSupabase } from '@/supabase'

/*
 * Сесія (SPEC 5): вчитель — email + пароль, учень — логін + пароль (адреса <логін>@students.invalid).
 * Сесію зберігає supabase-js у localStorage («учень лишається на пристрої»). Гість без збереженої
 * сесії не вантажить supabase-js на головній — перевіряємо лише наявність ключа.
 */

const hasStoredSession = () => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith('sb-') && k.endsWith('-auth-token')) return true
    }
  } catch {
    /* сховище недоступне — сесії немає */
  }
  return false
}

interface AuthState {
  /** undefined — ще не відомо; null — гість */
  userId: string | null | undefined
}
export const useAuth = create<AuthState>()(() => ({ userId: undefined }))

let subscribed: Promise<void> | undefined

/** Підписка на зміни сесії (вхід, вихід, оновлення токена, вихід в іншій вкладці) */
function subscribe() {
  subscribed ??= getSupabase().then(async (db) => {
    const { data } = await db.auth.getSession()
    useAuth.setState({ userId: data.session?.user.id ?? null })
    db.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id ?? null
      if (userId !== useAuth.getState().userId) {
        useAuth.setState({ userId })
        if (!userId) clearPrivate()
      }
    })
  })
  return subscribed
}

/** id користувача (null — гість). Без збереженої сесії — одразу, без завантаження supabase-js. */
export async function ensureAuth(): Promise<string | null> {
  const known = useAuth.getState().userId
  if (known !== undefined) return known
  if (!hasStoredSession()) {
    useAuth.setState({ userId: null })
    return null
  }
  await subscribe()
  return useAuth.getState().userId ?? null
}

export type Me =
  | {
      kind: 'teacher'
      id: string
      displayName: string
      loginPrefix: string
      studentsCanChangePassword: boolean
      schoolId: string
      schoolName: string
    }
  | { kind: 'student'; id: string; displayName: string; className: string; simplifiedMode: boolean }
  | { kind: 'none' }

/** Хто увійшов: вчитель, учень чи ні те, ні те (напр. учня архівовано) */
export const meQuery = (userId: string) =>
  queryOptions({
    queryKey: ['me', userId],
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Me> => {
      const db = await getSupabase()
      const t = await db
        .from('teachers')
        .select('id, display_name, login_prefix, students_can_change_password, school_id, schools(name)')
        .eq('id', userId)
        .maybeSingle()
      if (t.error) throw new Error(t.error.message)
      if (t.data) {
        return {
          kind: 'teacher',
          id: t.data.id,
          displayName: t.data.display_name,
          loginPrefix: t.data.login_prefix,
          studentsCanChangePassword: t.data.students_can_change_password,
          schoolId: t.data.school_id,
          schoolName: t.data.schools?.name ?? '',
        }
      }
      const s = await db
        .from('students')
        .select('id, display_name, simplified_mode, classes(name)')
        .eq('auth_user_id', userId)
        .maybeSingle()
      if (s.error) throw new Error(s.error.message)
      if (s.data) {
        return {
          kind: 'student',
          id: s.data.id,
          displayName: s.data.display_name ?? '',
          className: s.data.classes?.name ?? '',
          simplifiedMode: s.data.simplified_mode,
        }
      }
      return { kind: 'none' }
    },
  })

/**
 * Поточний користувач для компонентів: undefined — ще визначаємо, null — гість.
 * Гість без збереженої сесії не вантажить supabase-js.
 */
export function useMe(): Me | null | undefined {
  const userId = useAuth((s) => s.userId)
  useEffect(() => {
    void ensureAuth()
  }, [])
  const me = useQuery({ ...meQuery(userId ?? ''), enabled: !!userId })
  if (userId === undefined) return undefined
  if (userId === null) return null
  return me.data
}

/** Поточний користувач для route guards: null — гість */
export async function currentMe(): Promise<Me | null> {
  const userId = await ensureAuth()
  if (!userId) return null
  const cached = queryClient.getQueryData(meQuery(userId).queryKey)
  return cached ?? queryClient.fetchQuery(meQuery(userId))
}

export class LoginError extends Error {}

/** Повідомлення українською за кодом помилки Supabase Auth */
export function loginErrorMessage(e: { code?: string; status?: number; name?: string } | null): string {
  if (e?.code === 'invalid_credentials') return 'Неправильний логін або пароль'
  if (e?.code === 'user_banned') return 'Вхід вимкнено. Звернись до вчителя.'
  if (e?.status === 429 || e?.code === 'over_request_rate_limit') return 'Забагато спроб. Зачекай кілька хвилин і спробуй ще.'
  if (e?.name === 'AuthRetryableFetchError' || e?.status === 0) return 'Немає зв\'язку з сервером. Перевір інтернет і спробуй ще.'
  return 'Не вдалося увійти. Спробуй ще раз.'
}

export async function signIn(login: string, password: string): Promise<Me> {
  const db = await getSupabase()
  const { data, error } = await db.auth.signInWithPassword({ email: loginToEmail(login), password })
  if (error || !data.user) throw new LoginError(loginErrorMessage(error))
  // Інший користувач на тому самому пристрої — без даних попереднього
  if (useAuth.getState().userId && useAuth.getState().userId !== data.user.id) clearPrivate()
  void subscribe()
  useAuth.setState({ userId: data.user.id })
  const me = await queryClient.fetchQuery(meQuery(data.user.id))
  if (me.kind === 'none') {
    await db.auth.signOut({ scope: 'local' })
    useAuth.setState({ userId: null })
    throw new LoginError('Цей акаунт вимкнено. Звернись до вчителя.')
  }
  // Запит supabase-js лінивий — виконується лише з then(); помилка тут не заважає входу
  if (me.kind === 'student') void db.rpc('touch_last_login').then(({ error: e }) => e && console.warn('last_login_at:', e.message))
  return me
}

/** Приватні дані з пам'яті — після виходу (спільні шкільні комп'ютери) */
function clearPrivate() {
  queryClient.removeQueries({ queryKey: ['me'] })
  queryClient.removeQueries({ queryKey: ['t'] })
  useCredentials.getState().clearAll()
  useAnswers.getState().reset()
}

export async function signOut() {
  const db = await getSupabase()
  await db.auth.signOut({ scope: 'local' })
  useAuth.setState({ userId: null })
  clearPrivate()
}
