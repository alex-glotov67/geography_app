import { QueryClient } from '@tanstack/react-query'
import { isNotFound } from '@tanstack/react-router'

/**
 * Серверний стан — TanStack Query поверх supabase-js (SPEC 3.2). Слабкий інтернет: помірні повтори
 * мережевих збоїв. «Не знайдено» (notFound з loader-а) — це відповідь, а не збій: без повторів,
 * інакше неправильне посилання чи QR показує скелетон ще 6–8 с перед «Урок не знайдено».
 */
export const shouldRetry = (failureCount: number, error: unknown) => !isNotFound(error) && failureCount < 2

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
    },
  },
})
