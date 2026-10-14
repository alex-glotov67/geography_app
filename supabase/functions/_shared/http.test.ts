import { bearer, errors, handler } from './http.ts'

const req = (method: string, headers: Record<string, string> = {}) => new Request('http://x/fn', { method, headers })

describe('http-обгортка функцій (SPEC 6.3)', () => {
  it('OPTIONS — CORS; не POST — 405', async () => {
    const h = handler(async () => new Response('ok'))
    expect((await h(req('OPTIONS'))).headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect((await h(req('GET'))).status).toBe(405)
  })

  it('HttpError → { error: { code, message } }; інша помилка → 500 без подробиць', async () => {
    const forbidden = await handler(async () => {
      throw errors.forbidden('Це не твій клас')
    })(req('POST'))
    expect(forbidden.status).toBe(403)
    expect(await forbidden.json()).toEqual({ error: { code: 'forbidden', message: 'Це не твій клас' } })

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const boom = await handler(async () => {
      throw new Error('секретна подробиця')
    })(req('POST'))
    expect(boom.status).toBe(500)
    expect(JSON.stringify(await boom.json())).not.toContain('секретна')
    spy.mockRestore()
  })

  it('Bearer-токен обов\'язковий', () => {
    expect(bearer(req('POST', { Authorization: 'Bearer abc' }))).toBe('abc')
    expect(() => bearer(req('POST'))).toThrow('Потрібно увійти')
  })
})
