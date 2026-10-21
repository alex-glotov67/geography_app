import { plainDoc } from '@shared/schemas/richtext.ts'
import { blockId, docToPlain, grSummary, lessonTaskIds, moveItem, newBlock, plainToDoc, toSaveFields, type LessonDraftState } from './draft'

const draft = (over: Partial<LessonDraftState> = {}): LessonDraftState => ({
  slug: 'g8-u05', grade: 8, sectionId: null, number: 5, title: 'Рельєф', textbookRef: null, ktpRef: null,
  blocks: [], homework: null, simplified: null, outcomeIds: [], ...over,
})

describe('чернетка уроку', () => {
  it('простий текст ↔ RichDoc: абзаци й переноси; форматований — не показується як простий', () => {
    const doc = plainToDoc('Перший абзац\nз переносом\n\nДругий')
    expect(docToPlain(doc)).toBe('Перший абзац\nз переносом\n\nДругий')
    expect(docToPlain(plainDoc('А', 'Б'))).toBe('А\n\nБ')
    expect(plainToDoc('')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
    expect(docToPlain({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ж', marks: [{ type: 'bold' }] }] }] })).toBeNull()
    expect(docToPlain({ type: 'doc', content: [{ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Н' }] }] })).toBeNull()
  })

  it('нові блоки й унікальні id', () => {
    const seq = [0, 0, 0.5]
    expect(blockId(['b000000'], () => seq.shift()!)).toBe('bi00000')
    expect(newBlock('goal', 'b1')).toMatchObject({ type: 'goal', items: ['', ''], simplified: true })
    expect(newBlock('table', 'b2')).toMatchObject({ columns: ['', ''], rows: [['', '']] })
  })

  it('поля для save_lesson: порожні підручник і КТП → null', () => {
    const f = toSaveFields(draft({ textbookRef: { paragraph: ' ', pages: '' }, ktpRef: '  ' }))
    expect(f).toMatchObject({ textbookRef: null, ktpRef: null, title: 'Рельєф', number: 5 })
    expect(toSaveFields(draft({ textbookRef: { paragraph: '12' } })).textbookRef).toEqual({ paragraph: '12' })
  })

  it('завдання уроку, переміщення, підсумок ГР', () => {
    const d = draft({
      blocks: [{ id: 'p', type: 'practice', simplified: true, taskIds: ['t1', 't2'] }],
      homework: { taskIds: ['t3'] },
      simplified: { homeworkTaskIds: ['t3', 't4'] },
    })
    expect(lessonTaskIds(d)).toEqual(['t1', 't2', 't3', 't4'])
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
    expect(grSummary(['ГР2', 'ГР1', 'ГР1'])).toBe('2 × ГР1, 1 × ГР2')
    expect(grSummary([])).toBe('')
  })
})
