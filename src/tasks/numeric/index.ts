import { NumericTask } from './Task'
import type { TaskModule } from '../types'

export const numeric: TaskModule<'numeric'> = {
  label: 'Обчислення',
  Task: NumericTask,
  empty: () => ({ value: null }),
  isAnswered: (v) => v.value !== null,
}
