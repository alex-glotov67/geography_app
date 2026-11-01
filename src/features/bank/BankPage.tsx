import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import type { Me } from '@/api/auth'
import { bankQuery, copyTask, setTaskArchived, type TaskUsage } from '@/api/tasks'
import { TeacherPageSkeleton } from '@/features/teacher/TeacherSkeletons'
import t from '@/features/teacher/teacher.module.css'
import { GRADES } from '@/lib/grades'
import { TASKS } from '@/tasks/registry'
import { EMPTY_FILTERS, filterBank, type Filters } from './filter'
import { GROUP_OPTIONS, LEVEL_OPTIONS } from './taskForm'

/*
 * Банк завдань (SPEC 8.2, 10.3): фільтри (клас, тип, рівень, ГР, відкрите / захищене, архів),
 * пошук, «Де використовується»; «Редагувати», «Дублювати», «Створити захищену копію», «Архівувати».
 */

type Teacher = Extract<Me, { kind: 'teacher' }>

const ROLE: Record<TaskUsage['role'], string> = { practice: 'тренування', homework: 'ДЗ', quiz_pool: 'квіз' }
const LEVEL = Object.fromEntries(LEVEL_OPTIONS.map((l) => [l.value, l.label]))
const typeLabel = (type: string) => TASKS[type as keyof typeof TASKS]?.label ?? type
function Usage({ usage }: { usage: TaskUsage[] }) {
  if (!usage.length) return <span className={t.muted}>ніде</span>
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {usage.map((u) => (
        <li key={`${u.lessonId}-${u.role}`} style={{ fontSize: 14 }}>
          <Link to="/t/lessons/$lessonId" params={{ lessonId: u.lessonId }}>
            {u.grade} кл.{u.lessonNumber ? ` · урок ${u.lessonNumber}` : ''}
          </Link>{' '}
          <span className={t.muted}>
            ({ROLE[u.role]}
            {u.published ? ', опубл.' : ''})
          </span>
        </li>
      ))}
    </ul>
  )
}

export function BankPage({ me }: { me: Teacher }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const bank = useQuery(bankQuery(me.id))
  const [f, setF] = useState<Filters>(EMPTY_FILTERS)
  const [error, setError] = useState<string | null>(null)
  const list = useMemo(() => filterBank(bank.data ?? [], f), [bank.data, f])

  if (bank.isPending) return <TeacherPageSkeleton rows={8} />
  if (bank.isError) return <p className={t.alert}>Не вдалося завантажити банк завдань. Онови сторінку.</p>

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося')
    } finally {
      await qc.invalidateQueries({ queryKey: ['t', 'bank'] })
    }
  }
  const set = (patch: Partial<Filters>) => setF((x) => ({ ...x, ...patch }))
  const select = (label: string, value: string, key: keyof Filters, options: { value: string; label: string }[]) => (
    <label className={t.field} style={{ flexBasis: 150, flexGrow: 0 }}>
      <span className={t.fieldLabel}>{label}</span>
      <select className={t.select} value={value} onChange={(e) => set({ [key]: e.target.value })}>
        <option value="">Усі</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <>
      <div className={t.pageHead}>
        <h1 className={t.pageTitle}>
          Банк завдань
          <span className={t.pageTitleNote}>{(bank.data ?? []).filter((x) => !x.archived).length} завдань</span>
        </h1>
        <div className={t.actions}>
          <Link to="/t/tasks/new" className={t.btnPrimary}>
            Нове завдання
          </Link>
        </div>
      </div>

      <div className={t.fieldRow}>
        <label className={t.field} style={{ flexBasis: 260 }}>
          <span className={t.fieldLabel}>Пошук</span>
          <input className={t.input} type="search" placeholder="Текст завдання" value={f.q} onChange={(e) => set({ q: e.target.value })} />
        </label>
        {select('Клас', f.grade, 'grade', GRADES.map((g) => ({ value: String(g), label: `${g} клас` })))}
        {select('Тип', f.type, 'type', Object.entries(TASKS).map(([value, m]) => ({ value, label: m.label })))}
        {select('Рівень', f.level, 'level', LEVEL_OPTIONS)}
        {select('ГР', f.grp, 'grp', GROUP_OPTIONS)}
        {select('Вид', f.visibility, 'visibility', [
          { value: 'open', label: 'Відкриті (тренування)' },
          { value: 'secure', label: 'Захищені (ДЗ, квіз)' },
        ])}
        <label className={t.check}>
          <input type="checkbox" checked={f.archived} onChange={(e) => set({ archived: e.target.checked })} />
          Архів
        </label>
      </div>

      {error && (
        <p className={t.alert} role="alert">
          {error}
        </p>
      )}

      <section className={t.card} aria-label="Завдання">
        {list.length === 0 ? (
          <p className={t.empty}>
            {(bank.data ?? []).length === 0 ? 'Завдань ще немає — створи перше.' : 'За цими фільтрами нічого немає.'}
          </p>
        ) : (
          <div className={t.tableWrap}>
            <table className={t.table}>
              <thead>
                <tr>
                  <th scope="col">Завдання</th>
                  <th scope="col">Тип</th>
                  <th scope="col">Рівень · ГР · бали</th>
                  <th scope="col">Вид</th>
                  <th scope="col">Де використовується</th>
                  <th scope="col">
                    <span className="visually-hidden">Дії</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((x) => (
                  <tr key={x.id} className={x.archived ? t.rowArchived : undefined}>
                    <td style={{ maxWidth: 360 }}>
                      <Link to="/t/tasks/$taskId" params={{ taskId: x.id }} className={t.strong} style={{ color: 'var(--ink)' }}>
                        {x.prompt || 'Без тексту'}
                      </Link>
                    </td>
                    <td>{typeLabel(x.type)}</td>
                    <td>
                      {LEVEL[x.level] ?? x.level} · {x.grp} · {x.points}
                    </td>
                    <td>{x.visibility === 'open' ? 'відкрите' : 'захищене'}</td>
                    <td>
                      <Usage usage={x.usage} />
                    </td>
                    <td>
                      <div className={t.actions} style={{ flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className={t.btnSmall}
                          aria-label={`Дублювати: ${x.prompt}`}
                          onClick={() => void run(async () => navigate({ to: '/t/tasks/$taskId', params: { taskId: await copyTask(x.id) } }))}
                        >
                          Дублювати
                        </button>
                        {x.visibility === 'open' && (
                          <button
                            type="button"
                            className={t.btnSmall}
                            aria-label={`Створити захищену копію: ${x.prompt}`}
                            onClick={() => void run(async () => navigate({ to: '/t/tasks/$taskId', params: { taskId: await copyTask(x.id, 'secure') } }))}
                          >
                            Захищена копія
                          </button>
                        )}
                        <button
                          type="button"
                          className={t.btnSmall}
                          aria-label={`${x.archived ? 'Повернути з архіву' : 'Архівувати'}: ${x.prompt}`}
                          onClick={() => void run(() => setTaskArchived(x.id, !x.archived))}
                        >
                          {x.archived ? 'Повернути' : 'Архівувати'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
