import type { Block } from '@shared/schemas/blocks.ts'
import { useBuilder } from './store'

/** Коротко про вміст блоку — для списку структури */
export function blockSummary(block: Block): string {
  switch (block.type) {
    case 'goal':
    case 'terms':
      return `${block.items.length} пункт.`
    case 'text':
    case 'callout':
      return block.title ?? ''
    case 'table':
      return block.caption ?? `${block.rows.length} рядк.`
    case 'gallery':
      return `${block.items.length} зобр.`
    case 'practice':
      return `${block.taskIds.length} завд.`
    case 'file':
      return block.title
    default:
      return ''
  }
}

/** Перехід до блоку в редакторі (зі структури чи з панелі перевірки) */
export function focusBlock(id: string) {
  useBuilder.getState().select(id)
  document.getElementById(`block-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

