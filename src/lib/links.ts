/** Куди повернутися після входу: лише внутрішня адреса (не «//інший-сайт», не повна URL) */
export const safeRedirect = (to: unknown): string | undefined =>
  typeof to === 'string' && to.startsWith('/') && !to.startsWith('//') ? to : undefined

/** Адреса з QR на картці входу: сторінка входу з підставленим логіном (SPEC 5.1) */
export const loginUrl = (login: string, origin = window.location.origin) => `${origin}/login?login=${encodeURIComponent(login)}`
