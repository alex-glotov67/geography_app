import { MouseSensor, TouchSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core'

/*
 * Перетягування для відповідності, порядку й груп (зауваження до Фази 2, SPEC 7).
 * Миша — після зсуву на 5 px; дотик — після утримання 180 мс з допуском руху 8 px, щоб звичайна
 * прокрутка сторінки пальцем не починала перетягування. Автопрокрутка біля краю — вбудована в
 * DndContext. Клавіатурного сенсора немає свідомо: для клавіатури й читачів екрана — режим
 * «торкнись → торкнись» звичайними кнопками в кожному завданні.
 */
export const TOUCH_DELAY_MS = 180

/**
 * Тексти для читачів екрана замість стандартних англійських dnd-kit (там інструкція про пробіл —
 * у нас клавіатурного перетягування немає, тож кажемо правду: кнопки).
 */
export const DND_A11Y = {
  screenReaderInstructions: {
    draggable: 'Можна перетягнути мишею або пальцем (утримай). З клавіатури — кнопками поруч.',
  },
  announcements: {
    onDragStart: () => 'Перетягування почато.',
    onDragOver: () => undefined,
    onDragEnd: ({ over }: { over: unknown }) => (over ? 'Перетягнуто.' : 'Перетягування скасовано.'),
    onDragCancel: () => 'Перетягування скасовано.',
  },
}

export function useTaskSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: TOUCH_DELAY_MS, tolerance: 8 } }),
  )
}

/** Зона скидання: підсвічується, коли над нею картка */
export function useDropZone(id: string, disabled?: boolean) {
  const { setNodeRef, isOver, active } = useDroppable({ id, disabled })
  return { ref: setNodeRef, 'data-over': (isOver && !!active) || undefined, 'data-droppable': !!active || undefined }
}
