import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import './theme/mantine-styles'
import './theme/fonts.css'
import './theme/tokens.css'
import './theme/global.css'
import { cssVariablesResolver, theme } from './theme/mantine-theme'
import { queryClient } from './queryClient'
import { router } from './router'
import { hideSplashWhenReady } from './lib/splash'

const root = document.getElementById('root')
if (!root) throw new Error('Немає #root в index.html')

createRoot(root).render(
  <StrictMode>
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="light">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
)

hideSplashWhenReady()

// Лише у збірці для e2e (npm run build:e2e): доступ до кешу запитів, щоб імітувати інвалідацію.
// У звичайній збірці умова стала на етапі збірки — код вирізається; check:dist це перевіряє.
if (import.meta.env.VITE_E2E_HOOKS === '1') {
  ;(window as unknown as { __geoQueryClient: typeof queryClient }).__geoQueryClient = queryClient
}
