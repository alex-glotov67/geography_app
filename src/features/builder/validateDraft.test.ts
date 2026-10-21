import { plainDoc } from '@shared/schemas/richtext.ts'
import type { BuilderLesson } from '@/api/builder'
import type { LessonDraftState } from './draft'
import { validateDraft } from './validateDraft'

const draft = (over: Partial<LessonDraftState> = {}): LessonDraftState => ({
  slug: 'g8-u05', grade: 8, sectionId: null, number: 5, title: 'Рельєф', textbookRef: null, ktpRef: null,
  blocks: [{ id: 'g1', type: 'goal', simplified: true, items: ['Перший пункт', 'Другий пункт'] }],
  homework: null, simplified: null, outcomeIds: ['o1'], ...over,
})
const noRefs: Pick<BuilderLesson, 'tasks' | 'media' | 'videos'> = { tasks: {}, media: {}, videos: {} }
const msgs = (r: { errors: { message: string }[] }) => r.errors.map((e) => e.message)

describe('перевірка перед публікацією (SPEC 10.1)', () => {
  it('заповнений урок — без помилок', () => {
    expect(validateDraft(draft(), noRefs).errors).toEqual([])
  })

  it('незаповнені блоки — помилки українською з назвою блоку й поля, з переходом до блоку', () => {
    const r = validateDraft(
      draft({
        title: '',
        blocks: [
          { id: 'g1', type: 'goal', simplified: true, items: ['Один'] },
          { id: 't1', type: 'text', simplified: true, doc: { type: 'doc', content: [{ type: 'paragraph' }] } },
          { id: 'tb', type: 'table', simplified: true, columns: ['А'], rows: [['1']], meta: { source: '', asOf: '2026' } },
        ],
      }),
      noRefs,
    )
    const m = msgs(r)
    expect(m.some((x) => x.startsWith('Про урок: тема'))).toBe(true)
    expect(m.some((x) => x.startsWith('Мета (блок 1): пункти'))).toBe(true)
    expect(m).toContain('Текст (блок 2): текст порожній')
    expect(m.some((x) => x.startsWith('Таблиця (блок 3): джерело'))).toBe(true)
    expect(r.errors.find((e) => e.message.startsWith('Мета'))!.blockId).toBe('g1')
  })

  it('TODO(teacher) в уроці чи завданні, незатверджене відео — помилки; без результатів — попередження', () => {
    const refs = {
      tasks: {
        t1: { id: 't1', type: 'single_choice', level: 'high', grp: 'ГР2', points: 1, visibility: 'open' as const,
          content: { prompt: 'TODO(teacher): питання', options: [{ id: 'a', text: 'А' }, { id: 'b', text: 'Б' }, { id: 'c', text: 'В' }] },
          key: { correct: 'a' }, hint: null, feedback: null, archived: false },
      },
      media: {},
      videos: { v1: { id: 'v1', youtubeId: 'abcdefghijk', title: 'Рельєф', channel: null, durationSec: null, startSec: null, endSec: null, approved: false } },
    }
    const r = validateDraft(
      draft({
        outcomeIds: [],
        blocks: [
          { id: 'x', type: 'text', simplified: true, doc: plainDoc('TODO(teacher): текст') },
          { id: 'p', type: 'practice', simplified: true, taskIds: ['t1'] },
          { id: 'v', type: 'video', simplified: true, videoId: 'v1' },
        ],
      }),
      refs,
    )
    expect(msgs(r)).toEqual(
      expect.arrayContaining([
        'В уроці лишилося TODO(teacher) — заповни перед публікацією',
        'У завданні уроку лишилося TODO(teacher) (single_choice)',
        'Відео «Рельєф» не позначене як перевірене — учні його не побачать',
      ]),
    )
    expect(r.warnings.map((w) => w.message)).toContain('Не обрано очікуваних результатів з довідника')
    expect(r.warnings.some((w) => w.message.includes('TODO'))).toBe(false)
  })

  it('посилання: захищене завдання в тренуванні, зображення без alt — той самий валідатор, що й імпорт', () => {
    const r = validateDraft(
      draft({
        blocks: [
          { id: 'p', type: 'practice', simplified: true, taskIds: ['s1'] },
          { id: 'i', type: 'image', simplified: true, mediaId: 'm1' },
        ],
      }),
      {
        tasks: {
          s1: { id: 's1', type: 'numeric', level: 'base', grp: 'ГР1', points: 1, visibility: 'secure', content: { prompt: 'Скільки?' },
            key: { answer: 1, tolerance: 0 }, hint: null, feedback: null, archived: false },
        },
        media: { m1: { id: 'm1', url: '', kind: 'image', alt: null, caption: null, source: 'Джерело', license: null, width: 1, height: 1 } },
        videos: {},
      },
    )
    expect(r.errors.find((e) => e.message.includes('захищене'))?.blockId).toBe('p')
    expect(msgs(r).some((m) => m.includes('alt'))).toBe(true)
    expect(r.warnings.some((w) => w.message.includes('ліцензію'))).toBe(true)
  })
})
