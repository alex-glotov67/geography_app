import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Me } from '@/api/auth'
import { archiveOutcomes, directoryCsv, directoryQuery, type DirSection } from '@/api/builder'
import { ACCEPT, ImportFileError, readGrid } from '@/features/import/adapters/readGrid'
import { TeacherPageSkeleton } from '@/features/teacher/TeacherSkeletons'
import t from '@/features/teacher/teacher.module.css'
import { tableFromRows } from '@/lib/csv'
import { parseOutcomesTable, planOutcomes, type OutcomePlan, type OutcomeRow, type RowError } from '@/lib/outcomes'
import { applyOutcomes } from '@/lib/outcomesDb'
import { getSupabase } from '@/supabase'

/*
 * Довідник програми (SPEC 10.6): розділ → тема → очікуваний результат. Імпорт CSV чи XLSX
 * з екраном перевірки перед записом; повторний імпорт не дублює (зіставлення за кодом або
 * «тема + текст»); відсутні у файлі результати не видаляються — вчитель може архівувати.
 */

type Teacher = Extract<Me, { kind: 'teacher' }>

interface Pending {
  fileName: string
  encoding: string
  rows: OutcomeRow[]
  errors: RowError[]
  plan: OutcomePlan
}

/** Наявний довідник у формі, яку чекає planOutcomes */
function existing(dir: DirSection[]) {
  return {
    sections: dir.map((s) => ({ id: s.id, grade: s.grade, number: s.number, title: s.title })),
    topics: dir.flatMap((s) => s.topics.map((tp) => ({ id: tp.id, grade: s.grade, sectionNumber: s.number, number: tp.number, title: tp.title }))),
    outcomes: dir.flatMap((s) =>
      s.topics.flatMap((tp) =>
        tp.outcomes.map((o) => ({
          id: o.id, code: o.code, grade: s.grade, sectionNumber: s.number, topicNumber: tp.number, text: o.text, source: o.source, archived: o.archived,
        })),
      ),
    ),
  }
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  URL.revokeObjectURL(url)
}

export function OutcomesPage({ me }: { me: Teacher }) {
  const qc = useQueryClient()
  const dir = useQuery(directoryQuery(me.id))
  const [pending, setPending] = useState<Pending | null>(null)
  const [archive, setArchive] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (dir.isPending) return <TeacherPageSkeleton rows={8} />
  if (dir.isError) return <p className={t.alert}>Не вдалося завантажити довідник. Онови сторінку.</p>
  const sections = dir.data
  const total = sections.reduce((n, s) => n + s.topics.reduce((m, tp) => m + tp.outcomes.filter((o) => !o.archived).length, 0), 0)

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setDone(null)
    try {
      const grid = await readGrid(file)
      const parsed = parseOutcomesTable(tableFromRows(grid.rows, grid.encoding ?? 'xlsx'))
      const e = existing(sections)
      setPending({ fileName: file.name, ...parsed, plan: planOutcomes(parsed.rows, e.sections, e.topics, e.outcomes) })
      setArchive(new Set())
    } catch (err) {
      setError(err instanceof ImportFileError ? err.message : 'Не вдалося прочитати файл')
    }
  }

  async function apply() {
    if (!pending) return
    setBusy(true)
    setError(null)
    try {
      const db = await getSupabase()
      const plan = await applyOutcomes(db, pending.rows, { ownerId: me.id, schoolId: me.schoolId })
      await archiveOutcomes([...archive])
      setDone(
        `Імпортовано: результатів нових ${plan.outcomes.create.length}, змінено ${plan.outcomes.update.length}, без змін ${plan.outcomes.unchanged.length}` +
          (archive.size ? `; архівовано ${archive.size}` : ''),
      )
      setPending(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося імпортувати')
    } finally {
      setBusy(false)
      await qc.invalidateQueries({ queryKey: ['t', 'directory'] })
    }
  }

  const p = pending?.plan
  return (
    <>
      <div className={t.pageHead}>
        <h1 className={t.pageTitle}>
          Довідник програми
          <span className={t.pageTitleNote}>
            {sections.length} розділів, {total} результатів
          </span>
        </h1>
        <div className={t.actions}>
          <button type="button" className={t.btn} disabled={!total} onClick={() => download('dovidnyk-programy.csv', directoryCsv(sections))}>
            Експортувати CSV
          </button>
          <label className={t.btnPrimary}>
            Імпортувати файл
            <input
              type="file"
              accept={ACCEPT}
              className="visually-hidden"
              aria-label="Файл довідника (CSV або XLSX)"
              onChange={(e) => {
                void onFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </div>

      {error && (
        <p className={t.alert} role="alert">
          {error}
        </p>
      )}
      {done && (
        <p className={t.success} role="status">
          {done}
        </p>
      )}

      {pending && p && (
        <section className={t.cardAccent} aria-labelledby="check-title">
          <h2 id="check-title" className={t.h2}>
            Перевірка: {pending.fileName}
          </h2>
          {pending.errors.length > 0 ? (
            <>
              <p className={t.alert}>
                {pending.errors.length} помилок — виправ файл і завантаж ще раз. Нічого не записано.
              </p>
              <div className={t.tableWrap}>
                <table className={t.tableBoxed}>
                  <thead>
                    <tr>
                      <th scope="col">Рядок</th>
                      <th scope="col">Помилка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.errors.map((e, i) => (
                      <tr key={i}>
                        <td className={t.num}>{e.line}</td>
                        <td className={t.statusError}>{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <ul className={t.note} style={{ maxWidth: 'none', margin: 0, paddingLeft: 20 }}>
                <li>
                  Розділи: нових {p.sections.create.length}, нова назва {p.sections.rename.length}; теми: нових {p.topics.create.length}, нова назва{' '}
                  {p.topics.rename.length}
                </li>
                <li>
                  Результати: <strong>нових {p.outcomes.create.length}</strong>, змінено {p.outcomes.update.length}, без змін {p.outcomes.unchanged.length}
                </li>
              </ul>
              {p.outcomes.create.length > 0 && (
                <details>
                  <summary className={t.linkBtn}>Нові результати ({p.outcomes.create.length})</summary>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 15 }}>
                    {p.outcomes.create.map((o) => (
                      <li key={o.code}>
                        <span className={t.mono}>{o.code}</span> {o.text}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {p.outcomes.missing.length > 0 && (
                <div className={t.notice}>
                  <p style={{ margin: '0 0 6px' }}>
                    Є в довіднику, але немає у файлі ({p.outcomes.missing.length}). Вони не видаляються; познач, які архівувати — їх не можна
                    буде обрати в нових уроках, а опубліковані уроки не зміняться.
                  </p>
                  {p.outcomes.missing.map((m) => (
                    <label key={m.id} className={t.check} style={{ minHeight: 36 }}>
                      <input
                        type="checkbox"
                        checked={archive.has(m.id)}
                        onChange={(e) => {
                          const next = new Set(archive)
                          if (e.target.checked) next.add(m.id)
                          else next.delete(m.id)
                          setArchive(next)
                        }}
                      />
                      <span>
                        <span className={t.mono}>{m.code}</span> {m.text}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </>
          )}
          <div className={t.footerActions}>
            <button type="button" className={t.btn} onClick={() => setPending(null)} disabled={busy}>
              Скасувати
            </button>
            <button
              type="button"
              className={t.btnPrimary}
              disabled={busy || pending.errors.length > 0}
              onClick={() => void apply()}
              aria-busy={busy}
            >
              {busy ? 'Записуємо…' : 'Імпортувати'}
            </button>
          </div>
        </section>
      )}

      {sections.length === 0 ? (
        <section className={t.card}>
          <p className={t.empty}>
            Довідник порожній. Імпортуй CSV або XLSX у форматі «Код;Клас;№ розділу;Назва розділу;№ теми;Назва теми;Результат;Джерело» —
            результати знадобляться в метаданих уроків.
          </p>
        </section>
      ) : (
        sections.map((s) => (
          <section key={s.id} className={t.card} aria-label={`${s.grade} клас, розділ ${s.number}`}>
            <h2 className={t.h2}>
              {s.grade} клас · {s.number === 0 ? 'Вступ' : `Розділ ${s.number}`}. {s.title}
            </h2>
            {s.topics.map((tp) => (
              <details key={tp.id}>
                <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 500 }}>
                  {tp.number === 0 ? 'Вступ' : `Тема ${tp.number}`}. {tp.title}
                  <span className={t.muted} style={{ marginLeft: 8, fontWeight: 400 }}>
                    ({tp.outcomes.filter((o) => !o.archived).length})
                  </span>
                </summary>
                <ul style={{ margin: '4px 0 8px', paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {tp.outcomes.map((o) => (
                    <li key={o.id} style={{ display: 'flex', gap: 10, fontSize: 15, opacity: o.archived ? 0.55 : 1 }}>
                      <span className={t.mono} style={{ fontSize: 13, color: 'var(--muted)', flexShrink: 0, paddingTop: 2 }}>
                        {o.code}
                      </span>
                      <span>
                        {o.text}
                        {o.archived && <span className={t.muted}> (архів)</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </section>
        ))
      )}
    </>
  )
}
