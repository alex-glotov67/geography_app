/*
 * Розклад автозбереження (SPEC 10.1) без React: зберегти через DELAY після останньої зміни, але не
 * рідше ніж раз на MAX_WAIT безперервних правок; flush() — негайно (вихід з поля, перехід з
 * екрана, публікація). Одночасно — лише одне збереження; зміни під час збереження — ще одне після.
 * Помилка мережі — повтор із зростаючою паузою; конфлікт ревізій — зупинка до рішення вчителя.
 */

export const SAVE_DELAY_MS = 2_000
export const SAVE_MAX_WAIT_MS = 10_000
export const RETRY_DELAYS_MS = [5_000, 10_000, 30_000] as const

export type SaveOutcome = 'saved' | 'conflict' | 'error'

export interface AutosaveOptions {
  /** Зберегти поточну чернетку; 'conflict' — ревізія застаріла (інша вкладка) */
  save: () => Promise<SaveOutcome>
  delayMs?: number
  maxWaitMs?: number
  retryDelaysMs?: readonly number[]
}

export interface Autosave {
  /** Чернетку змінено */
  changed(): void
  /** Зберегти зараз; проміс — після завершення (зокрема збереження, що вже йде) */
  flush(): Promise<SaveOutcome | 'clean'>
  /** Після конфлікту: вчитель вирішив — дозволити збереження знову */
  resume(): void
  /** Після конфлікту: вчитель узяв збережену версію — локальні зміни відкинуто */
  discard(): void
  dispose(): void
}

export function createAutosave({ save, delayMs = SAVE_DELAY_MS, maxWaitMs = SAVE_MAX_WAIT_MS, retryDelaysMs = RETRY_DELAYS_MS }: AutosaveOptions): Autosave {
  let dirty = false
  let firstChangeAt: number | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let running: Promise<SaveOutcome> | null = null
  let failures = 0
  let blocked = false
  let disposed = false

  const clear = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  const schedule = (ms: number) => {
    clear()
    if (!disposed && !blocked) timer = setTimeout(() => void run(), ms)
  }

  async function run(): Promise<SaveOutcome | 'clean'> {
    clear()
    if (running) {
      await running
      return dirty && !blocked ? run() : 'clean'
    }
    if (!dirty || blocked) return 'clean'
    dirty = false
    firstChangeAt = null
    running = save().catch((): SaveOutcome => 'error')
    const outcome = await running
    running = null
    if (outcome === 'saved') {
      failures = 0
      if (dirty) schedule(delayMs)
    } else if (outcome === 'conflict') {
      dirty = true
      blocked = true
    } else {
      dirty = true
      schedule(retryDelaysMs[Math.min(failures, retryDelaysMs.length - 1)]!)
      failures++
    }
    return outcome
  }

  return {
    changed() {
      if (disposed) return
      dirty = true
      const now = Date.now()
      firstChangeAt ??= now
      if (running) return // після поточного збереження run() запланує наступне
      schedule(Math.max(0, Math.min(delayMs, firstChangeAt + maxWaitMs - now)))
    },
    flush: () => run(),
    resume() {
      blocked = false
      failures = 0
      if (dirty) schedule(0)
    },
    discard() {
      clear()
      dirty = false
      firstChangeAt = null
      blocked = false
      failures = 0
    },
    dispose() {
      disposed = true
      clear()
    },
  }
}
