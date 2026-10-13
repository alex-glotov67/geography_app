import { lessonRoute } from '@/router'
import { LessonPage } from './LessonPage'

/** Окремий чанк (lazyRouteComponent): сторінка уроку з рушієм блоків */
export function LessonRoute() {
  return <LessonPage slug={lessonRoute.useParams().slug} />
}
