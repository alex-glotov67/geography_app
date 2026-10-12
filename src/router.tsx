import { Outlet, createRootRoute, createRoute, createRouter, notFound } from '@tanstack/react-router'
import { HomePage } from '@/features/home/HomePage'
import { PlaceholderPage } from '@/features/placeholder/PlaceholderPage'
import { isGrade } from '@/lib/grades'

/*
 * Маршрути — history-режим, чисті адреси (SPEC 3.2): вони друкуються в QR і на картках входу.
 * SPA-fallback на Cloudflare Pages — public/_redirects.
 * Фаза 0: головна + заглушки; екрани наповнюються у фазах 1–6.
 */

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: () => <PlaceholderPage title="Сторінку не знайдено">Перевір адресу або повернися до вибору класу.</PlaceholderPage>,
})

const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage })

const gradeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/grade/$grade',
  beforeLoad: ({ params }) => {
    if (!isGrade(Number(params.grade))) throw notFound()
  },
  component: function GradePage() {
    const { grade } = gradeRoute.useParams()
    return <PlaceholderPage title={`${grade} клас`}>Список уроків з'явиться незабаром.</PlaceholderPage>
  },
})

const lessonRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/lesson/$slug',
  component: () => <PlaceholderPage title="Урок">Сторінка уроку з'явиться незабаром.</PlaceholderPage>,
})

const practiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/lesson/$slug/practice',
  component: () => <PlaceholderPage title="Перевір себе">Тренування з'явиться незабаром.</PlaceholderPage>,
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

export const routeTree = rootRoute.addChildren([
  homeRoute,
  gradeRoute,
  lessonRoute,
  practiceRoute,
  loginRoute,
  quizRoute,
])

export const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
