import type { TaskAnswer, TaskContent, TaskKey, TaskType } from '../schemas/tasks/index.ts'

/** Результат перевірки (SPEC 7): частка правильності 0–1 і подробиці для зворотного зв'язку. */
export interface CheckResult {
  /** Частка правильності ∈ [0; 1]. Бали = points × fraction (і × швидкість у квізі, SPEC 9.3). */
  fraction: number
  /** Подробиці: які елементи правильні, напрям помилки. Ключа не містять. */
  details: Record<string, unknown>
}

export type Checker<T extends TaskType> = (content: TaskContent<T>, key: TaskKey<T>, answer: TaskAnswer<T>) => CheckResult
