import { useState, type ReactNode } from 'react'
import type { Block } from '@shared/schemas/blocks.ts'
import type { BuilderLesson } from '@/api/builder'
import t from '@/features/teacher/teacher.module.css'
import { ADDABLE_BLOCKS, BLOCK_HINTS, BLOCK_LABELS, blockId, docToPlain, newBlock, plainToDoc, type AddableBlock } from './draft'
import { useBuilder } from './store'
import b from './builder.module.css'

/*
 * Редактори блоків (SPEC 10.2). У 3.3 — мета, текст (простий: абзаци), терміни, виділений блок,
 * таблиця. Форматування тексту (Tiptap) — у 3.4, медіа й відео — з медіатекою, тренування й ДЗ —
 * з банком завдань: такі блоки тут показуються коротко, їх можна переставити чи прибрати.
 */

type Of<T extends Block['type']> = Extract<Block, { type: T }>
type Update<B extends Block> = (fn: (block: B) => B) => void

const MAX_GOALS = 5
const MAX_TERMS = 12
const MAX_COLUMNS = 8
const MAX_ROWS = 60

const CALLOUT_VARIANTS: { value: Of<'callout'>['variant']; label: string }[] = [
  { value: 'interesting', label: 'Цікаво знати' },
  { value: 'attention', label: 'Зверни увагу' },
  { value: 'local', label: 'Мій край' },
]

const replaceAt = <T,>(list: readonly T[], i: number, value: T) => list.map((x, j) => (j === i ? value : x))
const removeAt = <T,>(list: readonly T[], i: number) => list.filter((_, j) => j !== i)

function RemoveBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={b.iconBtn} onClick={onClick} aria-label={label} disabled={disabled}>
      ×
    </button>
  )
}

/** Простий текст: абзаци через порожній рядок; форматований (з 3.4 чи пакета) — лише перегляд */
function PlainDoc({ label, doc, onChange }: { label: string; doc: Of<'text'>['doc'] | undefined; onChange: (doc: Of<'text'>['doc']) => void }) {
  const plain = docToPlain(doc)
  if (plain === null) {
    return <p className={t.notice}>{label}: текст з форматуванням (заголовки, списки, жирний) — редактор форматування з’явиться в наступному оновленні.</p>
  }
  return (
    <label className={t.field}>
      <span className={t.fieldLabel}>{label}</span>
      <textarea className={b.textarea} value={plain} onChange={(e) => onChange(plainToDoc(e.target.value))} aria-describedby="plain-hint" />
    </label>
  )
}

function GoalEditor({ block, update }: { block: Of<'goal'>; update: Update<Of<'goal'>> }) {
  return (
    <>
      {block.items.map((item, i) => (
        <div key={i} className={b.row}>
          <input
            className={t.input}
            value={item}
            aria-label={`Пункт ${i + 1}`}
            placeholder="Простою мовою: що учень дізнається"
            onChange={(e) => update((x) => ({ ...x, items: replaceAt(x.items, i, e.target.value) }))}
          />
          <RemoveBtn label={`Прибрати пункт ${i + 1}`} onClick={() => update((x) => ({ ...x, items: removeAt(x.items, i) }))} />
        </div>
      ))}
      {block.items.length < MAX_GOALS && (
        <button type="button" className={b.addInline} onClick={() => update((x) => ({ ...x, items: [...x.items, ''] }))}>
          + пункт
        </button>
      )}
    </>
  )
}

function TextEditor({ block, update }: { block: Of<'text'>; update: Update<Of<'text'>> }) {
  const [ownSimplified, setOwnSimplified] = useState(!!block.simplifiedDoc)
  return (
    <>
      <label className={t.field}>
        <span className={t.fieldLabel}>Заголовок (необов’язково)</span>
        <input className={t.input} value={block.title ?? ''} onChange={(e) => update((x) => ({ ...x, title: e.target.value || undefined }))} />
      </label>
      <PlainDoc label="Текст" doc={block.doc} onChange={(doc) => update((x) => ({ ...x, doc }))} />
      <label className={t.check}>
        <input
          type="checkbox"
          checked={ownSimplified}
          onChange={(e) => {
            setOwnSimplified(e.target.checked)
            if (!e.target.checked) update((x) => ({ ...x, simplifiedDoc: undefined }))
          }}
        />
        Окремий простіший текст для спрощеного режиму
      </label>
      {ownSimplified && <PlainDoc label="Текст у спрощеному режимі" doc={block.simplifiedDoc} onChange={(doc) => update((x) => ({ ...x, simplifiedDoc: doc }))} />}
    </>
  )
}

function TermsEditor({ block, update }: { block: Of<'terms'>; update: Update<Of<'terms'>> }) {
  return (
    <>
      {block.items.map((item, i) => (
        <div key={i} className={b.row}>
          <input
            className={t.input}
            style={{ flexGrow: 0, flexBasis: '30%' }}
            value={item.term}
            aria-label={`Термін ${i + 1}`}
            placeholder="Термін"
            onChange={(e) => update((x) => ({ ...x, items: replaceAt(x.items, i, { ...item, term: e.target.value }) }))}
          />
          <input
            className={t.input}
            value={item.definition}
            aria-label={`Визначення ${i + 1}`}
            placeholder="Визначення простою мовою"
            onChange={(e) => update((x) => ({ ...x, items: replaceAt(x.items, i, { ...item, definition: e.target.value }) }))}
          />
          <RemoveBtn label={`Прибрати термін ${i + 1}`} onClick={() => update((x) => ({ ...x, items: removeAt(x.items, i) }))} />
        </div>
      ))}
      {block.items.length < MAX_TERMS && (
        <button type="button" className={b.addInline} onClick={() => update((x) => ({ ...x, items: [...x.items, { term: '', definition: '' }] }))}>
          + термін
        </button>
      )}
    </>
  )
}

function CalloutEditor({ block, update }: { block: Of<'callout'>; update: Update<Of<'callout'>> }) {
  return (
    <>
      <div className={t.fieldRow}>
        <label className={t.field} style={{ flexBasis: 200, flexGrow: 0 }}>
          <span className={t.fieldLabel}>Вид</span>
          <select className={t.select} value={block.variant} onChange={(e) => update((x) => ({ ...x, variant: e.target.value as Of<'callout'>['variant'] }))}>
            {CALLOUT_VARIANTS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className={t.field}>
          <span className={t.fieldLabel}>Заголовок (необов’язково)</span>
          <input className={t.input} value={block.title ?? ''} onChange={(e) => update((x) => ({ ...x, title: e.target.value || undefined }))} />
        </label>
      </div>
      <PlainDoc label="Текст" doc={block.doc} onChange={(doc) => update((x) => ({ ...x, doc }))} />
    </>
  )
}

function TableEditor({ block, update }: { block: Of<'table'>; update: Update<Of<'table'>> }) {
  const cols = block.columns.length
  const template = `repeat(${cols}, minmax(80px, 1fr)) 44px`
  return (
    <>
      <label className={t.field}>
        <span className={t.fieldLabel}>Підпис таблиці (необов’язково)</span>
        <input className={t.input} value={block.caption ?? ''} onChange={(e) => update((x) => ({ ...x, caption: e.target.value || undefined }))} />
      </label>
      <div className={b.grid} style={{ gridTemplateColumns: template }} role="group" aria-label="Клітинки таблиці">
        {block.columns.map((c, j) => (
          <input
            key={`h${j}`}
            className={b.gridHead}
            value={c}
            aria-label={`Назва стовпця ${j + 1}`}
            placeholder={`Стовпець ${j + 1}`}
            onChange={(e) => update((x) => ({ ...x, columns: replaceAt(x.columns, j, e.target.value) }))}
          />
        ))}
        <RemoveBtn
          label="Прибрати останній стовпець"
          disabled={cols <= 1}
          onClick={() => update((x) => ({ ...x, columns: x.columns.slice(0, -1), rows: x.rows.map((r) => r.slice(0, -1)) }))}
        />
        {block.rows.map((row, i) => [
          ...row.map((cell, j) => (
            <input
              key={`${i}-${j}`}
              className={b.gridCell}
              value={cell}
              aria-label={`Рядок ${i + 1}, стовпець ${j + 1}`}
              onChange={(e) => update((x) => ({ ...x, rows: replaceAt(x.rows, i, replaceAt(x.rows[i]!, j, e.target.value)) }))}
            />
          )),
          <RemoveBtn key={`r${i}`} label={`Прибрати рядок ${i + 1}`} disabled={block.rows.length <= 1} onClick={() => update((x) => ({ ...x, rows: removeAt(x.rows, i) }))} />,
        ])}
      </div>
      <div className={b.row}>
        {block.rows.length < MAX_ROWS && (
          <button type="button" className={b.addInline} onClick={() => update((x) => ({ ...x, rows: [...x.rows, x.columns.map(() => '')] }))}>
            + рядок
          </button>
        )}
        {cols < MAX_COLUMNS && (
          <button
            type="button"
            className={b.addInline}
            onClick={() => update((x) => ({ ...x, columns: [...x.columns, ''], rows: x.rows.map((r) => [...r, '']) }))}
          >
            + стовпець
          </button>
        )}
      </div>
      <div className={t.fieldRow}>
        <label className={t.field}>
          <span className={t.fieldLabel}>Джерело даних</span>
          <input className={t.input} value={block.meta.source} onChange={(e) => update((x) => ({ ...x, meta: { ...x.meta, source: e.target.value } }))} />
        </label>
        <label className={t.field} style={{ flexBasis: 160, flexGrow: 0 }}>
          <span className={t.fieldLabel}>Дані станом на</span>
          <input className={t.input} value={block.meta.asOf} placeholder="2026" onChange={(e) => update((x) => ({ ...x, meta: { ...x.meta, asOf: e.target.value } }))} />
        </label>
      </div>
    </>
  )
}

/** Блоки, що редагуються з медіатекою чи банком завдань: короткий опис замість форми */
function RefSummary({ block, refs }: { block: Block; refs: Pick<BuilderLesson, 'tasks' | 'media' | 'videos'> }) {
  const later = (what: string) => <p className={t.note}>Редагування — разом із {what} (наступні оновлення Фази 3).</p>
  switch (block.type) {
    case 'image':
    case 'file': {
      const m = refs.media[block.mediaId]
      return (
        <>
          <span className={t.strong}>{block.type === 'file' ? block.title : (block.caption ?? m?.caption ?? m?.alt ?? 'Зображення')}</span>
          {m && !m.source && <span className={t.statusError}>Джерело не вказано</span>}
          {later('медіатекою')}
        </>
      )
    }
    case 'gallery':
      return later('медіатекою')
    case 'video': {
      const v = refs.videos[block.videoId]
      return (
        <>
          <span className={t.strong}>{v?.title ?? 'Відео'}</span>
          <span className={t.note}>{v?.approved ? 'перевірено' : 'не перевірено — учні не побачать'}</span>
          {later('додаванням відео')}
        </>
      )
    }
    case 'practice':
      return (
        <>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 15 }}>
            {block.taskIds.map((id) => {
              const task = refs.tasks[id]
              const prompt = (task?.content as { prompt?: string } | undefined)?.prompt
              return <li key={id}>{task ? `${prompt ?? task.type} · ${task.grp}` : 'Завдання не знайдено'}</li>
            })}
          </ul>
          {later('банком завдань')}
        </>
      )
    case 'homework':
      return later('банком завдань')
    default:
      return null
  }
}

function Editor({ block, refs }: { block: Block; refs: Pick<BuilderLesson, 'tasks' | 'media' | 'videos'> }) {
  const edit = useBuilder((s) => s.edit)
  const update = <B extends Block>(fn: (x: B) => B) =>
    edit((d) => ({ ...d, blocks: d.blocks.map((x) => (x.id === block.id ? fn(x as B) : x)) }))
  switch (block.type) {
    case 'goal':
      return <GoalEditor block={block} update={update} />
    case 'text':
      return <TextEditor block={block} update={update} />
    case 'terms':
      return <TermsEditor block={block} update={update} />
    case 'callout':
      return <CalloutEditor block={block} update={update} />
    case 'table':
      return <TableEditor block={block} update={update} />
    default:
      return <RefSummary block={block} refs={refs} />
  }
}

function BlockCard({ block, index, refs, onRemove }: { block: Block; index: number; refs: Pick<BuilderLesson, 'tasks' | 'media' | 'videos'>; onRemove: () => void }) {
  const selected = useBuilder((s) => s.selectedBlockId === block.id)
  const select = useBuilder((s) => s.select)
  const edit = useBuilder((s) => s.edit)
  const label = BLOCK_LABELS[block.type]
  return (
    <section
      id={`block-${block.id}`}
      className={b.block}
      data-selected={selected}
      aria-label={`${label}, блок ${index + 1}`}
      onFocusCapture={() => !selected && select(block.id)}
    >
      <div className={b.blockHead}>
        <span className={b.blockType}>{label}</span>
        <span className={b.spacer} />
        <label className={t.check} style={{ fontSize: 14 }}>
          <input
            type="checkbox"
            checked={block.simplified}
            onChange={(e) => edit((d) => ({ ...d, blocks: d.blocks.map((x) => (x.id === block.id ? { ...x, simplified: e.target.checked } : x)) }))}
          />
          У спрощеному режимі
        </label>
        <button type="button" className={t.btnSmall} onClick={onRemove} aria-label={`Видалити блок «${label}» ${index + 1}`}>
          Видалити
        </button>
      </div>
      <Editor block={block} refs={refs} />
    </section>
  )
}

function AddMenu({ onAdd, hasHomework }: { onAdd: (type: AddableBlock) => void; hasHomework: boolean }) {
  const later: { name: string; hint: string }[] = [
    { name: 'Зображення, галерея, PDF', hint: 'з медіатекою' },
    { name: 'Відео', hint: 'з медіатекою' },
    { name: 'Тренування', hint: 'з банком завдань' },
    ...(hasHomework ? [] : [{ name: 'Домашнє завдання', hint: 'з банком завдань' }]),
  ]
  return (
    <div className={b.menu} role="group" aria-label="Тип нового блоку">
      {ADDABLE_BLOCKS.map((type) => (
        <button key={type} type="button" className={b.menuItem} onClick={() => onAdd(type)}>
          <span className={b.menuName}>{BLOCK_LABELS[type]}</span>
          <span className={b.menuHint}>{BLOCK_HINTS[type]}</span>
        </button>
      ))}
      {later.map((x) => (
        <button key={x.name} type="button" className={b.menuItem} disabled>
          <span className={b.menuName}>{x.name}</span>
          <span className={b.menuHint}>з’явиться {x.hint}</span>
        </button>
      ))}
    </div>
  )
}

/** Центральна колонка: блоки з редакторами, «+ Додати блок» між будь-якими блоками */
export function BlockEditors({ refs }: { refs: Pick<BuilderLesson, 'tasks' | 'media' | 'videos'> }): ReactNode {
  const blocks = useBuilder((s) => s.draft!.blocks)
  const edit = useBuilder((s) => s.edit)
  const select = useBuilder((s) => s.select)
  /** Куди вставити новий блок (індекс), null — меню закрите */
  const [insertAt, setInsertAt] = useState<number | null>(null)
  const [removed, setRemoved] = useState<{ block: Block; index: number } | null>(null)

  const add = (type: AddableBlock, at: number) => {
    const block = newBlock(type, blockId(blocks.map((x) => x.id)))
    edit((d) => ({ ...d, blocks: [...d.blocks.slice(0, at), block, ...d.blocks.slice(at)] }))
    setInsertAt(null)
    select(block.id)
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`#block-${block.id} input, #block-${block.id} textarea`)?.focus())
  }
  const remove = (index: number) => {
    setRemoved({ block: blocks[index]!, index })
    edit((d) => ({ ...d, blocks: removeAt(d.blocks, index) }))
  }
  const undo = () => {
    if (!removed) return
    edit((d) => ({ ...d, blocks: [...d.blocks.slice(0, removed.index), removed.block, ...d.blocks.slice(removed.index)] }))
    setRemoved(null)
  }
  const menu = (at: number) => insertAt === at && <AddMenu onAdd={(type) => add(type, at)} hasHomework={blocks.some((x) => x.type === 'homework')} />

  return (
    <>
      {removed && (
        <div className={b.banner} role="status">
          Блок «{BLOCK_LABELS[removed.block.type]}» видалено.
          <button type="button" className={t.btnSmall} onClick={undo}>
            Повернути
          </button>
          <button type="button" className={t.linkBtn} onClick={() => setRemoved(null)}>
            Закрити
          </button>
        </div>
      )}
      <p id="plain-hint" className="visually-hidden">
        Абзаци відокремлюй порожнім рядком.
      </p>
      {blocks.map((block, i) => (
        <div key={block.id} style={{ display: 'contents' }}>
          {i > 0 && (
            <button type="button" className={b.insert} onClick={() => setInsertAt(insertAt === i ? null : i)} aria-label={`Додати блок перед блоком ${i + 1}`}>
              + блок
            </button>
          )}
          {i > 0 && menu(i)}
          <BlockCard block={block} index={i} refs={refs} onRemove={() => remove(i)} />
        </div>
      ))}
      <button type="button" className={b.addBlock} onClick={() => setInsertAt(insertAt === blocks.length ? null : blocks.length)} aria-expanded={insertAt === blocks.length}>
        + Додати блок
      </button>
      {menu(blocks.length)}
    </>
  )
}
