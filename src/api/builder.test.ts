import { byPosition, directoryCsv, freeSlug, lessonSlug } from './builder'

describe('уроки й довідник у конструкторі', () => {
  it('адреса уроку з класу й номера, вільна — з суфіксом', () => {
    expect(lessonSlug(8, 5)).toBe('g8-u05')
    expect(lessonSlug(9, 112)).toBe('g9-u112')
    expect(freeSlug('g8-u05', [])).toBe('g8-u05')
    expect(freeSlug('g8-u05', ['g8-u05', 'g8-u05-2'])).toBe('g8-u05-3')
  })

  it('експорт довідника: формат 10.6, коди, без архівних, лапки для «;»', () => {
    const csv = directoryCsv([
      {
        id: 's', grade: 8, number: 1, title: 'Рельєф; тектоніка',
        topics: [{
          id: 't', number: 2, title: 'Тема',
          outcomes: [
            { id: 'a', code: '8-1-2-01', position: null, text: 'Називає "форми"', source: 'Програма', archived: false },
            { id: 'b', code: '8-1-2-02', position: null, text: 'Старий', source: 'Програма', archived: true },
          ],
        }],
      },
    ])
    expect(csv.split('\r\n')).toEqual([
      '﻿Код;Клас;№ розділу;Назва розділу;№ теми;Назва теми;Результат;Джерело',
      '8-1-2-01;8;1;"Рельєф; тектоніка";2;Тема;"Називає ""форми""";Програма',
      '',
    ])
  })
})

describe('порядок результатів у темі', () => {
  it('спершу задані вчителем позиції, далі решта за кодом (числово)', () => {
    const list = [
      { code: '8-1-1-10', position: null },
      { code: '8-1-1-02', position: null },
      { code: '8-1-1-05', position: 1 },
      { code: '8-1-1-07', position: 0 },
    ]
    expect([...list].sort(byPosition).map((o) => o.code)).toEqual(['8-1-1-07', '8-1-1-05', '8-1-1-02', '8-1-1-10'])
  })
})
