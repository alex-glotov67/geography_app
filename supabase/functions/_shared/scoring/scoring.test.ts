import { check, normalizeText } from './index.ts'

const opts = (...ids: string[]) => ids.map((id) => ({ id, text: id.toUpperCase() }))

describe('single_choice', () => {
  const c = { prompt: 'П', options: opts('a', 'b', 'c'), shuffle: true }
  it('правильно — повний бал', () => {
    expect(check('single_choice', c, { correct: 'b' }, { selected: 'b' }, 2)).toMatchObject({ fraction: 1, score: 2, max: 2 })
  })
  it('неправильно або без відповіді — 0', () => {
    expect(check('single_choice', c, { correct: 'b' }, { selected: 'a' }).score).toBe(0)
    expect(check('single_choice', c, { correct: 'b' }, { selected: null }).details).toEqual({ correct: false })
  })
})

describe('multiple_choice', () => {
  const c = { prompt: 'П', options: opts('a', 'b', 'c', 'd'), shuffle: false }
  const key = { correct: ['a', 'b'] }
  it('усі правильні — 1', () => {
    expect(check('multiple_choice', c, key, { selected: ['b', 'a'] }).fraction).toBe(1)
  })
  it('половина — 0,5; бали округлюються до 0,1', () => {
    const r = check('multiple_choice', c, key, { selected: ['a'] }, 3)
    expect(r.fraction).toBe(0.5)
    expect(r.score).toBe(1.5)
    expect(r.details.items).toEqual({ a: true, b: false, c: true, d: true })
  })
  it('зайвий варіант знімає бал, але не нижче 0', () => {
    expect(check('multiple_choice', c, key, { selected: ['a', 'c'] }).fraction).toBe(0)
    expect(check('multiple_choice', c, key, { selected: ['c', 'd'] }).fraction).toBe(0)
  })
})

describe('true_false', () => {
  const c = { prompt: 'П', statements: [{ id: 's1', text: '1' }, { id: 's2', text: '2' }, { id: 's3', text: '3' }, { id: 's4', text: '4' }] }
  const key = { answers: { s1: true, s2: false, s3: true, s4: false } }
  it('бал за кожне твердження; без відповіді — неправильно', () => {
    const r = check('true_false', c, key, { answers: { s1: true, s2: true, s3: true } })
    expect(r.fraction).toBe(0.5)
    expect(r.details.items).toEqual({ s1: true, s2: false, s3: true, s4: false })
  })
})

describe('matching', () => {
  const c = { prompt: 'П', left: opts('l1', 'l2'), right: opts('r1', 'r2', 'r3') }
  it('часткові бали за пари', () => {
    expect(check('matching', c, { pairs: { l1: 'r1', l2: 'r2' } }, { pairs: { l1: 'r1', l2: 'r3' } }).fraction).toBe(0.5)
    expect(check('matching', c, { pairs: { l1: 'r1', l2: 'r2' } }, { pairs: { l1: null, l2: 'r2' } }).details.items).toEqual({ l1: false, l2: true })
  })
})

describe('ordering', () => {
  const items = opts('a', 'b', 'c', 'd')
  const key = { correctOrder: ['a', 'b', 'c', 'd'] }
  it('pairs: частка правильних сусідніх пар', () => {
    const r = check('ordering', { prompt: 'П', items, scoring: 'pairs' }, key, { order: ['a', 'b', 'd', 'c'] })
    expect(r.fraction).toBeCloseTo(1 / 3)
    expect(r.details).toEqual({ exact: false, correctPairs: 1, totalPairs: 3 })
  })
  it('pairs: правильний порядок — 1; елемента бракує — пара не рахується', () => {
    expect(check('ordering', { prompt: 'П', items, scoring: 'pairs' }, key, { order: ['a', 'b', 'c', 'd'] }).fraction).toBe(1)
    expect(check('ordering', { prompt: 'П', items, scoring: 'pairs' }, key, { order: ['b', 'c'] }).details.correctPairs).toBe(1)
  })
  it('без режиму: 4 елементи — exact, 5 — pairs', () => {
    expect(check('ordering', { prompt: 'П', items } as never, key, { order: ['a', 'b', 'd', 'c'] }).fraction).toBe(0)
    const five = [...items, { id: 'e', text: 'E' }]
    const r = check('ordering', { prompt: 'П', items: five } as never, { correctOrder: ['a', 'b', 'c', 'd', 'e'] }, { order: ['a', 'b', 'c', 'e', 'd'] })
    expect(r.fraction).toBe(0.5)
  })
  it('exact: бал лише за повністю правильний порядок', () => {
    const c = { prompt: 'П', items, scoring: 'exact' as const }
    expect(check('ordering', c, key, { order: ['a', 'b', 'c', 'd'] }).fraction).toBe(1)
    expect(check('ordering', c, key, { order: ['a', 'b', 'd', 'c'] }).fraction).toBe(0)
    expect(check('ordering', c, key, { order: ['a', 'b', 'c'] }).details.exact).toBe(false)
  })
})

describe('categorize', () => {
  const c = { prompt: 'П', groups: [{ id: 'g1', title: 'Г1' }, { id: 'g2', title: 'Г2' }], cards: opts('c1', 'c2', 'c3', 'c4') }
  it('часткові бали за картки; нерозподілена — неправильно', () => {
    const r = check('categorize', c, { groups: { c1: 'g1', c2: 'g1', c3: 'g2', c4: 'g2' } }, { groups: { c1: 'g1', c2: 'g2', c3: 'g2', c4: null } })
    expect(r.fraction).toBe(0.5)
  })
})

describe('fill_blanks', () => {
  const c = { prompt: 'П', text: 'Найвища — {{b1}}, річка — {{b2}}', mode: 'input' as const }
  const key = { blanks: { b1: ['Говерла'], b2: ["Прип'ять", 'Припять'] } }
  it('без регістру, пробілів і з будь-яким апострофом', () => {
    expect(check('fill_blanks', c, key, { blanks: { b1: '  говерла ', b2: 'ПРИПʼЯТЬ' } }).fraction).toBe(1)
  })
  it('порожній або відсутній пропуск — неправильно', () => {
    const r = check('fill_blanks', c, key, { blanks: { b1: '' } })
    expect(r.fraction).toBe(0)
    expect(r.details.items).toEqual({ b1: false, b2: false })
  })
})

describe('numeric', () => {
  const c = { prompt: 'П', unit: 'м' }
  it('у межах допуску — правильно, включно з межею', () => {
    expect(check('numeric', c, { answer: 2061, tolerance: 10 }, { value: 2071 }).fraction).toBe(1)
    expect(check('numeric', c, { answer: 0.3, tolerance: 0 }, { value: 0.1 + 0.2 }).fraction).toBe(1)
  })
  it('замало / забагато', () => {
    expect(check('numeric', c, { answer: 2061, tolerance: 10 }, { value: 2000 }).details).toEqual({ correct: false, direction: 'low' })
    expect(check('numeric', c, { answer: 2061, tolerance: 10 }, { value: 2100 }).details).toEqual({ correct: false, direction: 'high' })
  })
  it('без відповіді — 0 без напряму', () => {
    expect(check('numeric', c, { answer: 1, tolerance: 0 }, { value: null })).toMatchObject({ fraction: 0, details: { direction: null } })
  })
})

describe('normalizeText', () => {
  it('однаково зводить апострофи, регістр і пробіли', () => {
    expect(normalizeText(" Прип'ять  Річка ")).toBe(normalizeText('припʼять річка'))
    expect(normalizeText('Ґанок`')).toBe('ґанокʼ')
  })
})
