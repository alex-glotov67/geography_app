/**
 * Транслітерація українською латиницею за офіційною таблицею (постанова КМУ №55 від 27.01.2010).
 * Для логінів учнів (SPEC 5.1): літера класу «Б» → «b», «8-Б» → «8b».
 * Є, Ї, Й, Ю, Я на початку слова — ye, yi, y, yu, ya; в інших позиціях — ie, i, i, iu, ia.
 * Ь і апостроф не передаються; «зг» → «zgh».
 */

const BASE: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i',
  ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia',
}
const INITIAL: Record<string, string> = { є: 'ye', ї: 'yi', й: 'y', ю: 'yu', я: 'ya' }
const APOSTROPHES = /['’ʼ`]/g

/** Транслітерація тексту в нижньому регістрі; символи поза абеткою лишаються як є. */
export function translit(text: string): string {
  const s = text.toLocaleLowerCase('uk').replace(APOSTROPHES, '')
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!
    const prev = i > 0 ? s[i - 1]! : ''
    const wordStart = !(prev in BASE)
    if (ch === 'г' && prev === 'з') out += 'gh'
    else if (wordStart && ch in INITIAL) out += INITIAL[ch]
    else out += BASE[ch] ?? ch
  }
  return out
}
