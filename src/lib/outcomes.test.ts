import demoCsv from '../../seed/demo-outcomes.csv?raw'
import { parseOutcomes, planOutcomes, type ExistingOutcome, type ExistingTopic } from './outcomes'

const csv = (s: string) => new TextEncoder().encode(s)
const HEAD = 'Код;Клас;№ розділу;Назва розділу;№ теми;Назва теми;Результат;Джерело\n'

describe('довідник програми: розділ → тема → результат (SPEC 10.6)', () => {
  it('демо-файл у новому форматі — без помилок, з позначкою ДЕМО', () => {
    const { rows, errors } = parseOutcomes(csv(demoCsv))
    expect(errors).toEqual([])
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.text.startsWith('ДЕМО'))).toBe(true)
  })

  it('вступ — розділ 0, тема 0; порожні рядки пропускаються; «Код» необов\'язковий', () => {
    const { rows, errors } = parseOutcomes(
      csv(HEAD + '8-0-0-01;8;0;Вступ;0;Вступ;Результат вступу;Д\n;;;;;;;\n;8;2;Розділ;3;Тема;Без коду;Д\n'),
    )
    expect(errors).toEqual([])
    expect(rows.map((r) => [r.line, r.code, r.sectionNumber, r.topicNumber])).toEqual([
      [2, '8-0-0-01', 0, 0],
      [4, null, 2, 3],
    ])
  })

  it('помилки з номерами рядків', () => {
    const { errors } = parseOutcomes(
      csv(
        HEAD +
          ';5;1;Р;1;Т;Текст;Д\n' + //            2: клас
          ';8;1;Розділ А;1;Тема;Текст;\n' + //    3: джерело
          ';8;2;Розділ Б;1;Тема 1;Т;Д\n' + //     4
          ';8;2;Розділ В;2;Тема 2;Т2;Д\n' + //    5: інша назва розділу
          ';8;2;Розділ Б;1;Тема інша;Т3;Д\n' + // 6: інша назва теми
          ';8;2;Розділ Б;1;Тема 1;  т ;Д\n' + //  7: дубль результату
          ';8;-1;Р;x;Т;Т;Д\n', //                  8: номери
      ),
    )
    expect(errors.map((e) => e.line)).toEqual([2, 3, 5, 6, 7, 8])
    expect(errors[0]!.message).toMatch(/«Клас»/)
    expect(errors[1]!.message).toMatch(/«Джерело»: не заповнено/)
    expect(errors[2]!.message).toMatch(/Розділ 2 .* іншу назву в рядку 4/)
    expect(errors[3]!.message).toMatch(/Тема 1 розділу 2 уже має іншу назву в рядку 4/)
    expect(errors[4]!.message).toMatch(/уже є в рядку 4/)
    expect(errors[5]!.message).toMatch(/№ розділу.*№ теми|№ теми.*№ розділу/)
  })

  it('немає обов\'язкових стовпців; старий формат з «ГР» — зрозуміла помилка', () => {
    expect(parseOutcomes(csv('Клас;№ розділу\n8;1\n')).errors[0]!.message).toMatch(/№ теми/)
    const old = 'Код;Клас;№ розділу;Назва розділу;№ теми;Назва теми;ГР;Результат;Джерело\n'
    expect(parseOutcomes(csv(old)).errors[0]!.message).toMatch(/«ГР» більше не потрібен/)
  })

  it('код: формат клас-розділ-тема-номер, відповідність рядку, дублікати', () => {
    const { errors } = parseOutcomes(
      csv(HEAD + '8-1-ГР1-01;8;1;Р;1;Т;А;Д\n8-2-1-01;8;1;Р;1;Т;Б;Д\n8-1-1-01;8;1;Р;1;Т;В;Д\n8-1-1-01;8;1;Р;1;Т;Г;Д\n'),
    )
    expect(errors.map((e) => [e.line, e.message.slice(0, 16)])).toEqual([
      [2, '«Код»: Код резул'],
      [3, 'Код 8-2-1-01 не '],
      [5, 'Код 8-1-1-01 уже'],
    ])
  })

  it('план: нові розділи й теми, коди в межах теми, повторний імпорт без дублів', () => {
    const first = parseOutcomes(csv(HEAD + ';8;1;Розділ;2;Тема;Перший;Д\n;8;1;Розділ;2;Тема;Другий;Д\n;8;1;Розділ;3;Інша;Третій;Д\n'))
    const p1 = planOutcomes(first.rows, [], [], [])
    expect(p1.sections.create).toEqual([{ grade: 8, number: 1, title: 'Розділ' }])
    expect(p1.topics.create.map((t) => [t.number, t.title])).toEqual([[2, 'Тема'], [3, 'Інша']])
    expect(p1.outcomes.create.map((c) => c.code)).toEqual(['8-1-2-01', '8-1-2-02', '8-1-3-01'])

    const sections = [{ id: 's1', grade: 8, number: 1, title: 'Розділ' }]
    const topics: ExistingTopic[] = [
      { id: 't2', grade: 8, sectionNumber: 1, number: 2, title: 'Тема' },
      { id: 't3', grade: 8, sectionNumber: 1, number: 3, title: 'Інша' },
    ]
    const db: ExistingOutcome[] = p1.outcomes.create.map((c, i) => ({
      id: `o${i}`, code: c.code, grade: 8, sectionNumber: 1, topicNumber: c.topicNumber, text: c.text, source: c.source, archived: false,
    }))

    // Другий імпорт: інший регістр/пробіли й джерело, нова назва теми, «Другий» прибрано, «Четвертий» додано
    const second = parseOutcomes(csv(HEAD + ';8;1;Розділ;2;Тема (нова);  перший ;Д2\n;8;1;Розділ;2;Тема (нова);Четвертий;Д\n'))
    const p2 = planOutcomes(second.rows, sections, topics, db)
    expect(p2.sections.rename).toEqual([])
    expect(p2.topics.rename).toEqual([{ id: 't2', title: 'Тема (нова)' }])
    expect(p2.outcomes.update).toEqual([{ id: 'o0', code: '8-1-2-01', text: 'перший', source: 'Д2', unarchive: false }])
    expect(p2.outcomes.create.map((c) => c.code)).toEqual(['8-1-2-03'])
    expect(p2.outcomes.missing.map((m) => m.code)).toEqual(['8-1-2-02', '8-1-3-01'])

    // Той самий файл з кодами — без змін
    const p3 = planOutcomes(first.rows.map((r, i) => ({ ...r, code: db[i]!.code })), sections, topics, db)
    expect(p3.outcomes.unchanged).toEqual(['8-1-2-01', '8-1-2-02', '8-1-3-01'])
    expect(p3.outcomes.create).toEqual([])
  })

  it('архівований результат, що знову є у файлі, повертається', () => {
    const rows = parseOutcomes(csv(HEAD + ';8;1;Р;1;Т;А;Д\n')).rows
    const p = planOutcomes(rows, [{ id: 's', grade: 8, number: 1, title: 'Р' }], [{ id: 't', grade: 8, sectionNumber: 1, number: 1, title: 'Т' }], [
      { id: 'o', code: '8-1-1-01', grade: 8, sectionNumber: 1, topicNumber: 1, text: 'А', source: 'Д', archived: true },
    ])
    expect(p.outcomes.update[0]).toMatchObject({ id: 'o', unarchive: true })
  })
})
