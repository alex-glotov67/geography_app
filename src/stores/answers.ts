import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'

/**
 * Відповіді учня в тренуванні (зауваження до Фази 2): живуть поза компонентом, тож ні
 * перемонтування, ні фонове оновлення даних їх не стирає. Ключ — `${lessonId}@${version}:${taskId}`:
 * нова публікація уроку не підставить старих відповідей до змінених завдань. Зберігаються в
 * sessionStorage вкладки — переживають і перезавантаження (телефон вивантажив фонову вкладку),
 * але не переходять до іншої вкладки чи іншого учня на спільному комп'ютері після закриття.
 */
export interface SavedAnswer {
  value: unknown
  /** Учень натиснув «Перевірити» і відтоді не змінював відповідь */
  checked: boolean
}

interface AnswersState {
  answers: Record<string, SavedAnswer>
  save: (key: string, answer: SavedAnswer) => void
  /** Після виходу з акаунта — наступний учень за тим самим комп'ютером починає з чистого аркуша */
  reset: () => void
}

const safeSession: StateStorage = {
  getItem: (k) => {
    try {
      return sessionStorage.getItem(k)
    } catch {
      return null
    }
  },
  setItem: (k, v) => {
    try {
      sessionStorage.setItem(k, v)
    } catch {
      /* без збереження: квота чи заборона */
    }
  },
  removeItem: (k) => {
    try {
      sessionStorage.removeItem(k)
    } catch {
      /* без збереження */
    }
  },
}

export const answerKey = (scope: string, taskId: string) => `${scope}:${taskId}`

export const useAnswers = create<AnswersState>()(
  persist(
    (set) => ({
      answers: {},
      save: (key, answer) => set((s) => ({ answers: { ...s.answers, [key]: answer } })),
      reset: () => set({ answers: {} }),
    }),
    { name: 'geo-answers', storage: createJSONStorage(() => safeSession) },
  ),
)
