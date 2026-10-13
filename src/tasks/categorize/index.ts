import { Categorize } from './Task'
import type { TaskModule } from '../types'

export const categorize: TaskModule<'categorize'> = {
  label: 'Групи',
  Task: Categorize,
  empty: () => ({ groups: {} }),
  isAnswered: (v, c) => c.cards.every((card) => v.groups[card.id]),
}
