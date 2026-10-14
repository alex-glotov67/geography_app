import type { Block } from '@shared/schemas/blocks.ts'

/** Сусідні «текст + відео» (у будь-якому порядку) — на комп'ютері стоять поруч (SPEC 13.4, LessonDesktop.dc.html) */
const pairs = (a: Block | undefined, b: Block | undefined) =>
  !!a && !!b && ((a.type === 'text' && b.type === 'video') || (a.type === 'video' && b.type === 'text'))

/** Групи для рендеру: одиничні блоки й пари «текст + відео» */
export function groupBlocks(list: Block[]): Block[][] {
  const groups: Block[][] = []
  for (let i = 0; i < list.length; i++) {
    if (pairs(list[i], list[i + 1])) {
      groups.push([list[i]!, list[i + 1]!])
      i++
    } else groups.push([list[i]!])
  }
  return groups
}
