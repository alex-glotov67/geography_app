/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  /** Publishable key (`sb_publishable_…`) — основний публічний ключ. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Legacy anon key (JWT) — лише для сумісності, якщо publishable не задано. */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** '1' — лише збірка для e2e (npm run build:e2e) */
  readonly VITE_E2E_HOOKS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
