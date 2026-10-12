import { QueryClient } from '@tanstack/react-query'

/** Серверний стан — TanStack Query поверх supabase-js (SPEC 3.2). Слабкий інтернет: помірні повтори. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})
