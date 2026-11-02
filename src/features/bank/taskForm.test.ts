import { ukErrors } from '@/lib/zodUk'
import { fromRow, taskFormSchema, taskPrompt, toSavePayload, type TaskFormValues } from './taskForm'

const values = (over: Partial<TaskFormValues> = {}): TaskFormValues => ({
  type: 'single_choice', level: 'base', grp: 'ГР1', points: 1, visibility: 'open', grade: 8, hint: '', feedbackCorrect: '',
  feedbackIncorrect: 'Подивись на карту', content: {
    prompt: 'Яка форма рельєфу переважає?', shuffle: true,
    options: [{ id: 'a', text: 'Рівнини' }, { id: 'b', text: 'Гори' }, { id: 'c', text: 'Плато' }],
  }, key: { correct: 'a' }, ...over,
})

describe('форма завдання (SPEC 10.3)', () => {
  it('рядок БД → форма → payload save_task (теги, порожні підказки → null)', () => {
    const v = fromRow({
      type: 'numeric', level: 'high', grp: 'ГР3', points: 2, visibility: 'secure', tags: { grade: 9 }, hint: null,
      feedback: { incorrect: 'Перевір одиниці' }, content: { prompt: 'Скільки?' }, key: { answer: 5, tolerance: 0 },
    })
    expect(v).toMatchObject({ type: 'numeric', grade: 9, hint: '', feedbackIncorrect: 'Перевір одиниці', points: 2 })
    expect(toSavePayload(v)).toEqual({
      task: {
        type: 'numeric', level: 'high', grp: 'ГР3', points: 2, visibility: 'secure', tags: { grade: 9 }, content: { prompt: 'Скільки?' },
        hint: null, feedback: { incorrect: 'Перевір одиниці' }, printOverride: null,
      },
      key: { answer: 5, tolerance: 0 },
    })
    expect(toSavePayload(values({ grade: null, feedbackIncorrect: ' ' })).task).toMatchObject({ tags: {}, feedback: null })
  })

  it('схема типу: заповнене — без помилок; порожнє й неузгоджений ключ — помилки українською', () => {
    expect(taskFormSchema('single_choice').safeParse(values()).success).toBe(true)
    const bad = taskFormSchema('single_choice').safeParse(
      values({ content: { prompt: '', shuffle: true, options: [{ id: 'a', text: 'А' }] }, key: { correct: 'z' } }),
      { error: ukErrors },
    )
    expect(bad.success).toBe(false)
    const msgs = bad.error!.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    expect(msgs).toContain('content.prompt: не заповнено')
    expect(msgs).toContain('content.options: потрібно щонайменше 3')

    const wrongKey = taskFormSchema('single_choice').safeParse(values({ key: { correct: 'z' } }), { error: ukErrors })
    expect(wrongKey.error!.issues.map((i) => i.message)).toEqual(['варіанта «z» немає'])
    expect(taskFormSchema('numeric').safeParse(values({ type: 'numeric', points: 0.3, content: { prompt: 'X' }, key: { answer: 1, tolerance: 0 } }), { error: ukErrors }).error!.issues[0]!.message).toBe('кратне 0,5')
  })

  it('текст завдання для списку', () => {
    expect(taskPrompt({ prompt: '  Питання ' })).toBe('Питання')
    expect(taskPrompt({})).toBe('Без тексту')
    expect(taskPrompt({ prompt: 'Чи правильні твердження?', statements: [{ id: 'a', text: 'Карпати — гори' }] })).toBe('Чи правильні твердження? Карпати — гори')
    expect(taskPrompt({ mode: 'select', text: 'Найвища точка — {{b1}}.' })).toBe('Заповни пропуски: Найвища точка — ….')
  })
})
