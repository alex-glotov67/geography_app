import { builderLessonRoute, builderPreviewRoute, teacherRoute } from '@/router'
import { BuilderPage } from './BuilderPage'
import { PreviewPage } from './PreviewPage'

/** Конструктор уроку й перегляд чернетки — окремий чанк: решта кабінету його не вантажить */
export function BuilderRoute() {
  const { lessonId } = builderLessonRoute.useParams()
  const { attach, slot } = builderLessonRoute.useSearch()
  return <BuilderPage key={lessonId} me={teacherRoute.useRouteContext().me} lessonId={lessonId} attach={attach} slot={slot} />
}

export function BuilderPreviewRoute() {
  const { lessonId } = builderPreviewRoute.useParams()
  return <PreviewPage key={lessonId} me={teacherRoute.useRouteContext().me} lessonId={lessonId} simplified={!!builderPreviewRoute.useSearch().simplified} />
}
