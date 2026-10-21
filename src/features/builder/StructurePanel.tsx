import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Block } from '@shared/schemas/blocks.ts'
import { DND_A11Y, useTaskSensors } from '@/tasks/dnd'
import { BLOCK_LABELS, moveItem } from './draft'
import { blockSummary, focusBlock } from './outline'
import { useBuilder } from './store'
import type { DraftIssue } from './validateDraft'
import b from './builder.module.css'

const Arrow = ({ up }: { up?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
  </svg>
)

function Item({ block, index, count, move }: { block: Block; index: number; count: number; move: (from: number, to: number) => void }) {
  const selected = useBuilder((s) => s.selectedBlockId === block.id)
  const { setNodeRef, listeners, attributes, transform, transition, isDragging } = useSortable({ id: block.id })
  const label = BLOCK_LABELS[block.type]
  return (
    <li
      ref={setNodeRef}
      className={b.outlineItem}
      data-selected={selected}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <span className={b.grip} {...listeners} {...attributes} tabIndex={-1} aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.6" />
          <circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" />
          <circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" />
          <circle cx="15" cy="18" r="1.6" />
        </svg>
      </span>
      <button type="button" className={b.outlineLabel} onClick={() => focusBlock(block.id)}>
        {label}
        <span className={b.outlineMeta}>{blockSummary(block)}</span>
      </button>
      <button type="button" className={b.iconBtn} disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={`${label} — вище`}>
        <Arrow up />
      </button>
      <button type="button" className={b.iconBtn} disabled={index === count - 1} onClick={() => move(index, index + 1)} aria-label={`${label} — нижче`}>
        <Arrow />
      </button>
    </li>
  )
}

/** «Структура»: порядок блоків — перетягуванням або кнопками (SPEC 10.2) */
export function StructurePanel() {
  const blocks = useBuilder((s) => s.draft!.blocks)
  const edit = useBuilder((s) => s.edit)
  const sensors = useTaskSensors()
  const move = (from: number, to: number) => edit((d) => ({ ...d, blocks: moveItem(d.blocks, from, to) }))
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    move(
      blocks.findIndex((x) => x.id === active.id),
      blocks.findIndex((x) => x.id === over.id),
    )
  }
  return (
    <section className={b.panel} aria-labelledby="outline-title">
      <h2 id="outline-title" className={b.panelTitle}>
        Структура
      </h2>
      {blocks.length === 0 ? (
        <span style={{ fontSize: 14, color: 'var(--muted)' }}>Блоків ще немає.</span>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={DND_A11Y}>
          <SortableContext items={blocks.map((x) => x.id)} strategy={verticalListSortingStrategy}>
            <ol className={b.outline} aria-label="Блоки уроку">
              {blocks.map((block, i) => (
                <Item key={block.id} block={block} index={i} count={blocks.length} move={move} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </section>
  )
}

/** «Перевірка перед публікацією» — наживо, той самий валідатор, що й у діалозі публікації */
export function ChecksPanel({ errors, warnings }: { errors: DraftIssue[]; warnings: DraftIssue[] }) {
  const all = [...errors, ...warnings]
  if (!all.length) {
    return (
      <section className={b.checksOk} aria-label="Перевірка перед публікацією">
        <span className={b.panelTitle} style={{ fontSize: 15 }}>
          Перевірка перед публікацією
        </span>
        <span style={{ fontSize: 14 }}>Зауважень немає.</span>
      </section>
    )
  }
  return (
    <section className={b.checks} aria-labelledby="checks-title">
      <h2 id="checks-title" className={b.panelTitle} style={{ fontSize: 15 }}>
        Перевірка перед публікацією
      </h2>
      <ul className={b.checkList}>
        {all.map((i) => (
          <li key={i.message}>
            {i.blockId ? (
              <button type="button" className={b.checkItem} data-level={i.level} onClick={() => focusBlock(i.blockId!)}>
                {i.level === 'error' ? 'Помилка: ' : ''}
                {i.message}
              </button>
            ) : (
              <span className={b.checkItem} data-level={i.level} style={{ cursor: 'default' }}>
                {i.level === 'error' ? 'Помилка: ' : ''}
                {i.message}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
