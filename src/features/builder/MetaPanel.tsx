import { useState } from 'react'
import type { BuilderTask, DirSection } from '@/api/builder'
import t from '@/features/teacher/teacher.module.css'
import { grSummary, lessonTaskIds } from './draft'
import { useBuilder } from './store'
import b from './builder.module.css'

/**
 * «Про урок» (SPEC 10.2, макет LessonBuilder): тема, №, розділ, § і сторінки, КТП, адреса;
 * очікувані результати — з довідника деревом розділ → тема → результат; підсумок ГР рахується
 * з тегів завдань уроку, а не вводиться.
 */
export function MetaPanel({ directory, tasks }: { directory: DirSection[]; tasks: Record<string, BuilderTask> }) {
  const draft = useBuilder((s) => s.draft)!
  const publishedVersion = useBuilder((s) => s.publishedVersion)
  const edit = useBuilder((s) => s.edit)
  const [picking, setPicking] = useState(false)

  const sections = directory.filter((s) => s.grade === draft.grade)
  const outcomes = directory.flatMap((s) =>
    s.topics.flatMap((tp) => tp.outcomes.map((o) => ({ ...o, section: s, topic: tp }))),
  )
  const selected = outcomes.filter((o) => draft.outcomeIds.includes(o.id))
  const groups = lessonTaskIds(draft).flatMap((id) => (tasks[id] ? [tasks[id].grp] : []))
  const summary = grSummary(groups)
  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => edit((d) => ({ ...d, [key]: value }))
  const toggleOutcome = (id: string) =>
    edit((d) => ({ ...d, outcomeIds: d.outcomeIds.includes(id) ? d.outcomeIds.filter((x) => x !== id) : [...d.outcomeIds, id] }))

  return (
    <section className={b.panel} aria-labelledby="meta-title">
      <h2 id="meta-title" className={b.panelTitle}>
        Про урок
      </h2>
      <label className={t.field}>
        <span className={t.fieldLabel}>Тема</span>
        <input className={t.input} value={draft.title} onChange={(e) => set('title', e.target.value)} />
      </label>
      <div className={t.fieldRow}>
        <label className={t.field} style={{ flexBasis: 90, flexGrow: 0 }}>
          <span className={t.fieldLabel}>№ уроку</span>
          <input
            className={t.input}
            type="number"
            min={1}
            value={draft.number ?? ''}
            onChange={(e) => set('number', e.target.value ? Number(e.target.value) : null)}
          />
        </label>
        <label className={t.field} style={{ flexBasis: 180 }}>
          <span className={t.fieldLabel}>Розділ</span>
          <select className={t.select} value={draft.sectionId ?? ''} onChange={(e) => set('sectionId', e.target.value || null)}>
            <option value="">Без розділу</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.number === 0 ? 'Вступ' : `${s.number}. ${s.title}`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={t.fieldRow}>
        <label className={t.field} style={{ flexBasis: 100 }}>
          <span className={t.fieldLabel}>§</span>
          <input
            className={t.input}
            value={draft.textbookRef?.paragraph ?? ''}
            onChange={(e) => set('textbookRef', { ...draft.textbookRef, paragraph: e.target.value })}
          />
        </label>
        <label className={t.field} style={{ flexBasis: 100 }}>
          <span className={t.fieldLabel}>Сторінки</span>
          <input
            className={t.input}
            value={draft.textbookRef?.pages ?? ''}
            onChange={(e) => set('textbookRef', { ...draft.textbookRef, pages: e.target.value })}
          />
        </label>
      </div>
      <label className={t.field}>
        <span className={t.fieldLabel}>Рядок КТП</span>
        <input className={t.input} value={draft.ktpRef ?? ''} onChange={(e) => set('ktpRef', e.target.value)} />
      </label>
      <label className={t.field}>
        <span className={t.fieldLabel}>Адреса: /lesson/…</span>
        <input
          className={`${t.input} ${t.mono}`}
          value={draft.slug}
          spellCheck={false}
          autoCapitalize="none"
          disabled={publishedVersion !== null}
          aria-describedby="slug-note"
          onChange={(e) => set('slug', e.target.value.trim().toLowerCase())}
        />
        <span id="slug-note" className={t.note}>
          {publishedVersion !== null ? 'Урок уже публікувався — адреса є в QR-кодах і не змінюється.' : 'Після першої публікації адреса не змінюється.'}
        </span>
      </label>

      <span className={t.strong} style={{ fontSize: 15 }}>
        Очікувані результати
      </span>
      {selected.length === 0 ? (
        <span className={t.note}>Ще не обрано.</span>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {selected.map((o) => (
            <li key={o.id} style={{ display: 'flex', gap: 8, fontSize: 14, lineHeight: 1.35 }}>
              <span className={t.mono} style={{ fontSize: 12, color: 'var(--muted)', paddingTop: 2, flexShrink: 0 }}>
                {o.code}
              </span>
              <span style={{ flexGrow: 1 }}>{o.text}</span>
              <button type="button" className={b.iconBtn} onClick={() => toggleOutcome(o.id)} aria-label={`Прибрати результат ${o.code}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className={b.addInline} onClick={() => setPicking((v) => !v)} aria-expanded={picking}>
        {picking ? 'Готово' : '+ з довідника'}
      </button>
      {picking && (
        <div role="group" aria-label="Довідник програми" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sections.length === 0 && <span className={t.note}>Для {draft.grade} класу довідник порожній — імпортуй його в «Довідник програми».</span>}
          {sections.map((s) => (
            <details key={s.id} open={s.id === draft.sectionId}>
              <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                {s.number === 0 ? 'Вступ' : `Розділ ${s.number}`}. {s.title}
              </summary>
              {s.topics.map((tp) => (
                <fieldset key={tp.id} style={{ border: 0, margin: '0 0 6px', padding: '0 0 0 8px' }}>
                  <legend style={{ fontSize: 13, color: 'var(--muted)', padding: 0 }}>
                    {tp.number === 0 ? 'Вступ' : `Тема ${tp.number}`}. {tp.title}
                  </legend>
                  {tp.outcomes
                    .filter((o) => !o.archived || draft.outcomeIds.includes(o.id))
                    .map((o) => (
                      <label key={o.id} className={t.check} style={{ alignItems: 'flex-start', fontSize: 14, minHeight: 44, paddingTop: 10 }}>
                        <input type="checkbox" checked={draft.outcomeIds.includes(o.id)} onChange={() => toggleOutcome(o.id)} />
                        <span>
                          <span className={t.mono} style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {o.code}
                          </span>{' '}
                          {o.text}
                        </span>
                      </label>
                    ))}
                </fieldset>
              ))}
            </details>
          ))}
        </div>
      )}
      <span className={t.note}>{summary ? `За тегами завдань уроку: ${summary}` : 'Завдань в уроці ще немає — підсумок ГР з’явиться з ними.'}</span>
    </section>
  )
}
