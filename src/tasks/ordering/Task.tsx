import { useState } from 'react'
import { DndContext, DragOverlay, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DND_A11Y, useTaskSensors } from '../dnd'
import type { TaskViewProps } from '../types'
import classes from '../tasks.module.css'

const Arrow = ({ up }: { up?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
  </svg>
)

const Grip = () => (
  <svg className={classes.grip} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="9" cy="6" r="1.6" />
    <circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" />
    <circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" />
    <circle cx="15" cy="18" r="1.6" />
  </svg>
)

interface RowProps {
  id: string
  index: number
  count: number
  text: string
  disabled?: boolean
  move: (from: number, to: number) => void
}

function Row({ id, index, count, text, disabled, move }: RowProps) {
  // Перетягування — за весь рядок (миша — зсув, дотик — утримання); кнопки — запасний режим
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({ id, disabled })
  return (
    <li
      ref={setNodeRef}
      className={`${classes.orderItem} ${disabled ? '' : classes.draggable}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-dragging={isDragging || undefined}
      {...listeners}
    >
      <Grip />
      <span className={classes.orderNum} aria-hidden="true">
        {index + 1}
      </span>
      <span className={classes.orderText}>{text}</span>
      <button type="button" className={classes.iconButton} aria-label={`Вище: ${text}`} disabled={disabled || index === 0} onClick={() => move(index, index - 1)}>
        <Arrow up />
      </button>
      <button type="button" className={classes.iconButton} aria-label={`Нижче: ${text}`} disabled={disabled || index === count - 1} onClick={() => move(index, index + 1)}>
        <Arrow />
      </button>
    </li>
  )
}

/**
 * Упорядкування (MoreTasks.dc.html): перетягування рядка мишею або пальцем (dnd-kit) і кнопки
 * «вище / нижче» для клавіатури й читачів екрана; переміщення оголошується.
 */
export function Ordering({ content, value, onChange, disabled, details }: TaskViewProps<'ordering'>) {
  const sensors = useTaskSensors()
  const [announce, setAnnounce] = useState('')
  const [active, setActive] = useState<string | null>(null)
  const text = (id: string) => content.items.find((i) => i.id === id)?.text ?? id
  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.order.length || from === to) return
    const next = arrayMove(value.order, from, to)
    onChange({ order: next })
    setAnnounce(`«${text(next[to]!)}» тепер на місці ${to + 1} з ${next.length}`)
  }
  const onDragEnd = (e: DragEndEvent) => {
    setActive(null)
    if (e.over) move(value.order.indexOf(String(e.active.id)), value.order.indexOf(String(e.over.id)))
  }
  return (
    <div className={classes.stack}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={DND_A11Y}
        autoScroll
        onDragStart={(e) => setActive(String(e.active.id))}
        onDragCancel={() => setActive(null)}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={value.order} strategy={verticalListSortingStrategy}>
          <ol className={`${classes.stack} ${classes.plainList}`} aria-label="Поточний порядок">
            {value.order.map((id, i) => (
              <Row key={id} id={id} index={i} count={value.order.length} text={text(id)} disabled={disabled} move={move} />
            ))}
          </ol>
        </SortableContext>
        <DragOverlay dropAnimation={null}>{active ? <span className={classes.ghost}>{text(active)}</span> : null}</DragOverlay>
      </DndContext>
      <p className={classes.srOnly} aria-live="polite">
        {announce}
      </p>
      {details && !details.exact && (
        <p className={classes.hint}>
          Правильних сусідніх пар: {String(details.correctPairs)} з {String(details.totalPairs)}
        </p>
      )}
    </div>
  )
}
