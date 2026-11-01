import type { ComponentType } from 'react'
import type { TaskAnswer, TaskContent, TaskKey, TaskType } from '@shared/schemas/tasks/index.ts'

/** Контрольований компонент завдання (SPEC 7): value/onChange; details — результат перевірки. */
export interface TaskViewProps<T extends TaskType> {
  /** Унікальний префікс для id полів і груп */
  uid: string
  content: TaskContent<T>
  value: TaskAnswer<T>
  onChange: (value: TaskAnswer<T>) => void
  disabled?: boolean
  /** details з @shared/scoring після «Перевірити» — підсвітка правильних і хибних елементів */
  details?: Record<string, unknown> | null
}

export interface TaskModule<T extends TaskType> {
  /** Назва типу для каталогу і підписів */
  label: string
  Task: ComponentType<TaskViewProps<T>>
  /**
   * Редактор для вчителя (SPEC 10.3) — у формі React Hook Form над TaskFormValues; без нього тип
   * у каталозі банку позначено «з'явиться пізніше».
   */
  Editor?: ComponentType
  /** Порожнє завдання-заготовка для «Нове завдання» */
  template?: () => { content: TaskContent<T>; key: TaskKey<T> }
  /** Порожня відповідь (стан до першої дії) */
  empty: (content: TaskContent<T>) => TaskAnswer<T>
  /** Чи є що перевіряти */
  isAnswered: (value: TaskAnswer<T>, content: TaskContent<T>) => boolean
}

/** Для підсвітки: details.items[id] → 'ok' | 'err' | undefined */
export const itemResult = (details: Record<string, unknown> | null | undefined, id: string) => {
  const items = details?.items as Record<string, boolean> | undefined
  if (!items || !(id in items)) return undefined
  return items[id] ? 'ok' : 'err'
}
