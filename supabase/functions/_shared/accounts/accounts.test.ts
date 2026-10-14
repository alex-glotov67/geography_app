import {
  classLoginPrefix,
  generatePassword,
  loginToEmail,
  nameKey,
  normalizeLastName,
  PASSWORD_PATTERN,
  PASSWORD_WORDS,
  studentLogin,
  translit,
} from './index.ts'

describe('транслітерація (КМУ №55)', () => {
  it.each([
    ['Згорани', 'zghorany'],
    ['Розгон', 'rozghon'],
    ['Єнакієве', 'yenakiieve'],
    ['Їжакевич', 'yizhakevych'],
    ['Йосипівка', 'yosypivka'],
    ['Юрій', 'yurii'],
    ['Яготин', 'yahotyn'],
    ['Щербухи', 'shcherbukhy'],
    ['Знамʼянка', 'znamianka'],
    ['Рівне', 'rivne'],
    ['Ґалаґан', 'galagan'],
  ])('%s → %s', (ua, en) => expect(translit(ua)).toBe(en))
})

describe('логіни (SPEC 5.1)', () => {
  it('префікс класу: А→a, Б→b, В→v, Г→h, Д→d; Я на початку — ya', () => {
    expect(['8-А', '8-Б', '8-В', '8-Г', '8-Д', '9-Я', '7-Щ'].map(classLoginPrefix)).toEqual(['8a', '8b', '8v', '8h', '8d', '9ya', '7shch'])
    expect(() => classLoginPrefix('8Б')).toThrow(/8-Б/)
  })

  it('логін з номером у два знаки і необов\'язковим префіксом вчителя', () => {
    expect(studentLogin('8b', 7)).toBe('8b-07')
    expect(studentLogin('8b', 12, 'hl')).toBe('hl-8b-12')
  })

  it('поле «Логін»: без @ — адреса учня, з @ — email вчителя', () => {
    expect(loginToEmail(' 8B-07 ')).toBe('8b-07@students.invalid')
    expect(loginToEmail('Teacher@School.ua')).toBe('teacher@school.ua')
  })
})

describe('паролі (SPEC 5.1)', () => {
  it('два різні слова з малих латинських літер і дві цифри 2–9', () => {
    for (let i = 0; i < 500; i++) {
      const p = generatePassword()
      expect(p).toMatch(PASSWORD_PATTERN)
      const [a, b, d] = p.split('-')
      expect(a).not.toBe(b)
      expect(PASSWORD_WORDS).toContain(a)
      expect(PASSWORD_WORDS).toContain(b)
      expect(d).not.toMatch(/[01]/)
    }
  })

  it('словник — лише малі латинські літери, без повторів', () => {
    expect(PASSWORD_WORDS.every((w) => /^[a-z]+$/.test(w))).toBe(true)
    expect(new Set(PASSWORD_WORDS).size).toBe(PASSWORD_WORDS.length)
  })
})

describe('прізвища', () => {
  it.each([
    ['  КОВАЛЬ ', 'Коваль'],
    ['мельник', 'Мельник'],
    ["Об'єднаний", 'Обʼєднаний'],
    ['ДОВГАНЬ-КОВАЛЬЧУК', 'Довгань-Ковальчук'],
    ['МакДональд', 'МакДональд'],
  ])('«%s» → «%s»', (raw, ok) => expect(normalizeLastName(raw)).toBe(ok))

  it('ключ збігу без регістру й з однаковим апострофом', () => {
    expect(nameKey("ОБ'ЄДНАНИЙ", 'О')).toBe(nameKey('Обʼєднаний', 'о'))
  })
})
