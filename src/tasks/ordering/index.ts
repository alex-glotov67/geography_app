import { shuffled } from '../shuffle'
import { Ordering } from './Task'
import type { TaskModule } from '../types'

export const ordering: TaskModule<'ordering'> = {
  label: 'Порядок',
  Task: Ordering,
  // Перемішаний порядок; учень одразу бачить усі елементи
  empty: (c) => ({ order: shuffled(c.items.map((i) => i.id), Math.floor(Math.random() * 1e9)) }),
  isAnswered: () => true,
}
