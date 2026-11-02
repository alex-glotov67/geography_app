import { Suspense, useEffect, useId, useMemo, useState } from 'react'
import { Skeleton } from '@mantine/core'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormProvider, useForm, useWatch, type Resolver } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isNotFound, Link, useBlocker, useNavigate } from '@tanstack/react-router'
import { TASK_TYPES, type TaskType } from '@shared/schemas/tasks/index.ts'
import { RevisionConflict } from '@/api/builder'
import { saveTask, taskQuery, type EditableTask, type TaskUsage } from '@/api/tasks'
import b from '@/features/builder/builder.module.css'
import t from '@/features/teacher/teacher.module.css'
import { TeacherPageSkeleton } from '@/features/teacher/TeacherSkeletons'
import { GRADES } from '@/lib/grades'
import { ukErrors } from '@/lib/zodUk'
import { FieldError } from '@/tasks/editorKit'
import { TASK_EDITORS } from '@/tasks/editors'
import { TASKS } from '@/tasks/registry'
import { previewScope } from '@/stores/answers'
import { TaskCard } from '@/tasks/TaskCard'
import { feedbackOf, GROUP_OPTIONS, LEVEL_OPTIONS, taskFormSchema, taskPrompt, type TaskFormValues } from './taskForm'
import k from './bank.module.css'

/*
 * Редактор завдання (SPEC 10.3, макет TaskEditor): тип (для нового — каталог), форма типу і спільні
 * поля, праворуч — «Як побачить учень» (та сама картка, що в тренуванні) і «Спробувати як учень».
 * Збереження — явне («Зберегти завдання»), save_task з ревізією; якщо завдання в опублікованих
 * уроках — спершу попередження з посиланнями. Копія незбереженої форми — у localStorage.
 */

const LEVELS = Object.fromEntries(LEVEL_OPTIONS.map((l) => [l.value, l.label]))
/** «Збережено» для нового завдання — переживає перехід на його адресу (новий екземпляр редактора) */
const FLASH = 'geo-task-saved'
const takeFlash = () => {
  try {
    const m = sessionStorage.getItem(FLASH)
    sessionStorage.removeItem(FLASH)
    return m
  } catch {
    return null
  }
}

const draftKey = (id: string | null) => `geo-task-draft:${id ?? 'new'}`

function readDraft(id: string | null): TaskFormValues | null {
  try {
    const raw = localStorage.getItem(draftKey(id))
    return raw ? (JSON.parse(raw) as TaskFormValues) : null
  } catch {
    return null
  }
}

function writeDraft(id: string | null, v: TaskFormValues | null) {
  try {
    if (v) localStorage.setItem(draftKey(id), JSON.stringify(v))
    else localStorage.removeItem(draftKey(id))
  } catch {
    /* без копії — форма працює й так */
  }
}

/** «Нове завдання» з блоку уроку: куди повернутися й який вид завдання потрібен (тренування — відкрите, ДЗ — захищене) */
export interface ReturnTo {
  lessonId: string
  slot: string
  visibility: 'open' | 'secure'
}

function newValues(type: TaskType, visibility: 'open' | 'secure' = 'open'): TaskFormValues {
  const tpl = TASK_EDITORS[type]!.template()
  return {
    type, level: 'base', grp: 'ГР1', points: 1, visibility, grade: 8, hint: '', feedbackCorrect: '', feedbackIncorrect: '',
    content: tpl.content as Record<string, unknown>, key: tpl.key as Record<string, unknown>,
  }
}

/** Схема залежить від типу завдання — збираємо резолвер під поточний тип */
const resolver: Resolver<TaskFormValues> = (values, ctx, opts) =>
  (zodResolver(taskFormSchema(values.type), { error: ukErrors }) as unknown as Resolver<TaskFormValues>)(values, ctx, opts)

/** Поки вантажиться редактор типу — скелетон тієї ж форми: текст завдання й три рядки (SPEC 13.7) */
function EditorSkeleton() {
  return (
    <div aria-busy="true" aria-label="Завантаження редактора" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Skeleton height={18} width={140} />
      <Skeleton height={72} />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height={44} />
      ))}
    </div>
  )
}

/** «Як побачить учень»: та сама картка, що в тренуванні; без валідного змісту — підказка */
function Preview({ nonce }: { nonce: number }) {
  const v = useWatch<TaskFormValues>() as TaskFormValues
  // Свій ключ відповіді для кожного відкриття редактора й типу — без чужих відповідей у сховищі
  const instance = useId()
  const valid = useMemo(() => taskFormSchema(v.type).safeParse(v).success, [v])
  if (!valid) return <p className={t.note}>Заповни завдання — тут з’явиться картка, яку побачить учень.</p>
  return (
    <TaskCard
      key={`${v.type}:${nonce}`}
      number={1}
      scope={previewScope(`task:${instance}:${v.type}:${nonce}`)}
      task={{ id: 'preview', version: 0, type: v.type, level: v.level, points: v.points, content: v.content, key: v.key, hint: v.hint || null, feedback: feedbackOf(v) }}
    />
  )
}

function UsageWarning({ usage, onSave, onCancel }: { usage: TaskUsage[]; onSave: () => void; onCancel: () => void }) {
  const published = usage.filter((u) => u.published)
  return (
    <div className={b.overlay}>
      <section className={b.dialog} role="alertdialog" aria-modal="true" aria-labelledby="usage-title">
        <h2 id="usage-title" className={t.h2}>
          Використовується в {published.length} опублікованих уроках
        </h2>
        <p className={t.note} style={{ maxWidth: 'none' }}>
          Учні побачать зміни після повторної публікації цих уроків. До того вони бачать попередню версію завдання.
        </p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {published.map((u) => (
            <li key={`${u.lessonId}-${u.role}`}>
              <a href={`/t/lessons/${u.lessonId}`} target="_blank" rel="noreferrer">
                {u.grade} клас{u.lessonNumber ? ` · урок ${u.lessonNumber}` : ''}. {u.lessonTitle}
              </a>
            </li>
          ))}
        </ul>
        <div className={t.footerActions}>
          <button type="button" className={t.btn} onClick={onCancel}>
            Скасувати
          </button>
          <button type="button" className={t.btnPrimary} onClick={onSave}>
            Зберегти завдання
          </button>
        </div>
      </section>
    </div>
  )
}

function Editor({ task, initialType, returnTo }: { task: EditableTask | null; initialType: TaskType; returnTo?: ReturnTo }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const id = task?.id ?? null
  const [restore, setRestore] = useState<TaskFormValues | null>(() => {
    const d = readDraft(id)
    const base = task?.values ?? newValues(initialType, returnTo?.visibility)
    // З блоку уроку — завжди з чистого аркуша потрібного виду, без чужої незбереженої копії
    return !returnTo && d && JSON.stringify(d) !== JSON.stringify(base) ? d : null
  })
  const form = useForm<TaskFormValues>({ defaultValues: task?.values ?? newValues(initialType, returnTo?.visibility), resolver, mode: 'onSubmit' })
  const { handleSubmit, register, formState, reset, getValues, control } = form
  const type = useWatch({ control, name: 'type' })
  const [revision, setRevision] = useState(task?.revision ?? null)
  const [warn, setWarn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [saved, setSaved] = useState<string | null>(takeFlash)
  /** Нове завдання створено — перейти на його адресу (без питання про незбережене) */
  const [createdId, setCreatedId] = useState<string | null>(null)
  useEffect(() => {
    if (!createdId) return
    // З блоку уроку — назад в урок, де завдання саме додасться на своє місце
    if (returnTo) void navigate({ to: '/t/lessons/$lessonId', params: { lessonId: returnTo.lessonId }, search: { attach: createdId, slot: returnTo.slot } })
    else void navigate({ to: '/t/tasks/$taskId', params: { taskId: createdId }, replace: true })
  }, [createdId, navigate, returnTo])
  const [nonce, setNonce] = useState(0)

  // Копія незбереженої форми — після кожної зміни
  const all = useWatch({ control }) as TaskFormValues
  useEffect(() => {
    if (formState.isDirty) writeDraft(id, all)
  }, [all, formState.isDirty, id])

  useBlocker({
    disabled: !!createdId,
    shouldBlockFn: () => form.formState.isDirty && !window.confirm('Завдання не збережено. Вийти без збереження?'),
    enableBeforeUnload: () => form.formState.isDirty,
  })

  const save = async (overwrite = false) => {
    setWarn(false)
    setError(null)
    setSaved(null)
    const values = getValues()
    try {
      const r = await saveTask(id, overwrite ? null : revision, values)
      writeDraft(id, null)
      writeDraft(null, null)
      setConflict(false)
      setRevision(r.revision)
      reset(values)
      await qc.invalidateQueries({ queryKey: ['t', 'bank'] })
      await qc.invalidateQueries({ queryKey: ['t', 'task', r.id] })
      setSaved(task && r.version > task.version ? `Збережено як версію ${r.version} — опубліковані уроки показують попередню до повторної публікації.` : 'Збережено.')
      if (!id) {
        try {
          sessionStorage.setItem(FLASH, 'Збережено.')
        } catch {
          /* без повідомлення після переходу */
        }
        setCreatedId(r.id)
      }
    } catch (e) {
      if (e instanceof RevisionConflict) setConflict(true)
      else setError(e instanceof Error ? e.message : 'Не вдалося зберегти')
    }
  }

  const onValid = () => (task?.usage.some((u) => u.published) ? setWarn(true) : void save())

  const changeType = (next: TaskType) => {
    if (next === type) return
    if (formState.isDirty && !window.confirm('Інший тип — поточні варіанти й відповідь буде скинуто. Продовжити?')) return
    const keep = getValues()
    reset({ ...newValues(next), level: keep.level, grp: keep.grp, points: keep.points, grade: keep.grade, visibility: keep.visibility }, { keepDefaultValues: true })
  }

  const Fields = TASK_EDITORS[type]?.Editor
  const heading = id ? taskPrompt(getValues('content')) : 'Нове завдання'

  return (
    <FormProvider {...form}>
      <form className={b.page} onSubmit={handleSubmit(onValid)} noValidate aria-label="Редактор завдання">
        <header className={b.head}>
          {returnTo ? (
            <Link to="/t/lessons/$lessonId" params={{ lessonId: returnTo.lessonId }} className={b.back}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
              До уроку
            </Link>
          ) : (
            <Link to="/t/tasks" className={b.back}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
              Банк завдань
            </Link>
          )}
          <h1 className={b.title} title={heading}>
            {heading}
          </h1>
          {task?.archived && <span className={b.pillDraft}>В архіві</span>}
          <span className={b.spacer} />
          {returnTo ? (
            <Link to="/t/lessons/$lessonId" params={{ lessonId: returnTo.lessonId }} className={t.btn}>
              Скасувати
            </Link>
          ) : (
            <Link to="/t/tasks" className={t.btn}>
              Скасувати
            </Link>
          )}
          <button type="submit" className={t.btnPrimary} disabled={formState.isSubmitting}>
            Зберегти завдання
          </button>
        </header>

        {restore && (
          <div className={b.banner} role="alert">
            Є незбережені зміни цього завдання (вкладку закрито до збереження).
            <button type="button" className={t.btnSmall} onClick={() => (reset(restore, { keepDefaultValues: true }), setRestore(null))}>
              Відновити
            </button>
            <button type="button" className={t.btnSmall} onClick={() => (writeDraft(id, null), setRestore(null))}>
              Відкинути
            </button>
          </div>
        )}
        {conflict && (
          <div className={b.bannerError} role="alert">
            Завдання змінено в іншій вкладці — твої зміни не збережено.
            <button type="button" className={t.btnSmall} onClick={() => void save(true)}>
              Перезаписати моїми змінями
            </button>
            <button type="button" className={t.btnSmall} onClick={() => window.location.reload()}>
              Завантажити збережену версію
            </button>
          </div>
        )}

        <div className={k.layout}>
          <aside className={k.types} aria-label="Тип завдання">
            <h2 className={b.panelTitle}>Тип завдання</h2>
            {id ? (
              <span className={k.typeCard} aria-current="true">
                <span className={k.typeName}>{TASKS[type].label}</span>
              </span>
            ) : (
              TASK_TYPES.map((x) => (
                <button
                  key={x}
                  type="button"
                  className={k.typeCard}
                  aria-pressed={x === type}
                  disabled={!TASK_EDITORS[x]}
                  onClick={() => changeType(x)}
                >
                  <span className={k.typeName}>{TASKS[x].label}</span>
                  {!TASK_EDITORS[x] && <span className={k.typeHint}>редактор — у наступному оновленні</span>}
                </button>
              ))
            )}
          </aside>

          <main className={k.main}>
            <section className={b.panel} aria-label="Зміст завдання">
              {Fields ? (
                <Suspense fallback={<EditorSkeleton />}>
                  <Fields />
                </Suspense>
              ) : (
                <p className={t.notice}>Редактор цього типу з’явиться в наступному оновленні.</p>
              )}
            </section>
            <section className={b.panel} aria-label="Спільні поля">
              <div className={t.fieldRow}>
                <label className={t.field}>
                  <span className={t.fieldLabel}>Рівень</span>
                  <select className={t.select} {...register('level')}>
                    {LEVEL_OPTIONS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={t.field}>
                  <span className={t.fieldLabel}>Група результатів</span>
                  <select className={t.select} {...register('grp')}>
                    {GROUP_OPTIONS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={t.field}>
                  <span className={t.fieldLabel}>Бали</span>
                  <input className={t.input} type="number" step={0.5} min={0.5} {...register('points', { valueAsNumber: true })} />
                  <FieldError path="points" />
                </label>
                <label className={t.field}>
                  <span className={t.fieldLabel}>Клас</span>
                  <select className={t.select} {...register('grade', { setValueAs: (v: string) => (v === '' || v === null ? null : Number(v)) })}>
                    <option value="">Будь-який</option>
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g} клас
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <fieldset className={k.visibility}>
                <legend className={t.fieldLabel}>Використання</legend>
                <label className={t.check}>
                  <input type="radio" value="open" disabled={returnTo?.visibility === 'secure'} {...register('visibility')} />
                  Відкрите — тренування (відповідь перевіряється в браузері)
                </label>
                <label className={t.check}>
                  <input type="radio" value="secure" disabled={returnTo?.visibility === 'open'} {...register('visibility')} />
                  Захищене — ДЗ і квіз (відповідь бачить лише сервер)
                </label>
                <FieldError path="visibility" />
                {returnTo && (
                  <span className={t.note}>
                    {returnTo.visibility === 'open' ? 'Для тренування — лише відкрите завдання.' : 'Для ДЗ — лише захищене завдання.'} Після збереження воно
                    додасться в урок.
                  </span>
                )}
              </fieldset>
              <label className={t.field}>
                <span className={t.fieldLabel}>Коментар при помилці</span>
                <input className={t.input} placeholder="Підказка, куди подивитися" {...register('feedbackIncorrect')} />
              </label>
              <label className={t.field}>
                <span className={t.fieldLabel}>Коментар при правильній відповіді (необов’язково)</span>
                <input className={t.input} {...register('feedbackCorrect')} />
              </label>
              <label className={t.field}>
                <span className={t.fieldLabel}>Підказка (необов’язково)</span>
                <input className={t.input} {...register('hint')} />
              </label>
            </section>
            {error && (
              <p className={t.alert} role="alert">
                {error}
              </p>
            )}
            {saved && (
              <p className={t.success} role="status">
                {saved}
              </p>
            )}
            {Object.keys(formState.errors).length > 0 && (
              <p className={t.alert} role="alert">
                Завдання не збережено — виправ позначені поля.
              </p>
            )}
          </main>

          <aside className={k.preview} aria-label="Як побачить учень">
            <div className={b.blockHead}>
              <h2 className={b.panelTitle}>Як побачить учень</h2>
              <span className={b.spacer} />
              <span className={t.muted}>{LEVELS[form.getValues('level')]}</span>
            </div>
            <div id="task-preview">
              <Preview nonce={nonce} />
            </div>
            <button
              type="button"
              className={t.btn}
              style={{ borderColor: 'var(--water)', color: 'var(--water-dark)', fontWeight: 600 }}
              onClick={() => {
                setNonce((n) => n + 1)
                requestAnimationFrame(() => document.querySelector<HTMLElement>('#task-preview input, #task-preview button')?.focus())
              }}
            >
              Спробувати як учень
            </button>
          </aside>
        </div>

        {warn && task && <UsageWarning usage={task.usage} onSave={() => void save()} onCancel={() => setWarn(false)} />}
      </form>
    </FormProvider>
  )
}

/** /t/tasks/new?type=… або /t/tasks/:id */
export function TaskEditorPage({ taskId, type, returnTo }: { taskId: string | null; type?: string; returnTo?: ReturnTo }) {
  const q = useQuery({ ...taskQuery(taskId ?? ''), enabled: !!taskId })
  const initialType = (type && TASK_EDITORS[type as TaskType] ? type : 'single_choice') as TaskType
  if (!taskId) return <Editor key="new" task={null} initialType={initialType} returnTo={returnTo} />
  if (q.isError) {
    return (
      <p className={t.alert} style={{ margin: 24 }}>
        {isNotFound(q.error) ? 'Завдання не знайдено.' : 'Не вдалося завантажити завдання.'} <Link to="/t/tasks">До банку</Link>
      </p>
    )
  }
  if (!q.data) return <TeacherPageSkeleton rows={8} standalone />
  return <Editor key={taskId} task={q.data} initialType={q.data.values.type} />
}
