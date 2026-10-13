/**
 * CSV для імпорту (SPEC 5.2, 10.6): кодування UTF-8 або Windows-1251 визначається автоматично,
 * роздільник «,» або «;» (Excel в українській локалі зберігає з «;»), лапки за RFC 4180.
 * Без залежностей — працює і в браузері, і в Node.
 */

/** UTF-8 (з BOM чи без), якщо байти коректні; інакше Windows-1251. */
export function decodeText(bytes: Uint8Array): { text: string; encoding: 'utf-8' | 'windows-1251' } {
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)
    return { text, encoding: 'utf-8' }
  } catch {
    return { text: new TextDecoder('windows-1251').decode(bytes), encoding: 'windows-1251' }
  }
}

/** Роздільник за першим рядком: більше «;» поза лапками — «;», інакше «,». */
export function detectDelimiter(text: string): ',' | ';' {
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  const outside = first.replace(/"[^"]*"/g, '')
  return (outside.match(/;/g)?.length ?? 0) > (outside.match(/,/g)?.length ?? 0) ? ';' : ','
}

/** Рядки CSV (без порожніх рядків наприкінці). Номер рядка у файлі — індекс + 1. */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"' && field === '') quoted = true
    else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  while (rows.length && rows[rows.length - 1]!.every((c) => c.trim() === '')) rows.pop()
  return rows
}

/** Таблиця з заголовком: назви стовпців без регістру й пробілів навколо; дані — масив об'єктів. */
export function readTable(bytes: Uint8Array) {
  const { text, encoding } = decodeText(bytes)
  const rows = parseCsv(text.replace(/^\uFEFF/, ''))
  const header = (rows[0] ?? []).map((h) => h.trim().toLocaleLowerCase('uk'))
  const records = rows.slice(1).map((cells, i) => ({
    line: i + 2,
    values: Object.fromEntries(header.map((h, j) => [h, (cells[j] ?? '').trim()])),
    empty: cells.every((c) => c.trim() === ''),
  }))
  return { encoding, header, records }
}
