import type { Block } from '@shared/schemas/blocks.ts'
import { groupBlocks } from './groupBlocks'

const b = (id: string, type: string) => ({ id, type }) as Block
const ids = (list: Block[]) => groupBlocks(list).map((g) => g.map((x) => x.id).join('+'))

describe('пари «текст + відео» (SPEC 13.4)', () => {
  it('сусідні текст і відео — пара в будь-якому порядку; решта — по одному', () => {
    expect(ids([b('g', 'goal'), b('t', 'text'), b('v', 'video'), b('x', 'terms')])).toEqual(['g', 't+v', 'x'])
    expect(ids([b('v', 'video'), b('t', 'text')])).toEqual(['v+t'])
  })
  it('кожен блок — лише в одній парі; несусідні не об\'єднуються', () => {
    expect(ids([b('t1', 'text'), b('v', 'video'), b('t2', 'text')])).toEqual(['t1+v', 't2'])
    expect(ids([b('t', 'text'), b('i', 'image'), b('v', 'video')])).toEqual(['t', 'i', 'v'])
  })
})
