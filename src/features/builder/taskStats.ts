import { LEVEL_OPTIONS } from '@/features/bank/taskForm'

/*
 * Підсумки списку завдань у блоці (SPEC 10.2): у тренуванні — кількість за рівнями; у ДЗ —
 * сума балів і розподіл за рівнями та ГР. Чисті функції — для блоку й тестів.
 */

export interface StatTask {
  level: string
  grp: string
  points: number
}

export interface Count {
  key: string
  label: string
  count: number
}

export function levelCounts(tasks: StatTask[]): Count[] {
  return LEVEL_OPTIONS.map((l) => ({ key: l.value, label: l.label, count: tasks.filter((t) => t.level === l.value).length })).filter((c) => c.count > 0)
}

export function groupCounts(tasks: StatTask[]): Count[] {
  return ['ГР1', 'ГР2', 'ГР3'].map((g) => ({ key: g, label: g, count: tasks.filter((t) => t.grp === g).length })).filter((c) => c.count > 0)
}

export const pointsSum = (tasks: StatTask[]) => Math.round(tasks.reduce((s, t) => s + t.points, 0) * 2) / 2

/** «Базовий 2 · Середній 1» */
export const countsText = (counts: Count[]) => counts.map((c) => `${c.label} ${c.count}`).join(' · ')

/** Бали українською: 1 бал, 2 бали, 5 балів, 2,5 бала */
export function pointsText(n: number): string {
  const s = String(n).replace('.', ',')
  if (!Number.isInteger(n)) return `${s} бала`
  const d = n % 10
  const dd = n % 100
  if (d === 1 && dd !== 11) return `${s} бал`
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return `${s} бали`
  return `${s} балів`
}
