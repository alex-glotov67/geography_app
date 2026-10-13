import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from '@/router'
import { cssVariablesResolver, theme } from '@/theme/mantine-theme'

const withMantine = (ui: ReactElement) => (
  <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver}>
    {ui}
  </MantineProvider>
)

/** Рендер компонента, якому потрібен контекст роутера (Link), без справжніх маршрутів. */
export async function renderWithRouter(ui: ReactElement) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  const result = render(withMantine(<RouterProvider router={router} />))
  await router.load()
  return { ...result, router }
}

/** Рендер застосунку за адресою — з усіма маршрутами. */
export async function renderApp(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createRouter({ routeTree, context: { queryClient }, history: createMemoryHistory({ initialEntries: [path] }) })
  await router.load()
  const result = render(
    withMantine(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  )
  return { ...result, router, queryClient }
}
