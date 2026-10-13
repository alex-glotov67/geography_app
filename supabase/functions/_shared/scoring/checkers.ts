import type { Checker } from './types.ts'
import { clamp01, normalizeText, share } from './util.ts'

export const singleChoice: Checker<'single_choice'> = (_c, key, answer) => {
  const correct = answer.selected === key.correct
  return { fraction: correct ? 1 : 0, details: { correct } }
}

/** Часткові бали: (влучні − зайві) / кількість правильних, не менше 0. */
export const multipleChoice: Checker<'multiple_choice'> = (content, key, answer) => {
  const selected = new Set(answer.selected)
  const right = new Set(key.correct)
  const hits = [...selected].filter((id) => right.has(id)).length
  const wrong = [...selected].filter((id) => !right.has(id)).length
  const items = Object.fromEntries(content.options.map((o) => [o.id, selected.has(o.id) === right.has(o.id)]))
  return { fraction: clamp01((hits - wrong) / right.size), details: { items } }
}

export const trueFalse: Checker<'true_false'> = (content, key, answer) => {
  const items = Object.fromEntries(content.statements.map((s) => [s.id, answer.answers[s.id] === key.answers[s.id]]))
  return { fraction: share(Object.values(items)), details: { items } }
}

export const matching: Checker<'matching'> = (content, key, answer) => {
  const items = Object.fromEntries(content.left.map((l) => [l.id, answer.pairs[l.id] === key.pairs[l.id]]))
  return { fraction: share(Object.values(items)), details: { items } }
}

/** `exact` — 1 лише за повністю правильний порядок; `pairs` — частка правильних сусідніх пар. */
export const ordering: Checker<'ordering'> = (content, key, answer) => {
  const order = answer.order
  const exact = order.length === key.correctOrder.length && order.every((id, i) => id === key.correctOrder[i])
  const total = key.correctOrder.length - 1
  let correctPairs = 0
  for (let i = 0; i < total; i++) {
    const at = order.indexOf(key.correctOrder[i]!)
    if (at >= 0 && order[at + 1] === key.correctOrder[i + 1]) correctPairs++
  }
  const fraction = content.scoring === 'exact' ? (exact ? 1 : 0) : correctPairs / total
  return { fraction, details: { exact, correctPairs, totalPairs: total } }
}

export const categorize: Checker<'categorize'> = (content, key, answer) => {
  const items = Object.fromEntries(content.cards.map((c) => [c.id, answer.groups[c.id] === key.groups[c.id]]))
  return { fraction: share(Object.values(items)), details: { items } }
}

export const fillBlanks: Checker<'fill_blanks'> = (_c, key, answer) => {
  const items = Object.fromEntries(
    Object.entries(key.blanks).map(([id, accepted]) => {
      const given = normalizeText(answer.blanks[id] ?? '')
      return [id, given !== '' && accepted.some((a) => normalizeText(a) === given)]
    }),
  )
  return { fraction: share(Object.values(items)), details: { items } }
}

/** Зворотний зв'язок пояснює напрям помилки: «замало / забагато» (SPEC 7). */
export const numeric: Checker<'numeric'> = (_c, key, answer) => {
  if (answer.value === null) return { fraction: 0, details: { correct: false, direction: null } }
  const diff = answer.value - key.answer
  const correct = Math.abs(diff) <= key.tolerance + 1e-9
  return {
    fraction: correct ? 1 : 0,
    details: { correct, direction: correct ? null : diff < 0 ? 'low' : 'high' },
  }
}
