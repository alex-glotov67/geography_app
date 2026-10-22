import { useEffect, useMemo, useState } from 'react'
import { useMediaQuery } from '@mantine/hooks'
import { useQuery } from '@tanstack/react-query'
import { isNotFound, Link } from '@tanstack/react-router'
import type { Me } from '@/api/auth'
import { builderLessonQuery, directoryQuery } from '@/api/builder'
import t from '@/features/teacher/teacher.module.css'
import { TeacherPageSkeleton } from '@/features/teacher/TeacherSkeletons'
import { BlockEditors } from './BlockEditors'
import { MetaPanel } from './MetaPanel'
import { PublishDialog } from './PublishDialog'
import { useBuilder, type SaveState } from './store'
import { ChecksPanel, StructurePanel } from './StructurePanel'
import { useBuilderSession, type BuilderSession } from './useBuilderSession'
import { validateDraft } from './validateDraft'
import b from './builder.module.css'

/*
 * Конструктор уроку (SPEC 10.1–10.2, макет LessonBuilder): лише комп'ютер ≥ 1024 px; на телефоні —
 * перегляд без редагування. Перегляд чернетки — окрема сторінка в iframe (справжні розміри телефона
 * й комп'ютера), чернетку вона бере з localStorage, куди store пише кожну правку.
 */

type Teacher = Extract<Me, { kind: 'teacher' }>
type View = 'edit' | 'phone' | 'desktop' | 'simplified'

const VIEWS: { value: View; label: string }[] = [
  { value: 'edit', label: 'Редагування' },
  { value: 'phone', label: 'Телефон' },
  { value: 'desktop', label: 'Комп’ютер' },
  { value: 'simplified', label: 'Спрощений' },
]

const time = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' })

function SaveStatus({ state, savedAt }: { state: SaveState; savedAt: Date | null }) {
  const text: Record<SaveState, string> = {
    saved: savedAt ? `Збережено о ${time.format(savedAt)}` : 'Усі зміни збережено',
    dirty: 'Є незбережені зміни',
    saving: 'Зберігаємо…',
    offline: 'Не збережено — немає зв’язку, повторюємо',
    conflict: 'Не збережено — урок змінено деінде',
  }
  return (
    <span className={state === 'offline' || state === 'conflict' ? b.savedError : b.saved} role="status" aria-live="polite">
      {text[state]}
    </span>
  )
}

function Preview({ lessonId, view }: { lessonId: string; view: Exclude<View, 'edit'> }) {
  const src = `/t/lessons/${lessonId}/preview${view === 'simplified' ? '?simplified=1' : ''}`
  return (
    <div className={b.previewWrap}>
      <iframe key={view} src={src} title="Перегляд чернетки очима учня" className={view === 'desktop' ? b.previewDesktop : b.previewPhone} />
    </div>
  )
}

function Unpublish({ session, onClose }: { session: BuilderSession; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className={b.overlay}>
      <section className={b.dialog} role="alertdialog" aria-modal="true" aria-labelledby="unpub-title">
        <h2 id="unpub-title" className={t.h2}>
          Зняти урок з публікації?
        </h2>
        <p className={t.note} style={{ maxWidth: 'none' }}>
          Учні й гості перестануть бачити урок. Видані домашні завдання не скасовуються. Урок і всі його версії лишаються — його можна
          опублікувати знову.
        </p>
        {error && (
          <p className={t.alert} role="alert">
            {error}
          </p>
        )}
        <div className={t.footerActions}>
          <button type="button" className={t.btn} onClick={onClose} disabled={busy}>
            Скасувати
          </button>
          <button
            type="button"
            className={t.btnPrimary}
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              const message = await session.unpublish()
              setBusy(false)
              if (message) setError(message)
              else onClose()
            }}
          >
            Зняти з публікації
          </button>
        </div>
      </section>
    </div>
  )
}

export function BuilderPage({ me, lessonId }: { me: Teacher; lessonId: string }) {
  const lesson = useQuery(builderLessonQuery(lessonId))
  const directory = useQuery(directoryQuery(me.id))
  const session = useBuilderSession(lessonId)
  const s = useBuilder()
  const wide = useMediaQuery('(min-width: 64em)', true)
  const [view, setView] = useState<View>('edit')
  const [dialog, setDialog] = useState<'publish' | 'unpublish' | null>(null)

  // Перше відкриття уроку: чернетка з сервера; незбережена копія з минулої вкладки — пропозиція
  useEffect(() => {
    if (lesson.data && useBuilder.getState().lessonId !== lessonId) useBuilder.getState().open(lesson.data)
  }, [lesson.data, lessonId])

  const refs = lesson.data
  const checks = useMemo(() => (s.draft && refs ? validateDraft(s.draft, refs) : { errors: [], warnings: [] }), [s.draft, refs])

  if (lesson.isError) {
    return (
      <p className={`${t.alert} ${b.narrow}`}>
        {isNotFound(lesson.error) ? 'Урок не знайдено.' : 'Не вдалося завантажити урок. Онови сторінку.'}{' '}
        <Link to="/t/lessons" search={{ grade: 8 }}>
          До уроків
        </Link>
      </p>
    )
  }
  if (!refs || !directory.data || s.lessonId !== lessonId || !s.draft) return <TeacherPageSkeleton rows={8} standalone />

  const d = s.draft
  const heading = `${d.grade} клас · ${d.number ? `Урок ${d.number}. ` : ''}${d.title || 'Без теми'}`
  const shownView = wide ? view : 'phone'

  return (
    <div className={b.page}>
      <header className={b.head}>
        <Link to="/t/lessons" search={{ grade: d.grade }} className={b.back}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Уроки
        </Link>
        <h1 className={b.title} title={heading}>
          {heading}
        </h1>
        {s.isPublished ? (
          <span className={b.pillPublished}>
            Опубліковано (версія {s.publishedVersion}){s.changedSincePublish ? ' · є неопубліковані зміни' : ''}
          </span>
        ) : (
          <span className={b.pillDraft}>Чернетка — учні не бачать</span>
        )}
        {refs.isDemo && <span className={b.pillDraft}>ДЕМО</span>}
        <SaveStatus state={s.saveState} savedAt={s.savedAt} />
        <span className={b.spacer} />
        {wide && (
          <div className={b.segmented} role="group" aria-label="Режим">
            {VIEWS.map((v) => (
              <button key={v.value} type="button" className={b.segment} aria-pressed={view === v.value} onClick={() => setView(v.value)}>
                {v.label}
              </button>
            ))}
          </div>
        )}
        {s.isPublished && (
          <>
            <a href={`/lesson/${d.slug}`} target="_blank" rel="noreferrer" className={t.btn}>
              Очима учня
            </a>
            <button type="button" className={t.btn} onClick={() => setDialog('unpublish')}>
              Зняти з публікації
            </button>
          </>
        )}
        {wide && (
          <button
            type="button"
            className={t.btnPrimary}
            onClick={() => setDialog('publish')}
            disabled={s.isPublished && !s.changedSincePublish && s.saveState === 'saved'}
          >
            {s.isPublished ? 'Опублікувати зміни' : 'Опублікувати'}
          </button>
        )}
      </header>

      {s.saveState === 'conflict' && (
        <div className={b.bannerError} role="alert">
          Урок змінено в іншій вкладці чи на іншому пристрої — твої останні зміни не збережено.
          <button type="button" className={t.btnSmall} onClick={session.overwrite}>
            Перезаписати моїми змінями
          </button>
          <button type="button" className={t.btnSmall} onClick={() => void session.reload()}>
            Завантажити збережену версію
          </button>
        </div>
      )}
      {s.pendingRestore && (
        <div className={b.banner} role="alert">
          Є незбережені зміни від {new Date(s.pendingRestore.at).toLocaleString('uk-UA')} (вкладку закрито до збереження).
          <button type="button" className={t.btnSmall} onClick={() => void session.restore(s.pendingRestore!.draft)}>
            Відновити
          </button>
          <button type="button" className={t.btnSmall} onClick={s.dismissRestore}>
            Відкинути
          </button>
        </div>
      )}
      {!wide && <p className={`${t.notice} ${b.narrow}`}>Редагувати урок можна на комп’ютері (екран від 1024 px). Тут — перегляд очима учня.</p>}

      {shownView === 'edit' ? (
        <div className={b.body} onBlurCapture={() => void session.flush()}>
          <aside className={b.side} aria-label="Про урок і структура">
            <MetaPanel directory={directory.data} tasks={refs.tasks} />
            <StructurePanel />
            <ChecksPanel errors={checks.errors} warnings={checks.warnings} />
          </aside>
          <main className={b.center}>
            <BlockEditors refs={refs} />
          </main>
        </div>
      ) : (
        <Preview lessonId={lessonId} view={shownView} />
      )}

      {dialog === 'publish' && (
        <PublishDialog
          errors={checks.errors}
          warnings={checks.warnings}
          republish={s.isPublished}
          onPublish={session.publish}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'unpublish' && <Unpublish session={session} onClose={() => setDialog(null)} />}
    </div>
  )
}
