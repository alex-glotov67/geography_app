import { addToSlot, setOwnSimplifiedHomework, setSlotTaskIds, slotTaskIds, slotVisibility, type LessonDraftState } from './draft'
import { countsText, groupCounts, levelCounts, pointsSum, pointsText } from './taskStats'

const draft = (over: Partial<LessonDraftState> = {}): LessonDraftState => ({
  slug: 'g8-u05', grade: 8, sectionId: null, number: 5, title: 'Т', textbookRef: null, ktpRef: null,
  blocks: [{ id: 'p1', type: 'practice', simplified: true, taskIds: ['a'] }], homework: null, simplified: null, outcomeIds: [], ...over,
})

describe('завдання в тренуванні й ДЗ (SPEC 10.2)', () => {
  it('місця: тренування — відкриті, ДЗ — захищені; додавання без дублів і в межах ліміту', () => {
    expect(slotVisibility({ role: 'practice', blockId: 'p1' })).toBe('open')
    expect(slotVisibility({ role: 'homework' })).toBe('secure')
    expect(slotVisibility({ role: 'homeworkSimplified' })).toBe('secure')

    let d = addToSlot(draft(), { role: 'practice', blockId: 'p1' }, 'b')
    d = addToSlot(d, { role: 'practice', blockId: 'p1' }, 'a')
    expect(slotTaskIds(d, { role: 'practice', blockId: 'p1' })).toEqual(['a', 'b'])
    d = addToSlot(d, { role: 'homework' }, 'h1')
    expect(d.homework).toEqual({ taskIds: ['h1'] })
    d = setSlotTaskIds(d, { role: 'homeworkSimplified' }, ['s1', 's2', 's3', 's4', 's5', 's6', 's7'])
    expect(d.simplified?.homeworkTaskIds).toHaveLength(6)
  })

  it('окреме ДЗ спрощеного варіанта вмикається й вимикається, не чіпаючи спрощених блоків', () => {
    const d = setOwnSimplifiedHomework(draft({ simplified: { blocks: [] } }), true)
    expect(d.simplified).toEqual({ blocks: [], homeworkTaskIds: [] })
    expect(setOwnSimplifiedHomework(d, false).simplified).toEqual({ blocks: [] })
    expect(setOwnSimplifiedHomework(setOwnSimplifiedHomework(draft(), true), false).simplified).toBeNull()
  })

  it('підсумки: за рівнями, за ГР, сума балів українською', () => {
    const tasks = [
      { level: 'base', grp: 'ГР1', points: 1 },
      { level: 'high', grp: 'ГР3', points: 2 },
      { level: 'base', grp: 'ГР2', points: 1.5 },
    ]
    expect(countsText(levelCounts(tasks))).toBe('Базовий 2 · Високий 1')
    expect(countsText(groupCounts(tasks))).toBe('ГР1 1 · ГР2 1 · ГР3 1')
    expect(pointsSum(tasks)).toBe(4.5)
    expect([pointsText(1), pointsText(3), pointsText(5), pointsText(11), pointsText(22), pointsText(4.5)]).toEqual(['1 бал', '3 бали', '5 балів', '11 балів', '22 бали', '4,5 бала'])
  })
})
