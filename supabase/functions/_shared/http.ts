/**
 * Допоміжне для Edge Functions (SPEC 6.3): CORS, відповіді JSON і єдиний формат помилок
 * `{ error: { code, message } }` українською. Без залежностей від Deno — тестується у Vitest.
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export const errors = {
  unauthorized: () => new HttpError(401, 'unauthorized', 'Потрібно увійти'),
  forbidden: (message = 'Немає доступу') => new HttpError(403, 'forbidden', message),
  badRequest: (message: string) => new HttpError(400, 'bad_request', message),
  notFound: (message: string) => new HttpError(404, 'not_found', message),
}

/** Обгортка обробника: OPTIONS для CORS, лише POST, HttpError → JSON, решта → 500 без подробиць */
export function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return json({ error: { code: 'method_not_allowed', message: 'Лише POST' } }, 405)
    try {
      return await fn(req)
    } catch (e) {
      if (e instanceof HttpError) return json({ error: { code: e.code, message: e.message } }, e.status)
      console.error(e)
      return json({ error: { code: 'internal', message: 'Помилка сервера. Спробуй ще раз.' } }, 500)
    }
  }
}

/** Токен користувача з заголовка Authorization: Bearer … */
export function bearer(req: Request): string {
  const h = req.headers.get('Authorization') ?? ''
  const m = /^Bearer\s+(.+)$/i.exec(h)
  if (!m) throw errors.unauthorized()
  return m[1]!
}
