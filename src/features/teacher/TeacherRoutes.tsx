import { Outlet, useMatches } from '@tanstack/react-router'
import { BuilderPage } from '@/features/builder/BuilderPage'
import { LessonsPage } from '@/features/builder/LessonsPage'
import { OutcomesPage } from '@/features/builder/OutcomesPage'
import { PreviewPage } from '@/features/builder/PreviewPage'
import { builderLessonRoute, builderPreviewRoute, classRoute, lessonsRoute, teacherRoute } from '@/router'
import { ClassesPage } from './ClassesPage'
import { ClassPage } from './ClassPage'
import { SettingsPage } from './SettingsPage'
import { TeacherHome } from './TeacherHome'
import { TeacherLayout } from './TeacherLayout'

/*
 * Кабінет вчителя — окремий чанк (lazyRouteComponent у router.tsx): учні й гості його не вантажать.
 * Хто увійшов — з контексту маршруту /t (beforeLoad перевіряє, що це вчитель).
 */

export function TeacherLayoutRoute() {
  // Конструктор і перегляд чернетки — на весь екран, без меню кабінету (макет LessonBuilder)
  const bare = useMatches({ select: (ms) => ms.some((m) => m.routeId === builderLessonRoute.id || m.routeId === builderPreviewRoute.id) })
  const { me } = teacherRoute.useRouteContext()
  return bare ? <Outlet /> : <TeacherLayout me={me} />
}

export function TeacherHomeRoute() {
  return <TeacherHome />
}

export function ClassesRoute() {
  return <ClassesPage />
}

export function ClassRoute() {
  const { classId } = classRoute.useParams()
  const { import: openImport } = classRoute.useSearch()
  // key: інший клас — чистий стан майстра й підтверджень
  return <ClassPage key={classId} classId={classId} me={teacherRoute.useRouteContext().me} openImport={!!openImport} />
}

export function LessonsRoute() {
  return <LessonsPage me={teacherRoute.useRouteContext().me} grade={lessonsRoute.useSearch().grade} />
}

export function BuilderRoute() {
  const { lessonId } = builderLessonRoute.useParams()
  return <BuilderPage key={lessonId} me={teacherRoute.useRouteContext().me} lessonId={lessonId} />
}

export function BuilderPreviewRoute() {
  const { lessonId } = builderPreviewRoute.useParams()
  return <PreviewPage key={lessonId} me={teacherRoute.useRouteContext().me} lessonId={lessonId} simplified={!!builderPreviewRoute.useSearch().simplified} />
}

export function OutcomesRoute() {
  return <OutcomesPage me={teacherRoute.useRouteContext().me} />
}

export function SettingsRoute() {
  return <SettingsPage me={teacherRoute.useRouteContext().me} />
}
