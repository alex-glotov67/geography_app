import { MultipleChoice } from './Task'
import type { TaskModule } from '../types'

export const multipleChoice: TaskModule<'multiple_choice'> = {
  label: 'Кілька відповідей',
  Task: MultipleChoice,
  empty: () => ({ selected: [] }),
  isAnswered: (v) => v.selected.length > 0,
}
