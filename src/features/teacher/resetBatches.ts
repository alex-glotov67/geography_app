import type { Credentials, ManageStudentsResponse } from '@shared/schemas/students.ts'

/*
 * Нові паролі пачками (SPEC 5.1): клієнт ділить учнів на пачки по RESET_BATCH і надсилає їх по
 * черзі; функція в межах пачки працює паралельно. Кожна пачка повертає паролі одразу — обрив
 * зв'язку на N-й пачці не губить уже скинутих. Без React і мережі — для тестів.
 */

export const RESET_BATCH = 10

export interface ResetTarget {
  id: string
  displayName: string
}

/** failed — збій для учня на сервері; archived — учень в архіві; network — пачку не надіслано / без відповіді */
export interface ResetFailure extends ResetTarget {
  reason: 'failed' | 'archived' | 'network'
}

export interface ResetOutcome {
  credentials: Credentials[]
  failures: ResetFailure[]
}

export const chunk = <T,>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size))

/**
 * Скинути паролі пачками. onBatch — після кожної пачки (паролі одразу в пам'ять вкладки, прогрес).
 * Помилка запиту не зупиняє решту пачок: учні цієї пачки — у failures з reason 'network'.
 */
export async function resetInBatches(
  targets: readonly ResetTarget[],
  call: (ids: string[]) => Promise<ManageStudentsResponse>,
  onBatch: (batch: ResetOutcome, done: number) => void,
  size = RESET_BATCH,
): Promise<ResetOutcome> {
  const total: ResetOutcome = { credentials: [], failures: [] }
  let done = 0
  for (const part of chunk(targets, size)) {
    let batch: ResetOutcome
    try {
      const res = await call(part.map((x) => x.id))
      if (!('credentials' in res)) throw new Error('Неочікувана відповідь')
      const byName = new Map(part.map((x) => [x.displayName, x]))
      batch = {
        credentials: res.credentials,
        failures: res.skipped.flatMap((s): ResetFailure[] => {
          // Стара функція не повертала id — зіставляємо за ім'ям у цій пачці
          const who = s.id ? part.find((x) => x.id === s.id) : byName.get(s.displayName)
          if (!who) return []
          return [{ ...who, reason: s.reason === 'archived' ? 'archived' : 'failed' }]
        }),
      }
      // Учні пачки без пароля й без причини (не мало б бути) — теж як збій, щоб їх можна було повторити
      const seen = new Set([...batch.credentials.map((c) => c.id), ...batch.failures.map((f) => f.id)])
      batch.failures.push(...part.filter((x) => !seen.has(x.id)).map((x) => ({ ...x, reason: 'failed' as const })))
    } catch {
      batch = { credentials: [], failures: part.map((x) => ({ ...x, reason: 'network' as const })) }
    }
    total.credentials.push(...batch.credentials)
    total.failures.push(...batch.failures)
    done += part.length
    onBatch(batch, done)
  }
  return total
}
