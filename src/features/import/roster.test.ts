import { nameKey } from '@shared/accounts/index.ts'
import { detectMapping, missingClasses, normalizeClassName, parseFullName, parseRoster, planRoster } from './roster'

describe('імпорт списку класу (SPEC 5.2)', () => {
  it('ПІБ: по батькові відкидається, ініціали з крапками, ВЕЛИКІ літери, апостроф', () => {
    expect(parseFullName('Коваль Олена Петрівна')).toEqual({ lastName: 'Коваль', firstInitial: 'О' })
    expect(parseFullName('  КОВАЛЬ   О.П. ')).toEqual({ lastName: 'Коваль', firstInitial: 'О' })
    expect(parseFullName("Обʼєдко Ґанна")).toEqual({ lastName: 'Обʼєдко', firstInitial: 'Ґ' })
    expect(parseFullName("Дем'яненко Їжа")).toEqual({ lastName: 'Демʼяненко', firstInitial: 'Ї' })
    expect(parseFullName('Коваль')).toBeNull()
    expect(parseFullName('Коваль 7')).toBeNull()
  })

  it.each([
    ['8-Б', '8-Б'], ['8б', '8-Б'], ['8 б', '8-Б'], ['8-б клас', '8-Б'], ['8(Б)', '8-Б'], ['8B', '8-В'], ['9–Є', '9-Є'],
    ['5-А', null], ['8-Ы', null], ['вісім', null],
  ])('клас «%s» → %s', (raw, ok) => expect(normalizeClassName(raw)).toBe(ok))

  it('стовпці за заголовком: ПІБ разом / окремо, клас; без заголовка — перший стовпець', () => {
    expect(detectMapping([['№', 'ПІБ', 'Клас'], ['1', 'Коваль Олена', '8-Б']])).toEqual({
      headerRow: true, name: { mode: 'full', col: 1 }, classCol: 2,
    })
    expect(detectMapping([['Прізвище', "Ім'я", 'По батькові']])).toEqual({
      headerRow: true, name: { mode: 'split', last: 0, first: 1 }, classCol: null,
    })
    expect(detectMapping([["Ім’я", 'Прізвище']]).name).toEqual({ mode: 'split', last: 1, first: 0 })
    expect(detectMapping([['Коваль Олена']])).toEqual({ headerRow: false, name: { mode: 'full', col: 0 }, classCol: null })
  })

  it('рядки: порожні пропущено, помилки з номером рядка', () => {
    const grid = [['ПІБ', 'Клас'], ['Коваль Олена', '8б'], ['', ''], ['Мельник', '8-Б'], ['Бондар Анна', '5-А'], ['', '8-Б']]
    const rows = parseRoster(grid, detectMapping(grid))
    expect(rows.map((r) => [r.line, r.lastName, r.firstInitial, r.className, r.error ?? ''])).toEqual([
      [2, 'Коваль', 'О', '8-Б', ''],
      [4, '', '', '8-Б', "Потрібні прізвище та ім'я"],
      [5, 'Бондар', 'А', null, 'Клас «5-А» — очікується 6–9 і літера, напр. 8-Б'],
      [6, '', '', '8-Б', 'Немає прізвища'],
    ])
  })

  it('окремі стовпці прізвища й імені', () => {
    const grid = [['Прізвище', "Ім'я"], ['ковальчук', 'олег'], ['Бойко', '']]
    const rows = parseRoster(grid, detectMapping(grid))
    expect(rows[0]).toMatchObject({ source: 'ковальчук олег', lastName: 'Ковальчук', firstInitial: 'О' })
    expect(rows[1]!.error).toBeTruthy()
  })

  it('план: новий / уже є в класі / двічі у файлі / помилка; кілька класів; нові класи', () => {
    const grid = [
      ['ПІБ', 'Клас'],
      ['Коваль Олена', '8-Б'],
      ['Бондар Анна', '8-Б'],
      ['КОВАЛЬ Оксана', '8-Б'],
      ['Бондар Андрій', '8-Б'],
      ['Бондар Анна', '8-В'],
      ['Мельник', '8-В'],
    ]
    const existing = new Map([['8-Б', new Set([nameKey('Коваль', 'О')])]])
    const plan = planRoster(parseRoster(grid, detectMapping(grid)), '8-Б', existing)
    expect(plan.map((r) => [r.line, r.target, r.status])).toEqual([
      [2, '8-Б', 'exists'],
      [3, '8-Б', 'new'],
      [4, '8-Б', 'exists'],
      [5, '8-Б', 'duplicate'],
      [6, '8-В', 'new'],
      [7, '8-В', 'error'],
    ])
    expect(missingClasses(plan, ['8-Б'])).toEqual(['8-В'])
  })

  it('без стовпця класу — усі в поточний клас', () => {
    const grid = [['Коваль Олена'], ['Бондар Анна']]
    const plan = planRoster(parseRoster(grid, detectMapping(grid)), '8-Б', new Map())
    expect(plan.map((r) => [r.target, r.status])).toEqual([['8-Б', 'new'], ['8-Б', 'new']])
  })
})
