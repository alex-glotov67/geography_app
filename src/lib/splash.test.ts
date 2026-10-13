import html from '../../index.html?raw'
import tokens from '../theme/tokens.css?raw'
import { hideSplashWhenReady } from './splash'

const token = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(tokens)?.[1]?.toLowerCase()
const splashVar = (name: string) => new RegExp(`--s-${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(html)?.[1]?.toLowerCase()

describe('splash в index.html (SPEC 13.7)', () => {
  it.each(['paper-tint', 'ink', 'ink-2', 'water', 'splash-track'])('колір --s-%s збігається з токеном', (name) => {
    expect(splashVar(name)).toBeDefined()
    expect(splashVar(name)).toBe(token(name))
  })

  it('завжди світлий: color-scheme light, тло на <html>, theme-color = --paper-tint', () => {
    expect(html).toMatch(/<meta name="color-scheme" content="light"/)
    expect(html).toMatch(/html\s*\{\s*background: var\(--s-paper-tint\)/)
    expect(html.match(/<meta name="theme-color" content="(#[0-9A-Fa-f]{6})"/)?.[1]?.toLowerCase()).toBe(token('paper-tint'))
    expect(html).not.toMatch(/prefers-color-scheme:\s*dark/)
  })

  it('без мережевих шрифтів, з межею 1,5 с і повагою до reduced motion', () => {
    const splash = html.slice(0, html.indexOf('<div id="root">'))
    expect(splash).not.toMatch(/fonts\.googleapis|@font-face|Golos|Unbounded/)
    expect(splash).toMatch(/1500 - performance\.now\(\)/)
    expect(splash).toMatch(/prefers-reduced-motion: reduce/)
  })
})

describe('hideSplashWhenReady', () => {
  afterEach(() => {
    delete window.__geoSplash
    vi.useRealTimers()
  })

  it('ховає splash не пізніше межі 1,5 с, навіть якщо шрифти не готові', async () => {
    vi.useFakeTimers()
    const hide = vi.fn()
    window.__geoSplash = { hide }
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise(() => {}) } })
    hideSplashWhenReady()
    await vi.advanceTimersByTimeAsync(1500)
    expect(hide).toHaveBeenCalledTimes(1)
  })

  it('ховає одразу після першого кадру, коли шрифти готові', async () => {
    const hide = vi.fn()
    window.__geoSplash = { hide }
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } })
    hideSplashWhenReady()
    await new Promise((r) => setTimeout(r, 50))
    expect(hide).toHaveBeenCalled()
  })
})
