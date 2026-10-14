/** Українська множина: 1 завдання, 2–4 завдання, 5+ завдань (11–14 — завдань). */
export function plural(n: number, one: string, few: string, many: string) {
  const d = n % 10
  const dd = n % 100
  if (d === 1 && dd !== 11) return one
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return few
  return many
}

export const studentsWord = (n: number) => `${n} ${plural(n, 'учень', 'учні', 'учнів')}`

export const tasksWord = (n: number) => `${n} ${plural(n, 'завдання', 'завдання', 'завдань')}`
