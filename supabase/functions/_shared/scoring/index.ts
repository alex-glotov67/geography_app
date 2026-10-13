/**
 * @shared/scoring — перевірка відповідей (SPEC 3.3, 7). Чистий TypeScript без залежностей:
 * один і той самий код для тренування (клієнт), ДЗ (submit-homework) і квізу (quiz-answer).
 * Вхід уже провалідовано zod-схемами з ../schemas (зміст, ключ, відповідь).
 */
import type { TaskAnswer, TaskContent, TaskKey, TaskType } from '../schemas/tasks/index.ts'
import * as checkers from './checkers.ts'
import type { Checker, CheckResult } from './types.ts'

export type { CheckResult } from './types.ts'
export { normalizeText } from './util.ts'

const CHECKERS: { [T in TaskType]: Checker<T> } = {
  single_choice: checkers.singleChoice,
  multiple_choice: checkers.multipleChoice,
  true_false: checkers.trueFalse,
  matching: checkers.matching,
  ordering: checkers.ordering,
  categorize: checkers.categorize,
  fill_blanks: checkers.fillBlanks,
  numeric: checkers.numeric,
}

export interface Scored extends CheckResult {
  /** Бали: points × fraction, з точністю до 0,1 */
  score: number
  max: number
}

export function check<T extends TaskType>(
  type: T,
  content: TaskContent<T>,
  key: TaskKey<T>,
  answer: TaskAnswer<T>,
  points = 1,
): Scored {
  const result = (CHECKERS[type] as Checker<T>)(content, key, answer)
  return { ...result, score: Math.round(points * result.fraction * 10) / 10, max: points }
}
