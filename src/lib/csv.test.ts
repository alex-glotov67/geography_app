import { decodeText, detectDelimiter, parseCsv, readTable } from './csv'

const cp1251 = (s: string) =>
  Uint8Array.from([...s].map((ch) => {
    const map: Record<string, number> = { і: 0xb3, ї: 0xbf, є: 0xba, ґ: 0xb4, І: 0xb2, Ї: 0xaf, Є: 0xaa, Ґ: 0xa5, ' ': 0x20 }
    if (map[ch] !== undefined) return map[ch]
    const c = ch.charCodeAt(0)
    if (c >= 0x410 && c <= 0x44f) return c - 0x410 + 0xc0
    return c
  }))

describe('csv', () => {
  it('UTF-8 з BOM і Windows-1251 з ґ, ї, є', () => {
    expect(decodeText(new TextEncoder().encode('﻿Клас;Ґанок')).encoding).toBe('utf-8')
    const r = decodeText(cp1251('Їжак ґанок Єнакієве'))
    expect(r.encoding).toBe('windows-1251')
    expect(r.text).toBe('Їжак ґанок Єнакієве')
  })

  it('роздільник: «;» з Excel, «,» за замовчуванням', () => {
    expect(detectDelimiter('Клас;№ розділу;Назва')).toBe(';')
    expect(detectDelimiter('Клас,"Назва; з крапкою з комою"')).toBe(',')
  })

  it('лапки, подвоєні лапки, перенос рядка в клітинці, CRLF', () => {
    expect(parseCsv('a,"б, в","г ""д"""\r\n"рядок\nдругий",x\r\n')).toEqual([
      ['a', 'б, в', 'г "д"'],
      ['рядок\nдругий', 'x'],
    ])
  })

  it('таблиця: заголовки без регістру, номери рядків, порожні рядки позначені', () => {
    const t = readTable(new TextEncoder().encode(' Клас ;ГР\n8;ГР1\n;\n9;ГР2\n\n'))
    expect(t.header).toEqual(['клас', 'гр'])
    expect(t.records.map((r) => [r.line, r.empty, r.values['клас']])).toEqual([
      [2, false, '8'],
      [3, true, ''],
      [4, false, '9'],
    ])
  })
})
