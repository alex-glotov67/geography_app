import type { Block, BlockType } from '@shared/schemas/blocks.ts'
import type { RichDoc } from '@shared/schemas/richtext.ts'

/*
 * Чернетка уроку в конструкторі (SPEC 10.1, 10.2) — чисті функції без React і мережі.
 * Незавершена чернетка може бути неповною (порожні пункти, таблиця без джерела): зберігається як є,
 * повна перевірка — лише перед публікацією (validateDraft.ts).
 */

export interface TextbookRef {
  paragraph?: string
  pages?: string
}

export interface LessonDraftState {
  slug: string
  grade: number
  sectionId: string | null
  number: number | null
  title: string
  textbookRef: TextbookRef | null
  ktpRef: string | null
  blocks: Block[]
  homework: { taskIds: string[] } | null
  simplified: { blocks?: Block[]; homeworkTaskIds?: string[] } | null
  outcomeIds: string[]
}

/** Поля для RPC save_lesson (p_fields) — назви як у SQL-функції */
export function toSaveFields(d: LessonDraftState): Record<string, unknown> {
  const ref = d.textbookRef && (d.textbookRef.paragraph?.trim() || d.textbookRef.pages?.trim()) ? d.textbookRef : null
  return {
    slug: d.slug,
    grade: d.grade,
    sectionId: d.sectionId,
    number: d.number,
    title: d.title,
    textbookRef: ref,
    ktpRef: d.ktpRef?.trim() ? d.ktpRef : null,
    blocks: d.blocks,
    homework: d.homework,
    simplified: d.simplified,
  }
}

/** id блоку: латиниця й цифри (схема Id), без збігів у межах уроку */
export function blockId(taken: Iterable<string>, random: () => number = Math.random): string {
  const used = new Set(taken)
  for (;;) {
    const id = 'b' + Math.floor(random() * 36 ** 6).toString(36).padStart(6, '0')
    if (!used.has(id)) return id
  }
}

/** Типи блоків, які вже можна додати в конструкторі (решта — з медіатекою й банком завдань) */
export const ADDABLE_BLOCKS = ['goal', 'text', 'terms', 'callout', 'table'] as const
export type AddableBlock = (typeof ADDABLE_BLOCKS)[number]

export const BLOCK_LABELS: Record<BlockType, string> = {
  goal: 'Мета',
  text: 'Текст',
  terms: 'Терміни',
  image: 'Зображення',
  gallery: 'Галерея',
  video: 'Відео',
  callout: 'Виділений блок',
  table: 'Таблиця',
  file: 'Файл PDF',
  practice: 'Тренування',
  homework: 'Домашнє завдання',
}

export const BLOCK_HINTS: Record<AddableBlock, string> = {
  goal: '«Що ти дізнаєшся» — 2–5 пунктів',
  text: 'пояснення, абзаци',
  terms: 'термін → визначення',
  callout: '«Цікаво знати», «Зверни увагу», «Мій край»',
  table: 'дані з джерелом і датою',
}

/** Порожній абзац — стан нового тексту (публікацію заблокує валідатор, поки не заповнено) */
const emptyDoc = (): RichDoc => ({ type: 'doc', content: [{ type: 'paragraph' }] })

export function newBlock(type: AddableBlock, id: string): Block {
  switch (type) {
    case 'goal':
      return { id, type, simplified: true, items: ['', ''] }
    case 'text':
      return { id, type, simplified: true, doc: emptyDoc() }
    case 'terms':
      return { id, type, simplified: true, items: [{ term: '', definition: '' }] }
    case 'callout':
      return { id, type, simplified: true, variant: 'interesting', doc: emptyDoc() }
    case 'table':
      return { id, type, simplified: true, columns: ['', ''], rows: [['', '']], meta: { source: '', asOf: '' } }
  }
}

export const moveItem = <T,>(list: readonly T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list]
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}

/** Усі завдання уроку: тренування (основні й спрощені блоки) і ДЗ */
export function lessonTaskIds(d: Pick<LessonDraftState, 'blocks' | 'homework' | 'simplified'>): string[] {
  const ids = [...d.blocks, ...(d.simplified?.blocks ?? [])].flatMap((b) => (b.type === 'practice' ? b.taskIds : []))
  ids.push(...(d.homework?.taskIds ?? []), ...(d.simplified?.homeworkTaskIds ?? []))
  return [...new Set(ids)]
}

export function lessonMediaIds(d: Pick<LessonDraftState, 'blocks' | 'simplified'>): string[] {
  const ids = [...d.blocks, ...(d.simplified?.blocks ?? [])].flatMap((b) =>
    b.type === 'image' || b.type === 'file' ? [b.mediaId] : b.type === 'gallery' ? b.items.map((i) => i.mediaId) : [],
  )
  return [...new Set(ids)]
}

export function lessonVideoIds(d: Pick<LessonDraftState, 'blocks' | 'simplified'>): string[] {
  return [...new Set([...d.blocks, ...(d.simplified?.blocks ?? [])].flatMap((b) => (b.type === 'video' ? [b.videoId] : [])))]
}

/** «2 × ГР1, 1 × ГР2» з тегів ГР завдань уроку (SPEC 10.2); порожньо — завдань немає */
export function grSummary(groups: readonly string[]): string {
  const counts = new Map<string, number>()
  for (const g of groups) counts.set(g, (counts.get(g) ?? 0) + 1)
  return ['ГР1', 'ГР2', 'ГР3']
    .filter((g) => counts.has(g))
    .map((g) => `${counts.get(g)} × ${g}`)
    .join(', ')
}
