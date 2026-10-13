import { Matching } from './Task'
import type { TaskModule } from '../types'

export const matching: TaskModule<'matching'> = {
  label: 'Відповідність',
  Task: Matching,
  empty: () => ({ pairs: {} }),
  isAnswered: (v, c) => c.left.every((l) => v.pairs[l.id]),
}
