import { chunk, resetInBatches, type ResetTarget } from './resetBatches'

const students = (n: number): ResetTarget[] =>
  Array.from({ length: n }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, displayName: `Учень${i + 1} А.` }))

const creds = (ids: string[], all: ResetTarget[]) =>
  ids.map((id) => {
    const i = all.findIndex((x) => x.id === id)
    return { id, number: i + 1, displayName: all[i]!.displayName, login: `8b-${String(i + 1).padStart(2, '0')}`, password: 'gora-step-47' }
  })

describe('нові паролі пачками', () => {
  it('30 учнів → 3 пачки по 10; паролі й прогрес — після кожної пачки', async () => {
    const all = students(30)
    const calls: number[] = []
    const progress: number[] = []
    const got: number[] = []
    const r = await resetInBatches(
      all,
      async (ids) => (calls.push(ids.length), { credentials: creds(ids, all), skipped: [] }),
      (b, done) => (progress.push(done), got.push(b.credentials.length)),
    )
    expect(calls).toEqual([10, 10, 10])
    expect(progress).toEqual([10, 20, 30])
    expect(got).toEqual([10, 10, 10])
    expect(r.credentials).toHaveLength(30)
    expect(r.failures).toEqual([])
  })

  it('обрив другої пачки не губить першої й не зупиняє третю; учні пачки — «network»', async () => {
    const all = students(30)
    let n = 0
    const r = await resetInBatches(all, async (ids) => {
      n++
      if (n === 2) throw new Error('fetch failed')
      return { credentials: creds(ids, all), skipped: [] }
    }, () => {})
    expect(r.credentials).toHaveLength(20)
    expect(r.failures).toHaveLength(10)
    expect(r.failures.every((f) => f.reason === 'network')).toBe(true)
    expect(r.failures[0]!.displayName).toBe('Учень11 А.')
  })

  it('збій окремого учня й архів — з відповіді функції (з id і без id від старої функції)', async () => {
    const all = students(3)
    const r = await resetInBatches(all, async () => ({
      credentials: creds([all[0]!.id], all),
      skipped: [
        { id: all[1]!.id, displayName: all[1]!.displayName, reason: 'failed' as const },
        { displayName: all[2]!.displayName, reason: 'archived' as const },
      ],
    }), () => {})
    expect(r.failures.map((f) => [f.displayName, f.reason])).toEqual([['Учень2 А.', 'failed'], ['Учень3 А.', 'archived']])
  })

  it('chunk', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 10)).toEqual([])
  })
})
