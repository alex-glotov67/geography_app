import type { TaskType } from '@shared/schemas/tasks/index.ts'
import { categorize } from './categorize'
import { fillBlanks } from './fill_blanks'
import { matching } from './matching'
import { multipleChoice } from './multiple_choice'
import { numeric } from './numeric'
import { ordering } from './ordering'
import { singleChoice } from './single_choice'
import { trueFalse } from './true_false'
import type { TaskModule } from './types'

/** Реєстр модулів завдань (SPEC 7, 10.3): новий тип з'являється всюди через цей об'єкт. */
export const TASKS: { [T in TaskType]: TaskModule<T> } = {
  single_choice: singleChoice,
  multiple_choice: multipleChoice,
  true_false: trueFalse,
  matching,
  ordering,
  categorize,
  fill_blanks: fillBlanks,
  numeric,
}
