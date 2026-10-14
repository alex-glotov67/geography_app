import { decodeText, parseCsv } from '@/lib/csv'

/**
 * Адаптер файлу списку класу (SPEC 5.2, 3.5): .xlsx, .xls, .csv → таблиця рядків. Розбір на клієнті.
 * CSV — власний розбір з автовизначенням UTF-8 / Windows-1251; Excel — SheetJS (офіційний тарбол
 * cdn.sheetjs.com), вантажиться окремим чанком лише тут. Пізніше поруч — адаптер API журналу.
 */

export interface Grid {
  rows: string[][]
  /** Для CSV — визначене кодування */
  encoding?: 'utf-8' | 'windows-1251'
}

export const ACCEPT = '.xlsx,.xls,.csv'
export const MAX_BYTES = 2 * 1024 * 1024

export class ImportFileError extends Error {}

export async function readGrid(file: File): Promise<Grid> {
  if (file.size > MAX_BYTES) throw new ImportFileError('Файл більший за 2 МБ — це точно список класу?')
  const ext = file.name.toLowerCase().split('.').pop()
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (ext === 'csv') {
    const { text, encoding } = decodeText(bytes)
    return { rows: parseCsv(text), encoding }
  }
  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await import('xlsx')
    let wb
    try {
      wb = XLSX.read(bytes, { type: 'array', dense: true })
    } catch {
      throw new ImportFileError('Не вдалося прочитати файл Excel. Збережи його ще раз як .xlsx або .csv.')
    }
    const sheet = wb.Sheets[wb.SheetNames[0]!]
    if (!sheet) throw new ImportFileError('У файлі немає аркушів')
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '', blankrows: false })
    return { rows: rows.map((r) => r.map((c) => String(c ?? ''))) }
  }
  throw new ImportFileError('Підходять файли .xlsx, .xls або .csv')
}
