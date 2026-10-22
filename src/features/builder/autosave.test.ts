import { createAutosave, type SaveOutcome } from './autosave'

const setup = (outcomes: SaveOutcome[] = []) => {
  const save = vi.fn(async (): Promise<SaveOutcome> => outcomes.shift() ?? 'saved')
  return { save, a: createAutosave({ save, delayMs: 2000, maxWaitMs: 10000, retryDelaysMs: [5000, 10000] }) }
}

describe('автозбереження (SPEC 10.1)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('зберігає через 2 с після останньої зміни', async () => {
    const { save, a } = setup()
    a.changed()
    await vi.advanceTimersByTimeAsync(1500)
    a.changed()
    await vi.advanceTimersByTimeAsync(1999)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('безперервні правки — не рідше ніж раз на 10 с', async () => {
    const { save, a } = setup()
    for (let t = 0; t < 10_000; t += 1000) {
      a.changed()
      await vi.advanceTimersByTimeAsync(1000)
    }
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('flush — одразу; без змін нічого не зберігає', async () => {
    const { save, a } = setup()
    expect(await a.flush()).toBe('clean')
    a.changed()
    expect(await a.flush()).toBe('saved')
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('зміна під час збереження — ще одне збереження після', async () => {
    let release!: () => void
    const save = vi.fn(() => new Promise<SaveOutcome>((r) => (release = () => r('saved'))))
    const a = createAutosave({ save, delayMs: 2000 })
    a.changed()
    const first = a.flush()
    a.changed()
    release()
    await first
    await vi.advanceTimersByTimeAsync(2000)
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('помилка мережі — повтор через 5 с, потім 10 с', async () => {
    const { save, a } = setup(['error', 'error', 'saved'])
    a.changed()
    await a.flush()
    await vi.advanceTimersByTimeAsync(5000)
    expect(save).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(9999)
    expect(save).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(3)
  })

  it('конфлікт зупиняє збереження до рішення; resume — зберегти, discard — відкинути', async () => {
    const { save, a } = setup(['conflict'])
    a.changed()
    expect(await a.flush()).toBe('conflict')
    a.changed()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(save).toHaveBeenCalledTimes(1)
    a.resume()
    await vi.advanceTimersByTimeAsync(0)
    expect(save).toHaveBeenCalledTimes(2)

    const b = setup(['conflict'])
    b.a.changed()
    await b.a.flush()
    b.a.discard()
    expect(await b.a.flush()).toBe('clean')
    expect(b.save).toHaveBeenCalledTimes(1)
  })
})
