import { FillBlanks } from './Task'
import type { TaskModule } from '../types'

export const fillBlanks: TaskModule<'fill_blanks'> = {
  label: 'Пропуски',
  Task: FillBlanks,
  empty: () => ({ blanks: {} }),
  isAnswered: (v) => Object.values(v.blanks).some((x) => x.trim() !== ''),
}
