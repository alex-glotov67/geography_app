import { useCallback, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import type { Credentials } from '@shared/schemas/students.ts'
import { FirstInitial, LastName } from '@shared/schemas/students.ts'
import type { Me } from '@/api/auth'
import { classesQuery, classStudentsQuery, manageStudents, setSimplified, type StudentItem } from '@/api/teacher'
import { ImportWizard } from '@/features/import/ImportWizard'
import { studentsWord } from '@/lib/plural'
import { useCredentials } from '@/stores/credentials'
import { LoginCards } from './LoginCards'
import { TeacherPageSkeleton } from './TeacherSkeletons'
import t from './teacher.module.css'

/*
 * Клас (SPEC 8.2 «Класи й учні», макет TeacherClass.dc.html): учні, логіни, «Спрощений режим»,
 * останній вхід, «Новий пароль», архів; «Додати учня», «Друкувати картки входу», «Імпортувати
 * список». Стовпця «Пароль» немає: паролі видно лише одразу після створення чи скидання.
 */

const dateFmt = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const lastLogin = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : 'ще не входив(ла)')

type Teacher = Extract<Me, { kind: 'teacher' }>
type Confirm = { kind: 'reset'; students: StudentItem[] } | { kind: 'archive'; student: StudentItem } | null

export function ClassPage({ classId, me, openImport }: { classId: string; me: Teacher; openImport: boolean }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const classes = useQuery(classesQuery())
  const students = useQuery(classStudentsQuery(classId))
  const credentials = useCredentials((s) => s.byClass[classId])
  const addCredentials = useCredentials((s) => s.add)
  const clearCredentials = useCredentials((s) => s.clear)
  const [panel, setPanel] = useState<'import' | 'add' | null>(openImport ? 'import' : null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [printing, setPrinting] = useState<Credentials[] | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stopPrinting = useCallback(() => setPrinting(null), [])

  const refresh = () => qc.invalidateQueries({ queryKey: ['t'] })

  // Оптимістичний UI: значення перемикача — локально, доки запит не завершився (без правок кешу)
  const [pendingSimplified, setPendingSimplified] = useState<Record<string, boolean>>({})
  const simplified = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => setSimplified(id, value),
    onError: () => setError('Не вдалося змінити «Спрощений режим». Спробуй ще раз.'),
    onSettled: async (_d, _e, { id }) => {
      await qc.invalidateQueries({ queryKey: classStudentsQuery(classId).queryKey })
      setPendingSimplified((p) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== id)))
    },
  })
  const toggleSimplified = (id: string, value: boolean) => {
    setPendingSimplified((p) => ({ ...p, [id]: value }))
    simplified.mutate({ id, value })
  }

  const action = useMutation({
    mutationFn: async (c: NonNullable<Confirm>) => {
      if (c.kind === 'reset') {
        const res = await manageStudents({ action: 'reset-password', studentIds: c.students.map((s) => s.id) })
        if ('credentials' in res) addCredentials(classId, res.credentials)
        return res
      }
      return manageStudents({ action: c.student.archived ? 'unarchive' : 'archive', studentIds: [c.student.id] })
    },
    onSuccess: () => {
      setConfirm(null)
      setError(null)
    },
    onError: (e) => setError(e.message),
    onSettled: refresh,
  })

  if (classes.isPending || students.isPending) return <TeacherPageSkeleton rows={8} />
  const cls = classes.data?.find((c) => c.id === classId)
  if (classes.isError || students.isError || !cls) {
    return <p className={t.alert}>Клас не знайдено або не вдалося завантажити. Онови сторінку.</p>
  }

  const active = students.data.filter((s) => !s.archived)
  const archived = students.data.filter((s) => s.archived)
  const fresh = credentials?.filter((c) => active.some((s) => s.id === c.id)) ?? []
  const withoutPassword = active.filter((s) => !fresh.some((c) => c.id === s.id))

  function printAll() {
    // Пароль відомий лише щойно створеним чи скинутим; для решти — спершу новий пароль
    if (withoutPassword.length) setConfirm({ kind: 'reset', students: withoutPassword })
    else setPrinting(fresh)
  }

  return (
    <>
      <div className={t.pageHead}>
        <h1 className={t.pageTitle}>
          {cls.name}
          <span className={t.pageTitleNote}>
            {studentsWord(active.length)}, навчальний рік {cls.schoolYear}
          </span>
        </h1>
        <div className={t.actions}>
          <button type="button" className={t.btn} onClick={() => setPanel(panel === 'add' ? null : 'add')} aria-expanded={panel === 'add'}>
            Додати учня
          </button>
          <button type="button" className={t.btn} onClick={printAll} disabled={!active.length}>
            Друкувати картки входу
          </button>
          <button
            type="button"
            className={t.btnPrimary}
            onClick={() => setPanel(panel === 'import' ? null : 'import')}
            aria-expanded={panel === 'import'}
          >
            Імпортувати список
          </button>
        </div>
      </div>

      {panel === 'import' && (
        <ImportWizard
          current={cls}
          classes={classes.data}
          onClose={() => {
            setPanel(null)
            if (openImport) void navigate({ to: '.', search: {}, replace: true })
          }}
        />
      )}
      {panel === 'add' && <AddStudent classId={classId} onDone={() => setPanel(null)} />}

      {confirm && (
        <section className={t.cardAccent} role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-text">
          <h2 id="confirm-title" className={t.h2}>
            {confirm.kind === 'reset'
              ? 'Нові паролі'
              : confirm.student.archived
                ? `Повернути ${confirm.student.displayName} з архіву?`
                : `Архівувати ${confirm.student.displayName}?`}
          </h2>
          <p id="confirm-text" className={t.note} style={{ maxWidth: 640 }}>
            {confirm.kind === 'reset'
              ? confirm.students.length === 1
                ? `Буде створено новий пароль для ${confirm.students[0]!.displayName}. Старий перестане діяти.`
                : `Паролі не зберігаються, тож для карток буде створено нові паролі для ${studentsWord(confirm.students.length)}. Старі перестануть діяти — роздай нові картки всім.`
              : confirm.student.archived
                ? 'Учень знову зможе входити зі своїм логіном і паролем.'
                : 'Учень, що вибув: вхід вимкнеться, результати збережуться до кінця навчального року.'}
          </p>
          {error && (
            <p className={t.alert} role="alert">
              {error}
            </p>
          )}
          <div className={t.footerActions}>
            <button type="button" className={t.btn} onClick={() => setConfirm(null)} disabled={action.isPending}>
              Скасувати
            </button>
            <button type="button" className={t.btnPrimary} onClick={() => action.mutate(confirm)} disabled={action.isPending} aria-busy={action.isPending}>
              {confirm.kind === 'reset' ? 'Створити нові паролі' : confirm.student.archived ? 'Повернути' : 'Архівувати'}
            </button>
          </div>
        </section>
      )}

      {fresh.length > 0 && (
        <section className={t.card} aria-labelledby="fresh-title">
          <div className={t.cardHead}>
            <h2 id="fresh-title" className={t.h2}>
              Логіни й паролі
            </h2>
            <div className={t.actions}>
              <button type="button" className={t.btnPrimary} onClick={() => setPrinting(fresh)}>
                Друкувати {fresh.length === active.length ? 'картки' : `картки (${fresh.length})`}
              </button>
              <button type="button" className={t.btn} onClick={() => clearCredentials(classId)}>
                Сховати паролі
              </button>
            </div>
          </div>
          <p className={t.notice}>Паролі видно лише зараз — до перезавантаження сторінки чи виходу. Надрукуй картки або перепиши паролі.</p>
          <div className={t.tableWrap}>
            <table className={t.table}>
              <thead>
                <tr>
                  <th scope="col">№</th>
                  <th scope="col">Учень</th>
                  <th scope="col">Логін</th>
                  <th scope="col">Пароль</th>
                </tr>
              </thead>
              <tbody>
                {fresh.map((c) => (
                  <tr key={c.id}>
                    <td className={t.num}>{c.number}</td>
                    <td className={t.strong}>{c.displayName}</td>
                    <td className={t.mono}>{c.login}</td>
                    <td className={t.mono}>{c.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className={t.card} aria-labelledby="students-title">
        <div className={t.cardHead}>
          <h2 id="students-title" className={t.h2}>
            Учні
          </h2>
          <p className={t.note}>
            Паролі не зберігаються у відкритому вигляді: їх видно один раз, одразу після створення, і на картках для друку. Забутий пароль —
            кнопка «Новий пароль».
          </p>
        </div>
        {error && !confirm && (
          <p className={t.alert} role="alert">
            {error}
          </p>
        )}
        {active.length === 0 ? (
          <p className={t.empty}>Учнів ще немає. Імпортуй список класу або додай учня вручну.</p>
        ) : (
          <StudentsTable
            rows={active.map((s) => (s.id in pendingSimplified ? { ...s, simplifiedMode: pendingSimplified[s.id]! } : s))}
            onSimplified={toggleSimplified}
            onReset={(s) => setConfirm({ kind: 'reset', students: [s] })}
            onArchive={(s) => setConfirm({ kind: 'archive', student: s })}
          />
        )}
        {archived.length > 0 && (
          <>
            <button type="button" className={t.linkBtn} onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived}>
              {showArchived ? 'Сховати архів' : `Архів (${archived.length})`}
            </button>
            {showArchived && <StudentsTable rows={archived} onArchive={(s) => setConfirm({ kind: 'archive', student: s })} />}
          </>
        )}
      </section>

      {printing && <LoginCards credentials={printing} className={cls.name} schoolName={me.schoolName} onDone={stopPrinting} />}
    </>
  )
}

function StudentsTable({
  rows,
  onSimplified,
  onReset,
  onArchive,
}: {
  rows: StudentItem[]
  onSimplified?: (id: string, value: boolean) => void
  onReset?: (s: StudentItem) => void
  onArchive: (s: StudentItem) => void
}) {
  return (
    <div className={t.tableWrap}>
      <table className={t.table}>
        <thead>
          <tr>
            <th scope="col">№</th>
            <th scope="col">Учень</th>
            <th scope="col">Логін</th>
            {onSimplified && <th scope="col">Спрощений режим</th>}
            <th scope="col">Останній вхід</th>
            <th scope="col">
              <span className="visually-hidden">Дії</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className={s.archived ? t.rowArchived : undefined}>
              <td className={t.num}>{s.number}</td>
              <td className={t.strong}>{s.displayName}</td>
              <td className={t.mono}>{s.login}</td>
              {onSimplified && (
                <td>
                  <input
                    type="checkbox"
                    role="switch"
                    className={t.switch}
                    checked={s.simplifiedMode}
                    onChange={(e) => onSimplified(s.id, e.target.checked)}
                    aria-label={`Спрощений режим: ${s.displayName}`}
                  />
                </td>
              )}
              <td className={t.muted}>{lastLogin(s.lastLoginAt)}</td>
              <td>
                <div className={t.actions} style={{ flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                  {onReset && (
                    <button type="button" className={t.btnSmall} onClick={() => onReset(s)} aria-label={`Новий пароль: ${s.displayName}`}>
                      Новий пароль
                    </button>
                  )}
                  <button
                    type="button"
                    className={t.btnSmall}
                    onClick={() => onArchive(s)}
                    aria-label={`${s.archived ? 'Повернути з архіву' : 'Архівувати'}: ${s.displayName}`}
                  >
                    {s.archived ? 'Повернути' : 'Архівувати'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const AddStudentForm = z.object({ lastName: LastName, firstInitial: FirstInitial })

/** Один учень вручну (новенький посеред року): прізвище й ініціал, логін — наступний номер */
function AddStudent({ classId, onDone }: { classId: string; onDone: () => void }) {
  const qc = useQueryClient()
  const addCredentials = useCredentials((s) => s.add)
  const [error, setError] = useState<string | null>(null)
  const [sameName, setSameName] = useState(false)
  /** Сервер відповів «такий учень уже є» — показати вибір «це інша людина» */
  const [askSame, setAskSame] = useState(false)
  const { register, handleSubmit, formState, reset } = useForm<z.infer<typeof AddStudentForm>>({
    resolver: zodResolver(AddStudentForm),
  })
  const onSubmit = handleSubmit(async ({ lastName, firstInitial }) => {
    setError(null)
    try {
      const res = await manageStudents({
        action: 'create',
        classId,
        students: [{ lastName, firstInitial: firstInitial.toLocaleUpperCase('uk'), ...(sameName ? { allowSameName: true } : {}) }],
      })
      if ('credentials' in res && res.credentials.length) {
        addCredentials(classId, res.credentials)
        reset()
        setSameName(false)
        setAskSame(false)
        onDone()
      } else if ('skipped' in res && res.skipped[0]?.reason === 'same_name') {
        setAskSame(true)
        setError('Учень з таким прізвищем та ініціалом уже є. Якщо це інша людина — познач нижче й додай ще раз.')
      } else {
        setError('Не вдалося додати учня. Спробуй ще раз.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося додати учня')
    } finally {
      await qc.invalidateQueries({ queryKey: ['t'] })
    }
  })
  return (
    <form className={t.cardAccent} onSubmit={onSubmit} noValidate aria-labelledby="add-title">
      <h2 id="add-title" className={t.h2}>
        Додати учня
      </h2>
      <div className={t.fieldRow}>
        <label className={t.field}>
          <span className={t.fieldLabel}>Прізвище</span>
          <input className={t.input} {...register('lastName')} aria-invalid={!!formState.errors.lastName} autoComplete="off" />
          {formState.errors.lastName && <span className={t.fieldError}>{formState.errors.lastName.message}</span>}
        </label>
        <label className={t.field} style={{ flexGrow: 0, flexBasis: 140 }}>
          <span className={t.fieldLabel}>Ініціал імені</span>
          <input
            className={t.input}
            {...register('firstInitial', { setValueAs: (v: string) => v.trim().toLocaleUpperCase('uk') })}
            maxLength={1}
            aria-invalid={!!formState.errors.firstInitial}
            autoComplete="off"
          />
          {formState.errors.firstInitial && <span className={t.fieldError}>{formState.errors.firstInitial.message}</span>}
        </label>
        <button type="submit" className={t.btnPrimary} disabled={formState.isSubmitting}>
          Додати й створити логін
        </button>
        <button type="button" className={t.btn} onClick={onDone}>
          Скасувати
        </button>
      </div>
      {askSame && (
        <label className={t.check}>
          <input type="checkbox" checked={sameName} onChange={(e) => setSameName(e.target.checked)} />
          Це інший учень з таким самим прізвищем та ініціалом
        </label>
      )}
      {error && (
        <p className={t.alert} role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
