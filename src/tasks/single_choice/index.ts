import { SingleChoiceEditor } from './Editor'
import { SingleChoice } from './Task'
import type { TaskModule } from '../types'

export const singleChoice: TaskModule<'single_choice'> = {
  label: 'Вибір відповіді',
  Task: SingleChoice,
  Editor: SingleChoiceEditor,
  template: () => ({ content: { prompt: '', shuffle: true, options: [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }] }, key: { correct: 'a' } }),
  empty: () => ({ selected: null }),
  isAnswered: (v) => v.selected !== null,
}
