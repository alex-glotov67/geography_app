import { TrueFalseEditor } from './Editor'
import { TrueFalse } from './Task'
import type { TaskModule } from '../types'

export const trueFalse: TaskModule<'true_false'> = {
  label: 'Так чи ні',
  Task: TrueFalse,
  Editor: TrueFalseEditor,
  template: () => ({ content: { prompt: 'Чи правильні твердження?', statements: [{ id: 'sa', text: '' }] }, key: { answers: { sa: true } } }),
  empty: () => ({ answers: {} }),
  isAnswered: (v, c) => c.statements.every((s) => s.id in v.answers),
}
