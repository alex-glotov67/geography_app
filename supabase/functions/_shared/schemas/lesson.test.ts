import { BLOCK_TYPES, Block, LessonDraft, LessonSnapshot, RichDoc, plainDoc } from './index.ts'

const draft = {
  slug: 'demo-relief',
  grade: 8,
  title: 'ДЕМО: рельєф',
  blocks: [
    { id: 'g', type: 'goal', items: ['Перше', 'Друге'] },
    { id: 't', type: 'text', doc: plainDoc('Абзац') },
    { id: 'p', type: 'practice', taskIds: ['task-1'] },
    { id: 'h', type: 'homework' },
  ],
  homework: { taskIds: ['task-2'] },
}

describe('урок і блоки (SPEC 6.1, 10.2)', () => {
  it('коректний урок; значення за замовчуванням', () => {
    const l = LessonDraft.parse(draft)
    expect(l.blocks[0]!.simplified).toBe(true)
    expect(l.quizPool).toEqual([])
    expect(l.outcomeCodes).toEqual([])
  })

  it('Фаза 1: 11 типів блоків, без map / chart / reflection', () => {
    expect(BLOCK_TYPES).toHaveLength(11)
    expect(BLOCK_TYPES).not.toContain('map')
  })

  it('дублікати id блоків і два блоки ДЗ — помилка', () => {
    const bad = { ...draft, blocks: [...draft.blocks, { id: 'g', type: 'homework' }] }
    const msgs = LessonDraft.safeParse(bad).error!.issues.map((i) => i.message)
    expect(msgs).toEqual(expect.arrayContaining(['id блоків мають бути унікальні', 'Блок ДЗ може бути лише один']))
  })

  it('slug і код результату — як у БД', () => {
    expect(LessonDraft.safeParse({ ...draft, slug: 'Урок 5' }).success).toBe(false)
    expect(LessonDraft.safeParse({ ...draft, outcomeCodes: ['8-2-3-07', '8-0-0-01'] }).success).toBe(true)
    expect(LessonDraft.safeParse({ ...draft, outcomeCodes: ['8-1-ГР2-03'] }).success).toBe(false)
    expect(LessonDraft.safeParse({ ...draft, outcomeCodes: ['8-2-3-7'] }).success).toBe(false)
  })

  it('таблиця даних — лише з джерелом і датою, рядки рівної довжини', () => {
    const table = { id: 'tb', type: 'table', columns: ['A', 'B'], rows: [['1', '2']] }
    expect(Block.safeParse(table).success).toBe(false)
    expect(Block.safeParse({ ...table, meta: { source: 'Держстат', asOf: '2024' } }).success).toBe(true)
    expect(Block.safeParse({ ...table, rows: [['1']], meta: { source: 'x', asOf: 'y' } }).success).toBe(false)
  })

  it('форматований текст: лише дозволені вузли, посилання лише http(s)', () => {
    const link = (href: string) => ({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'тут', marks: [{ type: 'link', attrs: { href } }] }] }],
    })
    expect(RichDoc.safeParse(link('https://uk.wikipedia.org')).success).toBe(true)
    expect(RichDoc.safeParse(link('javascript:alert(1)')).success).toBe(false)
    expect(RichDoc.safeParse({ type: 'doc', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'x' }] }] }).success).toBe(false)
    expect(RichDoc.safeParse({ type: 'doc', content: [{ type: 'html', text: '<script>' }] }).success).toBe(false)
    const list = { type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'пункт' }] }] }] }] }
    expect(RichDoc.safeParse(list).success).toBe(true)
  })

  it('знімок публікації: ДЗ — лише кількість', () => {
    const snap = {
      id: '40000000-0000-4000-8000-000000000001', slug: 'demo-relief', grade: 8, number: 5, title: 'Т',
      textbookRef: null, ktpRef: null, section: null, outcomes: [], blocks: draft.blocks,
      homework: { count: 1, taskIds: ['мають зникнути'] }, simplified: null,
    }
    expect(LessonSnapshot.parse(snap).homework).toEqual({ count: 1 })
  })
})
