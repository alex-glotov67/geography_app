import type { QueryClient } from '@tanstack/react-query'
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  notFound,
} from '@tanstack/react-router'
import { gradeLessonsQuery, lessonQuery } from '@/api/content'
import { LessonPageSkeleton } from '@/components/Skeletons'
import { GradePage, GradePageSkeleton } from '@/features/grade/GradePage'
import { HomePage } from '@/features/home/HomePage'
import { PracticePageSkeleton } from '@/features/lesson/PracticePageSkeleton'
import { ErrorPage } from '@/features/placeholder/ErrorPage'
import { PlaceholderPage } from '@/features/placeholder/PlaceholderPage'
import { isGrade } from '@/lib/grades'
import { LEVELS, type Level } from '@/lib/levels'
import { queryClient } from '@/queryClient'

/*
 * Маршрути — history-режим, чисті адреси (SPEC 3.2): вони друкуються в QR і на картках входу.
 * SPA-fallback — wrangler.jsonc (not_found_handling). Дані — TanStack Query у loader-ах; поки
 * вантажиться — скелетон тієї ж форми (SPEC 13.7), сторінки уроку й тренування — окремі чанки.
 */

export interface RouterContext {
  queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
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
  loader: ({ context, params }) => context.queryClient.ensureQueryData(gradeLessonsQuery(Number(params.grade))),
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
    const lesson = await context.queryClient.ensureQueryData(lessonQuery(params.slug))
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
  loader: ({ context, params }) => context.queryClient.ensureQueryData(lessonQuery(params.slug)),
  pendingComponent: function PracticePending() {
    return <PracticePageSkeleton slug={practiceRoute.useParams().slug} />
  },
  notFoundComponent: () => <PlaceholderPage title="Урок не знайдено">Можливо, адреса змінилась або урок ще не опубліковано.</PlaceholderPage>,
  component: lazyRouteComponent(() => import('@/features/lesson/PracticeRoute'), 'PracticeRoute'),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: () => <PlaceholderPage title="Вхід">Вхід з логіном від вчителя з'явиться незабаром.</PlaceholderPage>,
})

const quizRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/quiz',
  component: () => <PlaceholderPage title="Живий квіз">Вхід за PIN-кодом з'явиться незабаром.</PlaceholderPage>,
})

export const routeTree = rootRoute.addChildren([homeRoute, gradeRoute, lessonRoute, practiceRoute, loginRoute, quizRoute])

export { lessonRoute, practiceRoute }

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
