import { normGrp, parseOutcomes, planOutcomes, type ExistingOutcome } from './outcomes'

const csv = (s: string) => new TextEncoder().encode(s)
const HEAD = 'Клас;№ розділу;Назва розділу;ГР;Результат;Джерело\n'

describe('довідник програми (SPEC 10.6)', () => {
  it('ГР у різних записах', () => {
    expect(['ГР1', 'гр 2', '3', 'ГР 3'].map(normGrp)).toEqual(['ГР1', 'ГР2', 'ГР3', 'ГР3'])
    expect(normGrp('ГР4')).toBeNull()
  })

  it('коректний файл; порожні рядки пропускаються', () => {
    const { rows, errors } = parseOutcomes(csv(HEAD + '8;1;ДЕМО: розділ;ГР1;ДЕМО: результат;ДЕМО\n;;;;;\n8;1;ДЕМО: розділ;2;Ще один;ДЕМО\n'))
    expect(errors).toEqual([])
    expect(rows.map((r) => [r.line, r.grp])).toEqual([[2, 'ГР1'], [4, 'ГР2']])
  })

  it('помилки з номерами рядків', () => {
    const { errors } = parseOutcomes(
      csv(
        HEAD +
          '5;1;Р;ГР1;Т;Д\n' +
          '8;1;Розділ А;ГР1;Т;\n' +
          '8;2;Розділ Б;ГР1;Т;Д\n' +
          '8;2;Розділ В;ГР1;Т2;Д\n' +
          '8;2;Розділ Б;ГР1;  т ;Д\n',
      ),
    )
    expect(errors.map((e) => e.line)).toEqual([2, 3, 5, 6])
    expect(errors[0]!.message).toMatch(/Клас/)
    expect(errors[1]!.message).toMatch(/Джерело/)
    expect(errors[2]!.message).toMatch(/іншу назву в рядку 4/)
    expect(errors[3]!.message).toMatch(/уже є в рядку 4/)
  })

  it('немає обов\'язкових стовпців', () => {
    expect(parseOutcomes(csv('Клас,ГР\n8,1\n')).errors[0]!.message).toMatch(/№ розділу/)
  })

  it('код: формат, відповідність рядку, дублікати', () => {
    const { errors } = parseOutcomes(
      csv('Код;' + HEAD + '8-1-ГР1;8;1;Р;ГР1;А;Д\n8-2-ГР1-01;8;1;Р;ГР1;Б;Д\n8-1-ГР1-01;8;1;Р;ГР1;В;Д\n8-1-ГР1-01;8;1;Р;ГР1;Г;Д\n'),
    )
    expect(errors.map((e) => [e.line, e.message.slice(0, 12)])).toEqual([
      [2, '«Код» має ви'],
      [3, '«Код» 8-2-ГР'],
      [5, 'Код 8-1-ГР1-'],
    ])
  })

  it('план: нові коди, повторний імпорт не дублює і зберігає коди, відсутні — не видаляються', () => {
    const first = parseOutcomes(csv(HEAD + '8;1;Розділ;ГР2;Перший;Д\n8;1;Розділ;ГР2;Другий;Д\n'))
    const p1 = planOutcomes(first.rows, [], [])
    expect(p1.sections.create).toEqual([{ grade: 8, number: 1, title: 'Розділ' }])
    expect(p1.outcomes.create.map((c) => c.code)).toEqual(['8-1-ГР2-01', '8-1-ГР2-02'])

    const db: ExistingOutcome[] = p1.outcomes.create.map((c, i) => ({
      id: `id${i}`, code: c.code, grade: 8, sectionNumber: 1, grp: c.grp, text: c.text, source: c.source, archived: false,
    }))
    const sections = [{ id: 's1', grade: 8, number: 1, title: 'Розділ' }]
    // Другий імпорт: регістр/пробіли інші, нове джерело, «Другий» прибрано, «Третій» додано
    const second = parseOutcomes(csv(HEAD + '8;1;Розділ (нова назва);ГР2;  перший ;Д2\n8;1;Розділ (нова назва);ГР2;Третій;Д\n'))
    const p2 = planOutcomes(second.rows, sections, db)
    expect(p2.sections.rename).toEqual([{ id: 's1', title: 'Розділ (нова назва)' }])
    expect(p2.outcomes.update).toEqual([{ id: 'id0', code: '8-1-ГР2-01', text: 'перший', source: 'Д2', unarchive: false }])
    expect(p2.outcomes.create.map((c) => c.code)).toEqual(['8-1-ГР2-03'])
    expect(p2.outcomes.missing.map((m) => m.code)).toEqual(['8-1-ГР2-02'])

    // Третій імпорт того самого файлу з кодами — без змін
    const p3 = planOutcomes(first.rows.map((r, i) => ({ ...r, code: db[i]!.code })), sections, db)
    expect(p3.outcomes.unchanged).toEqual(['8-1-ГР2-01', '8-1-ГР2-02'])
    expect(p3.outcomes.create).toEqual([])
  })

  it('архівований результат, що знову є у файлі, повертається', () => {
    const rows = parseOutcomes(csv(HEAD + '8;1;Р;ГР1;А;Д\n')).rows
    const p = planOutcomes(rows, [{ id: 's', grade: 8, number: 1, title: 'Р' }], [
      { id: 'o', code: '8-1-ГР1-01', grade: 8, sectionNumber: 1, grp: 'ГР1', text: 'А', source: 'Д', archived: true },
    ])
    expect(p.outcomes.update[0]).toMatchObject({ id: 'o', unarchive: true })
  })
})
