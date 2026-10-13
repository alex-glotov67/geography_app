/**
 * Splash з index.html (SPEC 13.7) ховається, коли застосунок змонтовано і шрифти готові.
 * Межу 1,5 с від початку навігації тримає інлайн-скрипт у index.html — навіть якщо бандл ще вантажиться.
 */
declare global {
  interface Window {
    __geoSplash?: { hide: () => void }
  }
}

const MAX_MS = 1500

export function hideSplashWhenReady() {
  const left = Math.max(0, MAX_MS - performance.now())
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, left))
  // Застосунок уже змонтовано (виклик після render); чекаємо перший кадр і шрифти
  const ready = new Promise<void>((resolve) =>
    requestAnimationFrame(() => {
      void document.fonts.ready.then(() => resolve())
    }),
  )
  void Promise.race([ready, timeout]).then(() => window.__geoSplash?.hide())
}
