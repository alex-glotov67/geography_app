import { NumericEditor } from './Editor'
import { NumericTask } from './Task'
import type { TaskModule } from '../types'

export const numeric: TaskModule<'numeric'> = {
  label: 'Обчислення',
  Task: NumericTask,
  Editor: NumericEditor,
  template: () => ({ content: { prompt: '' }, key: { answer: Number.NaN, tolerance: 0 } }),
  empty: () => ({ value: null }),
  isAnswered: (v) => v.value !== null,
}
