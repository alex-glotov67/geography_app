import { LessonOverview } from '@/features/builder/LessonOverview'
import { LessonsPage } from '@/features/builder/LessonsPage'
import { OutcomesPage } from '@/features/builder/OutcomesPage'
import { builderLessonRoute, classRoute, lessonsRoute, teacherRoute } from '@/router'
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
  return <TeacherLayout me={teacherRoute.useRouteContext().me} />
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

export function LessonOverviewRoute() {
  const { lessonId } = builderLessonRoute.useParams()
  return <LessonOverview key={lessonId} me={teacherRoute.useRouteContext().me} lessonId={lessonId} />
}

export function OutcomesRoute() {
  return <OutcomesPage me={teacherRoute.useRouteContext().me} />
}

export function SettingsRoute() {
  return <SettingsPage me={teacherRoute.useRouteContext().me} />
}
