import { outcomeError, sectionError, topicError } from './outcomesEdit'

describe('ручні правки довідника — ті самі правила, що й імпорт', () => {
  it('розділ: номер ≥ 0, назва обов’язкова, без дубля номера в класі', () => {
    expect(sectionError({ grade: 8, number: 2, title: 'Рельєф' }, [])).toBeNull()
    expect(sectionError({ grade: 8, number: -1, title: 'Р' }, [])).toMatch(/№ розділу/)
    expect(sectionError({ grade: 8, number: 1, title: '  ' }, [])).toMatch(/Назва розділу/)
    expect(sectionError({ grade: 5, number: 1, title: 'Р' }, [])).toMatch(/Клас/)
    expect(sectionError({ grade: 8, number: 2, title: 'Р' }, [{ id: 's', grade: 8, number: 2 }])).toBe('Розділ 2 для 8 класу вже є')
    expect(sectionError({ grade: 8, number: 2, title: 'Р' }, [{ id: 's', grade: 8, number: 2 }], 's')).toBeNull()
  })

  it('тема: номер і назва, без дубля номера в розділі', () => {
    expect(topicError({ number: 0, title: 'Вступ' }, [])).toBeNull()
    expect(topicError({ number: 3, title: 'Т' }, [{ id: 't', number: 3 }])).toBe('Тема 3 у цьому розділі вже є')
  })

  it('результат: текст і джерело обов’язкові; дубль — без регістру й зайвих пробілів', () => {
    expect(outcomeError({ text: 'Називає форми', source: 'Програма' }, [])).toBeNull()
    expect(outcomeError({ text: 'Т', source: ' ' }, [])).toMatch(/Джерело/)
    expect(outcomeError({ text: '  називає   ФОРМИ ', source: 'П' }, [{ id: 'o', code: '8-1-1-01', text: 'Називає форми' }])).toBe(
      'Такий результат у темі вже є (8-1-1-01)',
    )
    expect(outcomeError({ text: 'Називає форми', source: 'П' }, [{ id: 'o', code: '8-1-1-01', text: 'Називає форми' }], 'o')).toBeNull()
  })
})
