import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/*
 * Клієнт Supabase для браузера. Лише публічні значення (URL і anon key) з .env.local;
 * service role key у клієнт не потрапляє ніколи (CLAUDE.md, SPEC 2.2) — scripts/check-dist.ts це перевіряє.
 * Типи БД з'являться з `supabase gen types` разом із першими міграціями (Фаза 1).
 */
let client: SupabaseClient | undefined

export function getSupabase(): SupabaseClient {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('Не задано VITE_SUPABASE_URL або VITE_SUPABASE_ANON_KEY — див. .env.example і docs/setup.md')
  }
  client = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
  return client
}
