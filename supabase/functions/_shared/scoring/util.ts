export const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Частка правильних елементів; порожній список — 0. */
export const share = (flags: boolean[]) => (flags.length ? flags.filter(Boolean).length / flags.length : 0)

/**
 * Порівняння введених слів: без регістру, крайніх і подвійних пробілів, з однаковим апострофом
 * (' ’ ` → ʼ) — щоб «Прип'ять» і «Припʼять» зараховувались однаково.
 */
export const normalizeText = (s: string) =>
  s
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/['’`]/g, 'ʼ')
    .toLocaleLowerCase('uk')
