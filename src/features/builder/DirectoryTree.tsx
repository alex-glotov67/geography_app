import { useState, type FormEvent, type ReactNode } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useQueryClient } from '@tanstack/react-query'
import type { DirOutcome, DirSection, DirTopic } from '@/api/builder'
import {
  addOutcome, createSection, createTopic, deleteSection, deleteTopic, reorderOutcomes, setOutcomeArchived, updateOutcome,
  updateSection, updateTopic,
} from '@/api/directory'
import t from '@/features/teacher/teacher.module.css'
import { GRADES } from '@/lib/grades'
import { outcomeError, sectionError, topicError } from '@/lib/outcomesEdit'
import { DND_A11Y, useTaskSensors } from '@/tasks/dnd'
import { moveItem } from './draft'
import b from './builder.module.css'

/*
 * Довідник програми: перегляд і ручні правки (SPEC 16, Фаза 3). Код результату не змінюється при
 * редагуванні тексту; новий результат — наступний номер у темі; видалення — лише архівування.
 * Номер розділу чи теми, де вже є результати, заблокований — він у кодах. Ті самі правила, що й імпорт.
 */

const sectionLabel = (n: number) => (n === 0 ? 'Вступ' : `Розділ ${n}`)
const topicLabel = (n: number) => (n === 0 ? 'Вступ' : `Тема ${n}`)
const hasOutcomes = (s: DirSection) => s.topics.some((tp) => tp.outcomes.length > 0)
/** Наступний номер: після найбільшого; у порожньому — 1 (0 — вступ, його задають явно; у вступі — 0) */
const nextNumber = (numbers: number[], first = 1) => (numbers.length ? Math.max(...numbers) + 1 : first)

/** Запуск правки: помилка — текстом, після успіху — оновити довідник */
function useAction() {
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося зберегти')
      return false
    } finally {
      setBusy(false)
      await qc.invalidateQueries({ queryKey: ['t', 'directory'] })
    }
  }
  return { run, error, setError, busy }
}

function ErrorText({ children }: { children: ReactNode }) {
  return children ? (
    <p className={t.alert} role="alert">
      {children}
    </p>
  ) : null
}

/** Номер + назва: для нового розділу чи теми й перейменування; номер — лише якщо можна */
function NumberTitleForm({
  label, number: initialNumber, title: initialTitle, numberLocked, submit, validate, onCancel, submitText,
}: {
  label: string
  number: number
  title: string
  numberLocked?: boolean
  submit: (v: { number: number; title: string }) => Promise<boolean>
  validate: (v: { number: number; title: string }) => string | null
  onCancel: () => void
  submitText: string
}) {
  const [number, setNumber] = useState(String(initialNumber))
  const [title, setTitle] = useState(initialTitle)
  const [error, setError] = useState<string | null>(null)
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const v = { number: Number(number), title: title.trim() }
    const problem = number.trim() === '' ? `«№»: не заповнено` : validate(v)
    setError(problem)
    if (!problem && (await submit(v))) onCancel()
  }
  return (
    <form className={t.fieldRow} onSubmit={onSubmit} aria-label={label} noValidate>
      <label className={t.field} style={{ flexBasis: 90, flexGrow: 0 }}>
        <span className={t.fieldLabel}>№</span>
        <input className={t.input} type="number" min={0} value={number} disabled={numberLocked} onChange={(e) => setNumber(e.target.value)} />
      </label>
      <label className={t.field} style={{ flexBasis: 320 }}>
        <span className={t.fieldLabel}>Назва</span>
        <input className={t.input} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <button type="submit" className={t.btnPrimary}>
        {submitText}
      </button>
      <button type="button" className={t.btn} onClick={onCancel}>
        Скасувати
      </button>
      {numberLocked && <span className={t.note}>Номер уже є в кодах результатів — змінити не можна.</span>}
      {error && <span className={t.fieldError}>{error}</span>}
    </form>
  )
}

function OutcomeForm({
  label, text: initialText, source: initialSource, siblings, selfId, submit, onCancel, submitText,
}: {
  label: string
  text: string
  source: string
  siblings: DirOutcome[]
  selfId?: string
  submit: (v: { text: string; source: string }) => Promise<boolean>
  onCancel: () => void
  submitText: string
}) {
  const [text, setText] = useState(initialText)
  const [source, setSource] = useState(initialSource)
  const [error, setError] = useState<string | null>(null)
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const v = { text: text.trim().replace(/\s+/g, ' '), source: source.trim() }
    const problem = outcomeError(v, siblings, selfId)
    setError(problem)
    if (!problem && (await submit(v))) onCancel()
  }
  return (
    <form onSubmit={onSubmit} aria-label={label} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label className={t.field} style={{ flex: 'none' }}>
        <span className={t.fieldLabel}>Очікуваний результат</span>
        <textarea className={b.textarea} style={{ minHeight: 72 }} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className={t.fieldRow}>
        <label className={t.field} style={{ flexBasis: 360 }}>
          <span className={t.fieldLabel}>Джерело</span>
          <input className={t.input} value={source} onChange={(e) => setSource(e.target.value)} />
        </label>
        <button type="submit" className={t.btnPrimary}>
          {submitText}
        </button>
        <button type="button" className={t.btn} onClick={onCancel}>
          Скасувати
        </button>
      </div>
      {error && <span className={t.fieldError}>{error}</span>}
    </form>
  )
}

const Arrow = ({ up }: { up?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
  </svg>
)

function OutcomeItem({
  o, index, count, siblings, move,
}: {
  o: DirOutcome
  index: number
  count: number
  siblings: DirOutcome[]
  move?: (from: number, to: number) => void
}) {
  const { run, error } = useAction()
  const [editing, setEditing] = useState(false)
  const { setNodeRef, listeners, attributes, transform, transition, isDragging } = useSortable({ id: o.id, disabled: !move })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, display: 'flex', flexDirection: 'column', gap: 6 }}
      data-dragging={isDragging || undefined}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, opacity: o.archived ? 0.6 : 1 }}>
        {move && (
          <span className={b.grip} {...listeners} {...attributes} tabIndex={-1} aria-hidden="true" style={{ paddingTop: 12, touchAction: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" />
              <circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
            </svg>
          </span>
        )}
        <span className={t.mono} style={{ fontSize: 13, color: 'var(--muted)', flexShrink: 0, paddingTop: 13 }}>
          {o.code}
        </span>
        <span style={{ flexGrow: 1, fontSize: 15, lineHeight: 1.4, paddingTop: 11 }}>
          {o.text}
          {o.archived && <span className={t.muted}> (архів)</span>}
          <span className={t.muted} style={{ display: 'block', fontSize: 13 }}>
            {o.source}
          </span>
        </span>
        {move && (
          <>
            <button type="button" className={b.iconBtn} disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={`${o.code} — вище`}>
              <Arrow up />
            </button>
            <button type="button" className={b.iconBtn} disabled={index === count - 1} onClick={() => move(index, index + 1)} aria-label={`${o.code} — нижче`}>
              <Arrow />
            </button>
          </>
        )}
        {!o.archived && (
          <button type="button" className={t.btnSmall} onClick={() => setEditing((v) => !v)} aria-expanded={editing} aria-label={`Змінити ${o.code}`}>
            Змінити
          </button>
        )}
        <button
          type="button"
          className={t.btnSmall}
          onClick={() => void run(() => setOutcomeArchived(o.id, !o.archived))}
          aria-label={`${o.archived ? 'Повернути з архіву' : 'Архівувати'} ${o.code}`}
        >
          {o.archived ? 'Повернути' : 'Архівувати'}
        </button>
      </div>
      {editing && (
        <OutcomeForm
          label={`Зміна ${o.code}`}
          text={o.text}
          source={o.source}
          siblings={siblings}
          selfId={o.id}
          submitText="Зберегти"
          submit={(v) => run(() => updateOutcome(o.id, v.text, v.source))}
          onCancel={() => setEditing(false)}
        />
      )}
      <ErrorText>{error}</ErrorText>
    </li>
  )
}

function TopicBlock({ topic, section, open }: { topic: DirTopic; section: DirSection; open: boolean }) {
  const { run, error } = useAction()
  const sensors = useTaskSensors()
  const [mode, setMode] = useState<'rename' | 'add' | null>(null)
  const [showArchive, setShowArchive] = useState(false)
  const active = topic.outcomes.filter((o) => !o.archived)
  const archived = topic.outcomes.filter((o) => o.archived)
  const move = (from: number, to: number) => {
    const ids = [...moveItem(active, from, to), ...archived].map((o) => o.id)
    void run(() => reorderOutcomes(topic.id, ids))
  }
  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    if (over && a.id !== over.id) move(active.findIndex((o) => o.id === a.id), active.findIndex((o) => o.id === over.id))
  }
  const name = `${topicLabel(topic.number)}. ${topic.title}`
  return (
    <details open={open}>
      <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 500 }}>
        {name}
        <span className={t.muted} style={{ marginLeft: 8, fontWeight: 400 }}>
          ({active.length})
        </span>
      </summary>
      <div role="group" aria-label={name} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0 12px 12px' }}>
        <div className={t.actions}>
          <button type="button" className={t.btnSmall} onClick={() => setMode(mode === 'add' ? null : 'add')} aria-expanded={mode === 'add'}>
            + Результат
          </button>
          <button type="button" className={t.btnSmall} onClick={() => setMode(mode === 'rename' ? null : 'rename')} aria-expanded={mode === 'rename'}>
            Змінити тему
          </button>
          {topic.outcomes.length === 0 && (
            <button type="button" className={t.btnSmall} onClick={() => void run(() => deleteTopic(topic.id))}>
              Видалити порожню тему
            </button>
          )}
          {archived.length > 0 && (
            <button type="button" className={t.linkBtn} onClick={() => setShowArchive((v) => !v)} aria-expanded={showArchive}>
              {showArchive ? 'Сховати архів' : `Архів (${archived.length})`}
            </button>
          )}
        </div>
        {mode === 'rename' && (
          <NumberTitleForm
            label={`Зміна теми ${topic.number}`}
            number={topic.number}
            title={topic.title}
            numberLocked={topic.outcomes.length > 0}
            submitText="Зберегти"
            validate={(v) => topicError(v, section.topics, topic.id)}
            submit={(v) => run(() => updateTopic(topic.id, topic.outcomes.length ? { title: v.title } : v))}
            onCancel={() => setMode(null)}
          />
        )}
        {mode === 'add' && (
          <OutcomeForm
            label={`Новий результат: ${name}`}
            text=""
            source={topic.outcomes.at(-1)?.source ?? ''}
            siblings={topic.outcomes}
            submitText="Додати"
            submit={(v) => run(() => addOutcome(topic.id, v.text, v.source))}
            onCancel={() => setMode(null)}
          />
        )}
        <ErrorText>{error}</ErrorText>
        {active.length === 0 ? (
          <p className={t.empty}>Результатів ще немає.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={DND_A11Y}>
            <SortableContext items={active.map((o) => o.id)} strategy={verticalListSortingStrategy}>
              <ol aria-label={`Результати: ${name}`} style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {active.map((o, i) => (
                  <OutcomeItem key={o.id} o={o} index={i} count={active.length} siblings={topic.outcomes} move={move} />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
        {showArchive && (
          <ul aria-label={`Архів: ${name}`} style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {archived.map((o, i) => (
              <OutcomeItem key={o.id} o={o} index={i} count={archived.length} siblings={topic.outcomes} />
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}

function SectionCard({ section, sections }: { section: DirSection; sections: DirSection[] }) {
  const { run, error } = useAction()
  const [mode, setMode] = useState<'rename' | 'topic' | null>(null)
  const nextTopic = nextNumber(section.topics.map((tp) => tp.number), section.number === 0 ? 0 : 1)
  const name = `${section.grade} клас · ${sectionLabel(section.number)}. ${section.title}`
  return (
    <section className={t.card} aria-label={name}>
      <div className={t.cardHead}>
        <h2 className={t.h2}>{name}</h2>
        <div className={t.actions}>
          <button type="button" className={t.btnSmall} onClick={() => setMode(mode === 'topic' ? null : 'topic')} aria-expanded={mode === 'topic'}>
            + Тема
          </button>
          <button type="button" className={t.btnSmall} onClick={() => setMode(mode === 'rename' ? null : 'rename')} aria-expanded={mode === 'rename'}>
            Змінити розділ
          </button>
          {section.topics.length === 0 && (
            <button type="button" className={t.btnSmall} onClick={() => void run(() => deleteSection(section.id))}>
              Видалити порожній розділ
            </button>
          )}
        </div>
      </div>
      {mode === 'rename' && (
        <NumberTitleForm
          label={`Зміна розділу ${section.number}`}
          number={section.number}
          title={section.title}
          numberLocked={hasOutcomes(section)}
          submitText="Зберегти"
          validate={(v) => sectionError({ grade: section.grade, ...v }, sections, section.id)}
          submit={(v) => run(() => updateSection(section.id, hasOutcomes(section) ? { title: v.title } : v))}
          onCancel={() => setMode(null)}
        />
      )}
      {mode === 'topic' && (
        <NumberTitleForm
          label={`Нова тема: ${name}`}
          number={nextTopic}
          title=""
          submitText="Додати тему"
          validate={(v) => topicError(v, section.topics)}
          submit={(v) => run(() => createTopic(section.id, v.number, v.title))}
          onCancel={() => setMode(null)}
        />
      )}
      <ErrorText>{error}</ErrorText>
      {section.topics.length === 0 && <p className={t.empty}>Тем ще немає.</p>}
      {section.topics.map((tp) => (
        <TopicBlock key={tp.id} topic={tp} section={section} open={section.topics.length === 1} />
      ))}
    </section>
  )
}

/** «+ Розділ»: клас, номер (наступний вільний), назва */
export function NewSectionButton({ sections }: { sections: DirSection[] }) {
  const { run, error } = useAction()
  const [open, setOpen] = useState(false)
  const [grade, setGrade] = useState(8)
  const next = nextNumber(sections.filter((s) => s.grade === grade).map((s) => s.number))
  return (
    <>
      <button type="button" className={t.btn} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        + Розділ
      </button>
      {open && (
        <section className={t.cardAccent} aria-label="Новий розділ" style={{ flexBasis: '100%' }}>
          <label className={t.field} style={{ maxWidth: 160 }}>
            <span className={t.fieldLabel}>Клас</span>
            <select className={t.select} value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g} клас
                </option>
              ))}
            </select>
          </label>
          <NumberTitleForm
            key={grade}
            label="Номер і назва розділу"
            number={next}
            title=""
            submitText="Додати розділ"
            validate={(v) => sectionError({ grade, ...v }, sections)}
            submit={(v) => run(() => createSection(grade, v.number, v.title))}
            onCancel={() => setOpen(false)}
          />
          <ErrorText>{error}</ErrorText>
        </section>
      )}
    </>
  )
}

export function DirectoryTree({ sections }: { sections: DirSection[] }) {
  return (
    <>
      {sections.map((s) => (
        <SectionCard key={s.id} section={s} sections={sections} />
      ))}
    </>
  )
}
