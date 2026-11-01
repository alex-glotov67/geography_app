import { SingleChoice } from './Task'
import type { TaskModule } from '../types'

export const singleChoice: TaskModule<'single_choice'> = {
  label: 'Вибір відповіді',
  Task: SingleChoice,
  empty: () => ({ selected: null }),
  isAnswered: (v) => v.selected !== null,
}
