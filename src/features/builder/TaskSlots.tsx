import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { BuilderTask } from '@/api/builder'
import { bankQuery, copyTask, type BankTask } from '@/api/tasks'
import { LEVEL_OPTIONS, taskPrompt } from '@/features/bank/taskForm'
import t from '@/features/teacher/teacher.module.css'
import { TASKS } from '@/tasks/registry'
import { moveItem, setOwnSimplifiedHomework, setSlotTaskIds, SLOT_MAX, slotTaskIds, slotToParam, slotVisibility, type TaskSlot } from './draft'
import { useBuilder } from './store'
import { countsText, groupCounts, levelCounts, pointsSum, pointsText, type StatTask } from './taskStats'
import b from './builder.module.css'

/*
 * Завдання в блоках «Тренування» і «ДЗ» (SPEC 10.2, 10.3): список з порядком, вибір з банку,
 * «Нове завдання» прямо з блоку (з автододаванням), підсумки. Тренування — лише відкриті завдання,
 * ДЗ — лише захищені; відкрите в ДЗ — через «Створити захищену копію».
 */

const LEVEL = Object.fromEntries(LEVEL_OPTIONS.map((l) => [l.value, l.label]))
const typeLabel = (type: string) => TASKS[type as keyof typeof TASKS]?.label ?? type
const norm = (s: string) => s.toLocaleLowerCase('uk')

interface SlotProps {
  slot: TaskSlot
  ownerId: string
  lessonId: string
  tasks: Record<string, BuilderTask>
  /** Підпис списку для читачів екрана й заголовка */
  label: string
}

/** Діалог «З банку»: пошук, фільтри; потрібного виду — «Додати», відкрите в ДЗ — «Захищена копія й додати» */
function Picker({ slot, ownerId, taken, grade, onAdd, onClose }: {
  slot: TaskSlot
  ownerId: string
  taken: string[]
  grade: number
  onAdd: (taskId: string) => void
  onClose: () => void
}) {
  const qc = useQueryClient()
  const bank = useQuery(bankQuery(ownerId))
  const need = slotVisibility(slot)
  const [q, setQ] = useState('')
  const [level, setLevel] = useState('')
  const [onlyGrade, setOnlyGrade] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const first = useRef<HTMLInputElement>(null)

  useEffect(() => {
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const list = useMemo(() => {
    const query = norm(q.trim())
    return (bank.data ?? []).filter(
      (x) =>
        !x.archived &&
        !taken.includes(x.id) &&
        (need === 'secure' || x.visibility === 'open') && // тренування — лише відкриті
        (!query || norm(x.prompt).includes(query)) &&
        (!level || x.level === level) &&
        (!onlyGrade || x.grade === grade || x.grade === null || x.usage.some((u) => u.grade === grade)),
    )
  }, [bank.data, taken, need, q, level, onlyGrade, grade])

  const add = async (x: BankTask) => {
    setError(null)
    if (x.visibility === need) return onAdd(x.id)
    setBusy(x.id)
    try {
      const copy = await copyTask(x.id, 'secure')
      await qc.invalidateQueries({ queryKey: ['t', 'bank'] })
      onAdd(copy)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося створити копію')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={b.overlay}>
      <section className={b.dialog} style={{ width: 'min(820px, 100%)' }} role="dialog" aria-modal="true" aria-labelledby="picker-title">
        <h2 id="picker-title" className={t.h2}>
          {need === 'open' ? 'Відкриті завдання для тренування' : 'Захищені завдання для ДЗ'}
        </h2>
        <p className={t.note} style={{ maxWidth: 'none' }}>
          {need === 'open'
            ? 'У тренуванні — лише відкриті завдання: учень перевіряє відповідь одразу.'
            : 'У ДЗ — лише захищені: відповідь бачить тільки сервер. Для відкритого завдання створиться захищена копія.'}
        </p>
        <div className={t.fieldRow}>
          <label className={t.field} style={{ flexBasis: 260 }}>
            <span className={t.fieldLabel}>Пошук</span>
            <input ref={first} className={t.input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Текст завдання" />
          </label>
          <label className={t.field} style={{ flexBasis: 160, flexGrow: 0 }}>
            <span className={t.fieldLabel}>Рівень</span>
            <select className={t.select} value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">Усі</option>
              {LEVEL_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className={t.check}>
            <input type="checkbox" checked={onlyGrade} onChange={(e) => setOnlyGrade(e.target.checked)} />
            Лише {grade} клас
          </label>
        </div>
        {error && (
          <p className={t.alert} role="alert">
            {error}
          </p>
        )}
        <div style={{ maxHeight: '50dvh', overflow: 'auto' }}>
          {bank.isPending ? (
            <p className={t.note} aria-busy="true">
              Завантажуємо банк…
            </p>
          ) : list.length === 0 ? (
            <p className={t.empty}>Немає завдань за цими умовами. Створи нове — кнопка «Нове завдання» в блоці.</p>
          ) : (
            <table className={t.table} aria-label="Завдання банку">
              <tbody>
                {list.map((x) => (
                  <tr key={x.id}>
                    <td className={t.strong}>{x.prompt || 'Без тексту'}</td>
                    <td className={t.muted} style={{ whiteSpace: 'nowrap' }}>
                      {typeLabel(x.type)} · {LEVEL[x.level] ?? x.level} · {x.grp}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className={t.btnSmall}
                        disabled={busy !== null}
                        aria-busy={busy === x.id}
                        aria-label={`${x.visibility === need ? 'Додати' : 'Захищена копія й додати'}: ${x.prompt}`}
                        onClick={() => void add(x)}
                      >
                        {x.visibility === need ? 'Додати' : 'Захищена копія й додати'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className={t.footerActions}>
          <button type="button" className={t.btn} onClick={onClose}>
            Готово
          </button>
        </div>
      </section>
    </div>
  )
}

const Arrow = ({ up }: { up?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
  </svg>
)

/** Список завдань одного місця: порядок, прибрати, «з банку», «Нове завдання», підсумок */
export function TaskSlotList({ slot, ownerId, lessonId, tasks, label, summary }: SlotProps & { summary: (list: StatTask[]) => string }) {
  const navigate = useNavigate()
  const draft = useBuilder((s) => s.draft)!
  const edit = useBuilder((s) => s.edit)
  const [picking, setPicking] = useState(false)
  const ids = slotTaskIds(draft, slot)
  const set = (next: string[]) => edit((d) => setSlotTaskIds(d, slot, next))
  const full = ids.length >= SLOT_MAX[slot.role]
  const loaded = ids.flatMap((id) => (tasks[id] ? [tasks[id]] : []))
  // Завдання вже в іншому місці уроку — не пропонувати знову (одне завдання не буває і в тренуванні, і в ДЗ)
  const takenElsewhere = [
    ...draft.blocks.flatMap((x) => (x.type === 'practice' ? x.taskIds : [])),
    ...(draft.homework?.taskIds ?? []),
    ...(draft.simplified?.homeworkTaskIds ?? []),
  ]

  return (
    <div className={b.slot} role="group" aria-label={label}>
      {ids.length === 0 ? (
        <p className={t.empty}>Завдань ще немає.</p>
      ) : (
        <ol className={b.slotList} aria-label={label}>
          {ids.map((id, i) => {
            const x = tasks[id]
            const name = x ? taskPrompt(x.content) : 'Завантаження…'
            return (
              <li key={id} className={b.slotItem}>
                <span className={b.slotText}>
                  {name}
                  {x && (
                    <span className={b.outlineMeta} style={{ display: 'block' }}>
                      {typeLabel(x.type)} · {LEVEL[x.level] ?? x.level} · {x.grp} · {pointsText(x.points)}
                      {x.visibility !== slotVisibility(slot) && ' · не того виду — заміни'}
                    </span>
                  )}
                </span>
                <button type="button" className={b.iconBtn} disabled={i === 0} onClick={() => set(moveItem(ids, i, i - 1))} aria-label={`${name} — вище`}>
                  <Arrow up />
                </button>
                <button type="button" className={b.iconBtn} disabled={i === ids.length - 1} onClick={() => set(moveItem(ids, i, i + 1))} aria-label={`${name} — нижче`}>
                  <Arrow />
                </button>
                <button type="button" className={b.iconBtn} onClick={() => set(ids.filter((x2) => x2 !== id))} aria-label={`Прибрати: ${name}`}>
                  ×
                </button>
              </li>
            )
          })}
        </ol>
      )}
      <div className={t.actions}>
        <button type="button" className={b.addInline} disabled={full} onClick={() => setPicking(true)}>
          + з банку
        </button>
        <button
          type="button"
          className={b.addInline}
          disabled={full}
          onClick={() => void navigate({ to: '/t/tasks/new', search: { lesson: lessonId, slot: slotToParam(slot) } })}
        >
          + нове завдання
        </button>
        <span className={b.slotSummary} role="status" aria-live="polite">
          {full ? `Найбільше ${SLOT_MAX[slot.role]} завдань. ` : ''}
          {summary(loaded)}
        </span>
      </div>
      {picking && (
        <Picker
          slot={slot}
          ownerId={ownerId}
          taken={takenElsewhere}
          grade={draft.grade}
          onAdd={(id) => set([...slotTaskIds(useBuilder.getState().draft!, slot), id])}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}

const practiceSummary = (list: StatTask[]) => (list.length ? `За рівнями: ${countsText(levelCounts(list))}` : '')

const homeworkSummary = (list: StatTask[]) =>
  list.length ? `Разом ${pointsText(pointsSum(list))} · рівні: ${countsText(levelCounts(list))} · ${countsText(groupCounts(list))}` : ''

export function PracticeTasks({ blockId, ...rest }: Omit<SlotProps, 'slot' | 'label'> & { blockId: string }) {
  return <TaskSlotList {...rest} slot={{ role: 'practice', blockId }} label="Завдання тренування" summary={practiceSummary} />
}

/** ДЗ: основний варіант і (за бажанням) окремі завдання для спрощеного режиму */
export function HomeworkTasks(rest: Omit<SlotProps, 'slot' | 'label'>) {
  const draft = useBuilder((s) => s.draft)!
  const edit = useBuilder((s) => s.edit)
  const ownSimplified = draft.simplified?.homeworkTaskIds !== undefined
  return (
    <>
      <span className={t.fieldLabel}>Основний варіант</span>
      <TaskSlotList {...rest} slot={{ role: 'homework' }} label="Завдання ДЗ" summary={homeworkSummary} />
      <label className={t.check}>
        <input type="checkbox" checked={ownSimplified} onChange={(e) => edit((d) => setOwnSimplifiedHomework(d, e.target.checked))} />
        Окремі завдання ДЗ для спрощеного режиму
      </label>
      {ownSimplified ? (
        <>
          <span className={t.fieldLabel}>Спрощений варіант</span>
          <TaskSlotList {...rest} slot={{ role: 'homeworkSimplified' }} label="Завдання ДЗ спрощеного варіанта" summary={homeworkSummary} />
        </>
      ) : (
        <p className={t.note}>У спрощеному режимі учень отримує те саме ДЗ.</p>
      )}
    </>
  )
}
