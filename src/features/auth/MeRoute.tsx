import { meRoute } from '@/router'
import { MePage } from './MePage'

export function MeRoute() {
  const { me } = meRoute.useRouteContext()
  return <MePage me={me} />
}
