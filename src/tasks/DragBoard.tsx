import { useState, type ReactNode } from 'react'
import { DndContext, DragOverlay, useDraggable, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { DND_A11Y, useTaskSensors } from './dnd'
import classes from './tasks.module.css'

interface BoardProps {
  children: ReactNode
  onDrop: (draggedId: string, targetId: string | null) => void
  /** Текст «привида» для перетягуваного id */
  label: (id: string) => string
}

/** Контекст перетягування з «привидом» картки під пальцем / курсором */
export function DragBoard({ children, onDrop, label }: BoardProps) {
  const sensors = useTaskSensors()
  const [active, setActive] = useState<string | null>(null)
  return (
    <DndContext
      sensors={sensors}
      accessibility={DND_A11Y}
      autoScroll
      onDragStart={(e: DragStartEvent) => setActive(String(e.active.id))}
      onDragCancel={() => setActive(null)}
      onDragEnd={(e: DragEndEvent) => {
        setActive(null)
        onDrop(String(e.active.id), e.over ? String(e.over.id) : null)
      }}
    >
      {children}
      <DragOverlay dropAnimation={null}>{active ? <span className={classes.ghost}>{label(active)}</span> : null}</DragOverlay>
    </DndContext>
  )
}

/** Обгортка, яку можна тягнути. Клік без руху лишається кліком (кнопка «торкнись → торкнись»). */
export function Draggable({ id, disabled, children }: { id: string; disabled?: boolean; children: (p: { dragging: boolean; bind: Record<string, unknown> }) => ReactNode }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id, disabled })
  return <>{children({ dragging: isDragging, bind: { ref: setNodeRef, ...listeners, 'data-dragging': isDragging || undefined } })}</>
}

