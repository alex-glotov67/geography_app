import { useState } from 'react'

/** Тасування Фішера–Єйтса з детермінованим зерном (однаковий порядок у межах показу). */
export function shuffled<T>(items: readonly T[], seed: number): T[] {
  const a = [...items]
  let s = seed || 1
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** Порядок фіксується на час життя компонента: варіанти не «стрибають» між рендерами. */
export function useShuffled<T>(items: readonly T[], enabled = true): T[] {
  const [seed] = useState(() => Math.floor(Math.random() * 1e9))
  return enabled ? shuffled(items, seed) : [...items]
}
