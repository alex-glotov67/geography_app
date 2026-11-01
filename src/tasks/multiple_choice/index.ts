import { MultipleChoiceEditor } from './Editor'
import { MultipleChoice } from './Task'
import type { TaskModule } from '../types'

export const multipleChoice: TaskModule<'multiple_choice'> = {
  label: 'Кілька відповідей',
  Task: MultipleChoice,
  Editor: MultipleChoiceEditor,
  template: () => ({ content: { prompt: '', shuffle: true, options: [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }] }, key: { correct: ['a'] } }),
  empty: () => ({ selected: [] }),
  isAnswered: (v) => v.selected.length > 0,
}
