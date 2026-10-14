import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'

/** localStorage може бути недоступний (приватний режим, заборона) — тоді просто без збереження */
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* без збереження */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k)
    } catch {
      /* без збереження */
    }
  },
}

interface ViewSettings {
  /** Спрощений режим уроку (SPEC 8.1). У Фазі 2 для учня з увімкненим режимом — за замовчуванням true. */
  simplified: boolean
  setSimplified: (v: boolean) => void
  /**
   * Останнє застосоване значення «Спрощеного режиму» від вчителя (`<id учня>:<true|false>`):
   * за замовчуванням вигляд береться від вчителя, але учень може перемкнути сам — до наступної
   * зміни вчителем.
   */
  studentDefault: string | null
}

/** Клієнтські налаштування вигляду (SPEC 3.2: клієнтський стан — Zustand). */
export const useViewSettings = create<ViewSettings>()(
  persist(
    (set) => ({
      simplified: false,
      setSimplified: (simplified) => set({ simplified }),
      studentDefault: null,
    }),
    { name: 'geo-view', storage: createJSONStorage(() => safeStorage) },
  ),
)
