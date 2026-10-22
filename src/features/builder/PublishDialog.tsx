import { useEffect, useRef, useState } from 'react'
import t from '@/features/teacher/teacher.module.css'
import type { DraftIssue } from './validateDraft'
import b from './builder.module.css'

interface Props {
  errors: DraftIssue[]
  warnings: DraftIssue[]
  /** Повторна публікація — учні зараз бачать попередню версію */
  republish: boolean
  /** Зберегти й опублікувати; рядок — помилка від сервера */
  onPublish: () => Promise<string | null>
  onClose: () => void
}

/**
 * Діалог публікації (SPEC 10.2): помилки блокують, попередження — ні; галочка «Я переглянув урок»
 * — це позначка reviewed_by_teacher, яку сервер ставить разом із публікацією.
 */
export function PublishDialog({ errors, warnings, republish, onPublish, onClose }: Props) {
  const [reviewed, setReviewed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const first = useRef<HTMLElement>(null)

  useEffect(() => {
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const submit = async () => {
    setBusy(true)
    setError(null)
    const message = await onPublish()
    setBusy(false)
    if (message) setError(message)
    else onClose()
  }

  return (
    <div className={b.overlay}>
      <section className={b.dialog} role="dialog" aria-modal="true" aria-labelledby="publish-title">
        <h2 id="publish-title" className={t.h2} ref={first as React.RefObject<HTMLHeadingElement>} tabIndex={-1}>
          {republish ? 'Опублікувати нову версію' : 'Опублікувати урок'}
        </h2>
        {errors.length > 0 ? (
          <div className={t.alert}>
            <p style={{ margin: '0 0 6px' }}>Спершу виправ ({errors.length}):</p>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {errors.map((i) => (
                <li key={i.message}>{i.message}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className={t.success}>Помилок немає — урок можна публікувати.</p>
        )}
        {warnings.length > 0 && (
          <div className={t.notice}>
            <p style={{ margin: '0 0 6px' }}>Попередження (не заважають публікації):</p>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {warnings.map((i) => (
                <li key={i.message}>{i.message}</li>
              ))}
            </ul>
          </div>
        )}
        <p className={t.note} style={{ maxWidth: 'none' }}>
          {republish
            ? 'Учні побачать нову версію одразу; видані ДЗ лишаються на своїй версії.'
            : 'Учні й гості побачать урок одразу після публікації.'}
        </p>
        <label className={t.check}>
          <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} disabled={errors.length > 0} />
          Я переглянув урок, зміст правильний
        </label>
        {error && (
          <p className={t.alert} role="alert">
            {error}
          </p>
        )}
        <div className={t.footerActions}>
          <button type="button" className={t.btn} onClick={onClose} disabled={busy}>
            Скасувати
          </button>
          <button type="button" className={t.btnPrimary} onClick={() => void submit()} disabled={busy || !reviewed || errors.length > 0} aria-busy={busy}>
            {busy ? 'Публікуємо…' : 'Опублікувати'}
          </button>
        </div>
      </section>
    </div>
  )
}
