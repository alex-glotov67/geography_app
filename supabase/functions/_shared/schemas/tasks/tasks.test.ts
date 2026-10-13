import { keyIssues, TASK_SCHEMAS, TASK_TYPES, blankIds } from './index.ts'

const o = (...ids: string[]) => ids.map((id) => ({ id, text: id }))

/** Мінімальне коректне завдання кожного типу: зміст + ключ */
const VALID: Record<string, [unknown, unknown]> = {
  single_choice: [{ prompt: 'П', options: o('a', 'b', 'c') }, { correct: 'a' }],
  multiple_choice: [{ prompt: 'П', options: o('a', 'b', 'c') }, { correct: ['a', 'b'] }],
  true_false: [{ statements: o('s1', 's2') }, { answers: { s1: true, s2: false } }],
  matching: [{ prompt: 'П', left: o('l1', 'l2'), right: o('r1', 'r2', 'r3') }, { pairs: { l1: 'r1', l2: 'r2' } }],
  ordering: [{ prompt: 'П', items: o('a', 'b', 'c') }, { correctOrder: ['c', 'a', 'b'] }],
  categorize: [
    { prompt: 'П', groups: [{ id: 'g1', title: 'Г' }, { id: 'g2', title: 'Г2' }], cards: o('c1', 'c2') },
    { groups: { c1: 'g1', c2: 'g2' } },
  ],
  fill_blanks: [
    { text: 'А {{b1}} і {{b2}}', mode: 'select', options: { b1: ['x', 'y'], b2: ['z', 'w'] } },
    { blanks: { b1: ['x'], b2: ['w'] } },
  ],
  numeric: [{ prompt: 'П', unit: 'км' }, { answer: 5, tolerance: 0.5 }],
}

describe('схеми завдань (SPEC 7)', () => {
  it('реєстр містить усі 8 типів Фази 1', () => {
    expect(TASK_TYPES.sort()).toEqual(Object.keys(VALID).sort())
  })

  it.each(TASK_TYPES)('%s: коректне завдання без зауважень', (type) => {
    const [content, key] = VALID[type]!
    expect(keyIssues(type, content, key)).toEqual([])
  })

  it('значення за замовчуванням: перемішування, підрахунок пар, допуск', () => {
    expect(TASK_SCHEMAS.single_choice.content.parse(VALID.single_choice![0]).shuffle).toBe(true)
    expect(TASK_SCHEMAS.ordering.content.parse(VALID.ordering![0]).scoring).toBe('pairs')
    expect(TASK_SCHEMAS.numeric.key.parse({ answer: 1 }).tolerance).toBe(0)
  })

  it('ловить навмисні помилки ключа', () => {
    expect(keyIssues('single_choice', VALID.single_choice![0], { correct: 'z' })).toEqual(['ключ: варіанта «z» немає'])
    expect(keyIssues('multiple_choice', VALID.multiple_choice![0], { correct: ['a', 'a', 'b', 'c'] })).toContain('ключ: правильні варіанти повторюються')
    expect(keyIssues('multiple_choice', VALID.multiple_choice![0], { correct: ['a', 'b', 'c'] })).toContain('ключ: усі варіанти правильні — завдання не перевіряє знання')
    expect(keyIssues('true_false', VALID.true_false![0], { answers: { s1: true } })).toHaveLength(1)
    expect(keyIssues('matching', VALID.matching![0], { pairs: { l1: 'r9', l2: 'r1' } })).toEqual(['ключ: справа немає «r9»'])
    expect(keyIssues('ordering', VALID.ordering![0], { correctOrder: ['a', 'b', 'b'] })).toHaveLength(1)
    expect(keyIssues('categorize', VALID.categorize![0], { groups: { c1: 'g9' } })).toHaveLength(2)
    expect(keyIssues('fill_blanks', VALID.fill_blanks![0], { blanks: { b1: ['nope'], b2: ['w'] } })).toEqual([
      'ключ: правильної відповіді для {{b1}} немає серед варіантів',
    ])
  })

  it('ловить навмисні помилки змісту', () => {
    expect(keyIssues('single_choice', { prompt: 'П', options: o('a', 'a', 'b') }, { correct: 'a' })[0]).toMatch(/унікальні/)
    expect(keyIssues('single_choice', { prompt: '', options: o('a', 'b') }, { correct: 'a' }).length).toBeGreaterThanOrEqual(2)
    expect(keyIssues('fill_blanks', { text: 'без пропусків', mode: 'input' }, { blanks: {} })[0]).toMatch(/немає пропусків/)
    expect(keyIssues('fill_blanks', { text: '{{b1}} {{b1}}', mode: 'select' }, { blanks: { b1: ['x'] } })).toEqual(
      expect.arrayContaining([expect.stringMatching(/повторюються/), expect.stringMatching(/Немає варіантів/)]),
    )
    expect(keyIssues('numeric', { prompt: 'П' }, { answer: Number.NaN })[0]).toMatch(/^ключ\./)
  })

  it('blankIds — у порядку появи', () => {
    expect(blankIds('{{b2}} та {{b1}}')).toEqual(['b2', 'b1'])
  })
})
