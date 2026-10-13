import { TrueFalse } from './Task'
import type { TaskModule } from '../types'

export const trueFalse: TaskModule<'true_false'> = {
  label: 'Так чи ні',
  Task: TrueFalse,
  empty: () => ({ answers: {} }),
  isAnswered: (v, c) => c.statements.every((s) => s.id in v.answers),
}
