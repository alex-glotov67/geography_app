import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database.types.ts'

/** Демо-власник із supabase/seed.sql */
export const DEMO_TEACHER = '00000000-0000-4000-8000-0000000000a1'
export const DEMO_SCHOOL = '00000000-0000-4000-8000-000000000001'

/**
 * Сервісний клієнт ЛИШЕ для локального Supabase (CLI). Ключі беремо з `supabase status`; на будь-яку
 * не локальну адресу скрипт відмовляється працювати — на prod зміст створює вчитель (SPEC 2.1).
 */
export function localServiceClient() {
  const out = execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const status = JSON.parse(out.slice(out.indexOf('{'))) as Record<string, string>
  const url = status.API_URL!
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)) throw new Error(`Лише локальний Supabase, а не ${url}`)
  return createClient<Database>(url, status.SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
}
