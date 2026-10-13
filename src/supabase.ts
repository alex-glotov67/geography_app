import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/*
 * Клієнт Supabase для браузера. Лише публічні значення (URL і publishable key) з .env.local;
 * legacy anon key — запасний варіант для сумісності.
 * service role key у клієнт не потрапляє ніколи (CLAUDE.md, SPEC 2.2) — scripts/check-dist.ts це перевіряє.
 * Типи БД — src/types/database.types.ts (npm run db:types), не писати вручну.
 * Бібліотека вантажиться окремим чанком при першому запиті — головна сторінка без неї (SPEC 13.6).
 */
let client: Promise<SupabaseClient<Database>> | undefined

export function getSupabase(): Promise<SupabaseClient<Database>> {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Не задано VITE_SUPABASE_URL або VITE_SUPABASE_PUBLISHABLE_KEY — див. .env.example і docs/setup.md')
  }
  client = import('@supabase/supabase-js').then(({ createClient }) =>
    createClient<Database>(url, key, {
      auth: { persistSession: true, autoRefreshToken: true },
    }),
  )
  return client
}
