import { translit } from './translit.ts'

/**
 * Логіни, паролі й імена учнів (SPEC 5.1, 5.2). Чистий TS: спільний для клієнта (майстер імпорту)
 * і Edge Function manage-students.
 */
export { translit }

/** Адреса акаунта учня в Supabase Auth: справжньої пошти немає, підтвердження вимкнено */
export const STUDENT_EMAIL_DOMAIN = 'students.invalid'
export const studentEmail = (login: string) => `${login}@${STUDENT_EMAIL_DOMAIN}`

/** Поле «Логін» на екрані входу: без «@» — логін учня, з «@» — email вчителя */
export const loginToEmail = (input: string) => {
  const v = input.trim().toLowerCase()
  return v.includes('@') ? v : studentEmail(v)
}

/** Великі літери української абетки (без Ь) — для літери класу й ініціала */
export const UA_LETTERS = 'АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЮЯ'

export const CLASS_NAME = new RegExp(`^([6-9])-([${UA_LETTERS}])$`)

/** «8-Б» → «8b» (префікс класу в логіні) */
export function classLoginPrefix(name: string): string {
  const m = CLASS_NAME.exec(name)
  if (!m) throw new Error(`Назва класу виду «8-Б», а не «${name}»`)
  return m[1]! + translit(m[2]!)
}

/** Логін: [префікс вчителя-]<клас>-<№ у списку>, напр. 8b-07 або hl-8b-07 */
export function studentLogin(classPrefix: string, number: number, teacherPrefix = ''): string {
  const n = String(number).padStart(2, '0')
  return `${teacherPrefix ? `${teacherPrefix}-` : ''}${classPrefix}-${n}`
}

/**
 * Словник паролів: прості географічні слова в транслітерації, лише малі літери (SPEC 5.1).
 * Без слів, де легко сплутати літери на слух чи з диктовки.
 */
export const PASSWORD_WORDS = [
  'gora', 'richka', 'ozero', 'step', 'lis', 'more', 'pole', 'dolyna', 'khvylia', 'skelia',
  'kraina', 'ostriv', 'bereh', 'khmara', 'vulkan', 'dzherelo', 'pustelia', 'tundra', 'zatoka', 'kosa',
  'strumok', 'kamin', 'pisok', 'hai', 'luka', 'yar', 'balka', 'potik', 'vodospad', 'pahorb',
]
/** Цифри без 0 і 1 (плутають з o і l) */
export const PASSWORD_DIGITS = '23456789'

/** Випадкове ціле [0, n) з криптостійкого генератора (браузер, Deno, Node ≥ 19) */
function randomInt(n: number): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n
  const buf = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0]! < limit) return buf[0]! % n
  }
}

/** Пароль виду gora-step-47: два різні слова й дві цифри 2–9 */
export function generatePassword(): string {
  const a = randomInt(PASSWORD_WORDS.length)
  let b = randomInt(PASSWORD_WORDS.length - 1)
  if (b >= a) b++
  const d = () => PASSWORD_DIGITS[randomInt(PASSWORD_DIGITS.length)]
  return `${PASSWORD_WORDS[a]}-${PASSWORD_WORDS[b]}-${d()}${d()}`
}

export const PASSWORD_PATTERN = /^[a-z]+-[a-z]+-[2-9]{2}$/

const APOSTROPHE = /['’`]/g
const titleCase = (part: string) =>
  part.length ? part[0]!.toLocaleUpperCase('uk') + part.slice(1).toLocaleLowerCase('uk') : part

/**
 * Прізвище як у журналі: крайні й подвійні пробіли прибрано, апостроф — «ʼ»; написане
 * ЦІЛКОМ ВЕЛИКИМИ чи малими — з великої літери (частини через дефіс — кожна).
 */
export function normalizeLastName(raw: string): string {
  const s = raw.trim().replace(/\s+/g, ' ').replace(APOSTROPHE, 'ʼ')
  const mixed = s !== s.toLocaleUpperCase('uk') && s !== s.toLocaleLowerCase('uk')
  return mixed ? s : s.split('-').map((p) => p.split(' ').map(titleCase).join(' ')).join('-')
}

/** Ключ збігу при повторному імпорті — як students.name_key у БД */
export const nameKey = (lastName: string, firstInitial: string) =>
  `${normalizeLastName(lastName).toLocaleLowerCase('uk')} ${firstInitial.toLocaleLowerCase('uk')}`
