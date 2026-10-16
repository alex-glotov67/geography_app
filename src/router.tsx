import type { EnsureQueryDataOptions, QueryClient, QueryKey } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  notFound,
  redirect,
} from '@tanstack/react-router'
import { currentMe, type Me } from '@/api/auth'
import { gradeLessonsQuery, lessonQuery } from '@/api/content'
import { LessonPageSkeleton } from '@/components/Skeletons'
import { GradePage, GradePageSkeleton } from '@/features/grade/GradePage'
import { HomePage } from '@/features/home/HomePage'
import { PracticePageSkeleton } from '@/features/lesson/PracticePageSkeleton'
import { ErrorPage } from '@/features/placeholder/ErrorPage'
import { PlaceholderPage } from '@/features/placeholder/PlaceholderPage'
import { TeacherPageSkeleton } from '@/features/teacher/TeacherSkeletons'
import { isGrade } from '@/lib/grades'
import { safeRedirect } from '@/lib/links'
import { LEVELS, type Level } from '@/lib/levels'
import { queryClient } from '@/queryClient'
import { Root } from './Root'

/*
 * Маршрути — history-режим, чисті адреси (SPEC 3.2): вони друкуються в QR і на картках входу.
 * SPA-fallback — wrangler.jsonc (not_found_handling). Дані — TanStack Query у loader-ах; поки
 * вантажиться — скелетон тієї ж форми (SPEC 13.7), сторінки уроку й тренування — окремі чанки.
 */

/**
 * Дані вже в кеші — повертаємо синхронно, тож роутер не показує pendingComponent і навігація без
 * миготіння; інакше — запит (скелетон, лише якщо він довший за defaultPendingMs).
 */
function cachedOrFetch<TData, TKey extends QueryKey>(
  qc: QueryClient,
  q: EnsureQueryDataOptions<TData, Error, TData, TKey>,
): TData | Promise<TData> {
  const cached = qc.getQueryData<TData>(q.queryKey)
  return cached !== undefined ? cached : qc.ensureQueryData(q)
}

export interface RouterContext {
  queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Root,
  notFoundComponent: () => <PlaceholderPage title="Сторінку не знайдено">Перевір адресу або повернися до вибору класу.</PlaceholderPage>,
  errorComponent: ErrorPage,
})

const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage })

const gradeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/grade/$grade',
  beforeLoad: ({ params }) => {
    if (!isGrade(Number(params.grade))) throw notFound()
  },
  // Дані в кеші — повертаємо одразу (без pending-скелетона); інакше чекаємо запит
  loader: ({ context, params }) => cachedOrFetch(context.queryClient, gradeLessonsQuery(Number(params.grade))),
  pendingComponent: function GradePending() {
    return <GradePageSkeleton grade={Number(gradeRoute.useParams().grade)} />
  },
  component: function GradeRouteComponent() {
    return <GradePage grade={Number(gradeRoute.useParams().grade)} />
  },
})

const lessonRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/lesson/$slug',
  loader: async ({ context, params }) => {
    const lesson = await cachedOrFetch(context.queryClient, lessonQuery(params.slug))
    // Список уроків розділу для бокової колонки на комп'ютері — не блокує показ уроку
    void context.queryClient.prefetchQuery(gradeLessonsQuery(lesson.snapshot.grade))
  },
  pendingComponent: LessonPageSkeleton,
  notFoundComponent: () => <PlaceholderPage title="Урок не знайдено">Можливо, адреса змінилась або урок ще не опубліковано.</PlaceholderPage>,
  component: lazyRouteComponent(() => import('@/features/lesson/LessonRoute'), 'LessonRoute'),
})

const practiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/lesson/$slug/practice',
  // ?level=base — тренування одного рівня (з блоку «Завдання» на сторінці уроку)
  validateSearch: (search: Record<string, unknown>): { level?: Level } =>
    LEVELS.includes(search.level as Level) ? { level: search.level as Level } : {},
  loader: ({ context, params }) => cachedOrFetch(context.queryClient, lessonQuery(params.slug)),
  pendingComponent: function PracticePending() {
    return <PracticePageSkeleton slug={practiceRoute.useParams().slug} />
  },
  notFoundComponent: () => <PlaceholderPage title="Урок не знайдено">Можливо, адреса змінилась або урок ще не опубліковано.</PlaceholderPage>,
  component: lazyRouteComponent(() => import('@/features/lesson/PracticeRoute'), 'PracticeRoute'),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  // ?login=8b-07 — з QR на картці входу; ?redirect=/t/… — повернення після входу (лише внутрішні адреси)
  validateSearch: (search: Record<string, unknown>): { login?: string; redirect?: string } => ({
    ...(typeof search.login === 'string' && /^[a-z0-9-]{1,20}$/.test(search.login) ? { login: search.login } : {}),
    ...(safeRedirect(search.redirect) ? { redirect: safeRedirect(search.redirect) } : {}),
  }),
  component: lazyRouteComponent(() => import('@/features/auth/LoginRoute'), 'LoginRoute'),
})

/** Вчитель або перенаправлення: гість — на вхід з поверненням, учень — у свій кабінет */
async function requireTeacher(href: string): Promise<{ me: Extract<Me, { kind: 'teacher' }> }> {
  const me = await currentMe()
  if (!me) throw redirect({ to: '/login', search: { redirect: href } })
  if (me.kind !== 'teacher') throw redirect({ to: me.kind === 'student' ? '/me' : '/' })
  return { me }
}

const teacherRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/t',
  beforeLoad: ({ location }) => requireTeacher(location.href),
  pendingComponent: () => <TeacherPageSkeleton standalone />,
  component: lazyRouteComponent(() => import('@/features/teacher/TeacherRoutes'), 'TeacherLayoutRoute'),
})

const teacherHomeRoute = createRoute({
  getParentRoute: () => teacherRoute,
  path: '/',
  component: lazyRouteComponent(() => import('@/features/teacher/TeacherRoutes'), 'TeacherHomeRoute'),
})

const classesRoute = createRoute({
  getParentRoute: () => teacherRoute,
  path: '/classes',
  component: lazyRouteComponent(() => import('@/features/teacher/TeacherRoutes'), 'ClassesRoute'),
})

const classRoute = createRoute({
  getParentRoute: () => teacherRoute,
  path: '/classes/$classId',
  // ?import=true — одразу відкрити майстер імпорту (кнопка «Імпортувати учнів» на огляді)
  validateSearch: (search: Record<string, unknown>): { import?: boolean } => (search.import === true || search.import === 'true' ? { import: true } : {}),
  component: lazyRouteComponent(() => import('@/features/teacher/TeacherRoutes'), 'ClassRoute'),
})

const lessonsRoute = createRoute({
  getParentRoute: () => teacherRoute,
  path: '/lessons',
  // ?grade=8 — вкладка класу (за замовчуванням 8 — пілот)
  validateSearch: (search: Record<string, unknown>): { grade: number } => ({
    grade: isGrade(Number(search.grade)) ? Number(search.grade) : 8,
  }),
  component: lazyRouteComponent(() => import('@/features/teacher/TeacherRoutes'), 'LessonsRoute'),
})

const builderLessonRoute = createRoute({
  getParentRoute: () => teacherRoute,
  path: '/lessons/$lessonId',
  component: lazyRouteComponent(() => import('@/features/teacher/TeacherRoutes'), 'LessonOverviewRoute'),
})

const outcomesRoute = createRoute({
  getParentRoute: () => teacherRoute,
  path: '/outcomes',
  component: lazyRouteComponent(() => import('@/features/teacher/TeacherRoutes'), 'OutcomesRoute'),
})

const settingsRoute = createRoute({
  getParentRoute: () => teacherRoute,
  path: '/settings',
  component: lazyRouteComponent(() => import('@/features/teacher/TeacherRoutes'), 'SettingsRoute'),
})

const meRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/me',
  beforeLoad: async ({ location }) => {
    const me = await currentMe()
    if (!me) throw redirect({ to: '/login', search: { redirect: location.href } })
    if (me.kind === 'teacher') throw redirect({ to: '/t' })
    if (me.kind !== 'student') throw redirect({ to: '/' })
    return { me }
  },
  component: lazyRouteComponent(() => import('@/features/auth/MeRoute'), 'MeRoute'),
})

const quizRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/quiz',
  component: () => <PlaceholderPage title="Живий квіз">Вхід за PIN-кодом з'явиться незабаром.</PlaceholderPage>,
})

export const routeTree = rootRoute.addChildren([
  homeRoute,
  gradeRoute,
  lessonRoute,
  practiceRoute,
  loginRoute,
  meRoute,
  quizRoute,
  teacherRoute.addChildren([teacherHomeRoute, classesRoute, classRoute, lessonsRoute, builderLessonRoute, outcomesRoute, settingsRoute]),
])

export { builderLessonRoute, classRoute, lessonRoute, lessonsRoute, loginRoute, meRoute, practiceRoute, teacherRoute }

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  // Дані з кешу TanStack Query — роутер свій кеш не тримає
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  // Скелетон з'являється, лише якщо дані йдуть довше 150 мс, і тримається ≥ 300 мс — без миготіння
  defaultPendingMs: 150,
  defaultPendingMinMs: 300,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
