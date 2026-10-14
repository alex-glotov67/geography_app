import { create } from 'zustand'
import type { Credentials } from '@shared/schemas/students.ts'

/**
 * Логіни й паролі щойно створених чи скинутих акаунтів (SPEC 5.1): вчитель бачить їх один раз —
 * у таблиці й на картках входу. Лише в пам'яті вкладки: без persist, зникають після
 * перезавантаження сторінки чи виходу. Повторно отримати пароль можна лише як новий.
 */
interface CredentialsState {
  /** classId → облікові дані, останні за id учня */
  byClass: Record<string, Credentials[]>
  add: (classId: string, items: Credentials[]) => void
  clear: (classId: string) => void
  clearAll: () => void
}

export const useCredentials = create<CredentialsState>()((set) => ({
  byClass: {},
  add: (classId, items) =>
    set((s) => {
      const merged = new Map((s.byClass[classId] ?? []).map((c) => [c.id, c]))
      for (const c of items) merged.set(c.id, c)
      return { byClass: { ...s.byClass, [classId]: [...merged.values()].sort((a, b) => a.number - b.number) } }
    }),
  clear: (classId) =>
    set((s) => ({ byClass: Object.fromEntries(Object.entries(s.byClass).filter(([id]) => id !== classId)) })),
  clearAll: () => set({ byClass: {} }),
}))
