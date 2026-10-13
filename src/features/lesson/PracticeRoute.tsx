import { practiceRoute } from '@/router'
import { PracticePage } from './PracticePage'

/** Окремий чанк (lazyRouteComponent): тренування з рушієм завдань */
export function PracticeRoute() {
  const { slug } = practiceRoute.useParams()
  const { level } = practiceRoute.useSearch()
  return <PracticePage slug={slug} level={level} />
}
