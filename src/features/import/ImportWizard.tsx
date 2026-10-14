import { useMemo, useState } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import type { NewStudent, SkippedStudent } from '@shared/schemas/students.ts'
import { classStudentsQuery, createClass, manageStudents, type ClassItem } from '@/api/teacher'
import { useCredentials } from '@/stores/credentials'
import t from '@/features/teacher/teacher.module.css'
import { ACCEPT, ImportFileError, readGrid, type Grid } from './adapters/readGrid'
import { detectMapping, missingClasses, parseRoster, planRoster, type Mapping, type PlannedRow } from './roster'

/*
 * Майстер «Імпорт учнів» (SPEC 5.2, макет TeacherClass.dc.html): 1. Файл → 2. Стовпці й перевірка →
 * 3. Логіни. Розбір файлу — на клієнті; акаунти створює manage-students. Повторний імпорт не
 * дублює учнів; неоднозначні рядки вчитель позначає сам («Це інший учень»).
 */

const MAX_PER_REQUEST = 60

const STATUS_TEXT: Record<PlannedRow['status'], string> = {
  new: 'Новий учень',
  exists: 'Уже є в класі, пропустити',
  duplicate: 'Двічі у файлі, пропустити',
  error: '',
}

const SKIP_TEXT: Record<SkippedStudent['reason'], string> = {
  same_name: 'уже є в класі',
  login_taken: 'логін зайнятий (залишився з минулого року?) — додай учня ще раз',
  class_full: 'у класі вже 99 учнів',
  archived: 'в архіві',
}

const colName = (i: number) => String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : '')

interface Props {
  current: ClassItem
  /** Усі класи вчителя — для розподілу за стовпцем «Клас» */
  classes: ClassItem[]
  onClose: () => void
}

type Result = { created: number; skipped: (SkippedStudent & { className: string })[]; newClasses: string[] }

export function ImportWizard({ current, classes, onClose }: Props) {
  const qc = useQueryClient()
  const addCredentials = useCredentials((s) => s.add)
  const [fileName, setFileName] = useState<string | null>(null)
  const [grid, setGrid] = useState<Grid | null>(null)
  const [mapping, setMapping] = useState<Mapping | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  /** Рядки (за номером у файлі), які вчитель позначив «Це інший учень» */
  const [override, setOverride] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  // Класи того самого навчального року — кандидати для стовпця «Клас»
  const sameYear = useMemo(() => classes.filter((c) => c.schoolYear === current.schoolYear && !c.archived), [classes, current])
  const students = useQueries({ queries: sameYear.map((c) => classStudentsQuery(c.id)) })
  const studentsReady = students.every((q) => q.isSuccess)

  const plan = useMemo(() => {
    if (!grid || !mapping || !studentsReady) return null
    const existing = new Map(sameYear.map((c, i) => [c.name, new Set((students[i]!.data ?? []).map((s) => s.nameKey))]))
    return planRoster(parseRoster(grid.rows, mapping), current.name, existing)
  }, [grid, mapping, studentsReady, students, sameYear, current.name])

  const willCreate = plan?.filter((r) => r.status === 'new' || (override.has(r.line) && r.status !== 'error')) ?? []
  const toCreateClasses = plan ? missingClasses(plan, sameYear.map((c) => c.name)) : []
  const step = result ? 3 : grid ? 2 : 1
  const width = grid ? Math.max(0, ...grid.rows.slice(0, 50).map((r) => r.length)) : 0
  const header = grid && mapping?.headerRow ? grid.rows[0]! : []
  const columns = Array.from({ length: width }, (_, i) => ({ i, label: `${colName(i)}${header[i] ? `: ${header[i]}` : ''}` }))

  async function onFile(file: File | undefined) {
    if (!file) return
    setFileError(null)
    setOverride(new Set())
    try {
      const g = await readGrid(file)
      if (!g.rows.length) throw new ImportFileError('Файл порожній')
      setGrid(g)
      setMapping(detectMapping(g.rows))
      setFileName(file.name)
    } catch (e) {
      setFileError(e instanceof ImportFileError ? e.message : 'Не вдалося прочитати файл')
    }
  }

  async function confirm() {
    if (!plan) return
    setBusy(true)
    setError(null)
    const out: Result = { created: 0, skipped: [], newClasses: [] }
    try {
      const ids = new Map(sameYear.map((c) => [c.name, c.id]))
      for (const name of toCreateClasses) {
        ids.set(name, await createClass(name, current.schoolYear))
        out.newClasses.push(name)
      }
      const byClass = new Map<string, NewStudent[]>()
      for (const r of willCreate) {
        const list = byClass.get(r.target) ?? []
        list.push({ lastName: r.lastName, firstInitial: r.firstInitial, ...(override.has(r.line) ? { allowSameName: true } : {}) })
        byClass.set(r.target, list)
      }
      for (const [name, list] of byClass) {
        const classId = ids.get(name)!
        for (let i = 0; i < list.length; i += MAX_PER_REQUEST) {
          const res = await manageStudents({ action: 'create', classId, students: list.slice(i, i + MAX_PER_REQUEST) })
          if ('credentials' in res) {
            addCredentials(classId, res.credentials)
            out.created += res.credentials.length
            out.skipped.push(...res.skipped.map((s) => ({ ...s, className: name })))
          }
        }
      }
      setResult(out)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося створити акаунти')
      if (out.created || out.newClasses.length) setResult(out)
    } finally {
      setBusy(false)
      await qc.invalidateQueries({ queryKey: ['t'] })
    }
  }

  const setName = (name: Mapping['name']) => mapping && setMapping({ ...mapping, name })

  return (
    <section className={t.cardAccent} aria-labelledby="import-title">
      <div className={t.cardHead}>
        <h2 id="import-title" className={t.h2}>
          Імпорт учнів зі списку
        </h2>
        <ol className={t.steps} aria-label="Кроки">
          {['Файл', 'Стовпці', 'Логіни'].map((label, i) => (
            <li
              key={label}
              className={t.step}
              data-state={i + 1 < step ? 'done' : i + 1 === step ? 'current' : 'todo'}
              aria-current={i + 1 === step ? 'step' : undefined}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>
      </div>

      {step === 1 && (
        <>
          <p className={t.note}>
            Підходить експорт з електронного журналу, Excel (.xlsx, .xls) або CSV (UTF-8 чи Windows-1251). Потрібен стовпець з прізвищем та
            ім'ям; якщо у файлі кілька класів — ще й стовпець «Клас». Зберігаються лише прізвище й ініціал.
          </p>
          <label className={t.field} style={{ maxWidth: 420 }}>
            <span className={t.fieldLabel}>Файл зі списком</span>
            <input type="file" accept={ACCEPT} className={t.input} style={{ paddingTop: 9 }} onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
          {fileError && (
            <p className={t.alert} role="alert">
              {fileError}
            </p>
          )}
        </>
      )}

      {step === 2 && grid && mapping && (
        <>
          <p className={t.note} style={{ maxWidth: 'none' }}>
            Файл <strong>{fileName}</strong>: {grid.rows.length - (mapping.headerRow ? 1 : 0)} рядків
            {grid.encoding === 'windows-1251' ? ' (кодування Windows-1251)' : ''}.{' '}
            <button type="button" className={t.linkBtn} onClick={() => setGrid(null)}>
              Інший файл
            </button>
          </p>
          <div className={t.fieldRow}>
            {mapping.name.mode === 'full' ? (
              <label className={t.field}>
                <span className={t.fieldLabel}>Стовпець «ПІБ» — прізвище та ім'я разом</span>
                <select className={t.select} value={mapping.name.col} onChange={(e) => setName({ mode: 'full', col: Number(e.target.value) })}>
                  {columns.map((c) => (
                    <option key={c.i} value={c.i}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className={t.field}>
                  <span className={t.fieldLabel}>Стовпець «Прізвище»</span>
                  <select className={t.select} value={mapping.name.last} onChange={(e) => setName({ ...(mapping.name as { mode: 'split'; last: number; first: number }), last: Number(e.target.value) })}>
                    {columns.map((c) => (
                      <option key={c.i} value={c.i}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={t.field}>
                  <span className={t.fieldLabel}>Стовпець «Ім'я»</span>
                  <select className={t.select} value={mapping.name.first} onChange={(e) => setName({ ...(mapping.name as { mode: 'split'; last: number; first: number }), first: Number(e.target.value) })}>
                    {columns.map((c) => (
                      <option key={c.i} value={c.i}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label className={t.field}>
              <span className={t.fieldLabel}>Стовпець «Клас»</span>
              <select
                className={t.select}
                value={mapping.classCol ?? ''}
                onChange={(e) => setMapping({ ...mapping, classCol: e.target.value === '' ? null : Number(e.target.value) })}
              >
                <option value="">Немає — усі в {current.name}</option>
                {columns.map((c) => (
                  <option key={c.i} value={c.i}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={t.field}>
              <span className={t.fieldLabel}>Зберігати як</span>
              <select className={t.select} disabled value="initial">
                <option value="initial">Прізвище та ініціал (Коваль О.)</option>
              </select>
            </label>
          </div>
          <div className={t.fieldRow}>
            <label className={t.check}>
              <input
                type="checkbox"
                checked={mapping.name.mode === 'split'}
                onChange={(e) =>
                  setName(e.target.checked ? { mode: 'split', last: 0, first: Math.min(1, width - 1) } : { mode: 'full', col: 0 })
                }
              />
              Прізвище й ім'я в різних стовпцях
            </label>
            <label className={t.check}>
              <input type="checkbox" checked={mapping.headerRow} onChange={(e) => setMapping({ ...mapping, headerRow: e.target.checked })} />
              Перший рядок — заголовок
            </label>
          </div>

          {!plan ? (
            <p className={t.note} aria-busy="true">
              Звіряємо з учнями класу…
            </p>
          ) : (
            <div className={t.tableWrap}>
              <table className={t.tableBoxed}>
                <thead>
                  <tr>
                    <th scope="col">Рядок</th>
                    <th scope="col">У файлі</th>
                    <th scope="col">Буде збережено</th>
                    {mapping.classCol !== null && <th scope="col">Клас</th>}
                    <th scope="col">Перевірка</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.map((r) => (
                    <tr key={r.line}>
                      <td className={t.num}>{r.line}</td>
                      <td>{r.source || '—'}</td>
                      <td className={t.strong}>{r.status === 'error' ? '' : `${r.lastName} ${r.firstInitial}.`}</td>
                      {mapping.classCol !== null && <td>{r.target}</td>}
                      <td>
                        {r.status === 'error' ? (
                          <span className={t.statusError}>{r.error}</span>
                        ) : r.status === 'new' ? (
                          <span className={t.statusNew}>{STATUS_TEXT.new}</span>
                        ) : (
                          <label className={t.check} style={{ minHeight: 0, gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={override.has(r.line)}
                              onChange={(e) => {
                                const next = new Set(override)
                                if (e.target.checked) next.add(r.line)
                                else next.delete(r.line)
                                setOverride(next)
                              }}
                            />
                            <span className={override.has(r.line) ? t.statusNew : t.statusSkip}>
                              {override.has(r.line) ? 'Це інший учень — додати' : STATUS_TEXT[r.status]}
                            </span>
                          </label>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {toCreateClasses.length > 0 && (
            <p className={t.notice}>
              Буде створено {toCreateClasses.length > 1 ? 'класи' : 'клас'} {toCreateClasses.join(', ')} ({current.schoolYear}).
            </p>
          )}
          {error && (
            <p className={t.alert} role="alert">
              {error}
            </p>
          )}
          <div className={t.footerActions}>
            <button type="button" className={t.btn} onClick={onClose} disabled={busy}>
              Скасувати
            </button>
            <button type="button" className={t.btnPrimary} disabled={!willCreate.length || busy} onClick={() => void confirm()} aria-busy={busy}>
              {busy ? 'Створюємо акаунти…' : `Додати ${willCreate.length} ${willCreate.length === 1 ? 'учня' : 'учнів'} і створити логіни`}
            </button>
          </div>
        </>
      )}

      {step === 3 && result && (
        <>
          <p className={t.success} role="status">
            Додано {result.created} {result.created === 1 ? 'учня' : 'учнів'}
            {result.newClasses.length ? `; створено ${result.newClasses.join(', ')}` : ''}. Логіни й паролі — у таблиці нижче: їх видно лише
            зараз, тож одразу надрукуй картки входу.
          </p>
          {result.skipped.length > 0 && (
            <div className={t.notice}>
              Пропущено:
              <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                {result.skipped.map((s, i) => (
                  <li key={i}>
                    {s.displayName} ({s.className}) — {SKIP_TEXT[s.reason]}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && (
            <p className={t.alert} role="alert">
              {error}
            </p>
          )}
          <div className={t.footerActions}>
            <button type="button" className={t.btn} onClick={onClose}>
              Готово
            </button>
          </div>
        </>
      )}
    </section>
  )
}
