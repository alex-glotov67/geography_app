import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useBlocker } from '@tanstack/react-router'
import type { Credentials } from '@shared/schemas/students.ts'
import { manageStudents } from '@/api/teacher'
import { studentsWord } from '@/lib/plural'
import { useCredentials } from '@/stores/credentials'
import { LoginCards } from './LoginCards'
import { resetInBatches, type ResetFailure, type ResetTarget } from './resetBatches'
import t from './teacher.module.css'

/*
 * «Нові паролі» для одного учня, вибраних чи всього класу (SPEC 5.1): підтвердження → пачки по 10
 * з прогресом «Скинуто X з N» → підсумок: картки входу лише для цих учнів і список невдалих з
 * «Повторити». Нові паролі — лише в пам'яті вкладки (stores/credentials); до друку закрити чи
 * піти зі сторінки — з попередженням.
 */

const REASON: Record<ResetFailure['reason'], string> = {
  failed: 'збій сервера',
  network: 'немає зв’язку',
  archived: 'учень в архіві',
}

const LEAVE = 'Нові паролі ще не надруковано — після виходу їх більше не буде видно (лише як нові). Вийти?'

interface Props {
  classId: string
  targets: ResetTarget[]
  className: string
  schoolName: string
  onClose: () => void
}

export function PasswordReset({ classId, targets, className, schoolName, onClose }: Props) {
  const qc = useQueryClient()
  const addCredentials = useCredentials((s) => s.add)
  const [stage, setStage] = useState<'confirm' | 'running' | 'done'>('confirm')
  const [queue, setQueue] = useState<ResetTarget[]>(targets)
  const [done, setDone] = useState(0)
  const [credentials, setCredentials] = useState<Credentials[]>([])
  const [failures, setFailures] = useState<ResetFailure[]>([])
  const [printed, setPrinted] = useState(false)
  const [printing, setPrinting] = useState(false)
  const unprinted = credentials.length > 0 && !printed
  // Стабільний колбек: LoginCards відкриває друк в ефекті з цією залежністю
  const afterPrint = useCallback(() => {
    setPrinting(false)
    setPrinted(true)
  }, [])

  // Паролі ще не надруковано — попередити перед переходом зі сторінки чи закриттям вкладки
  useBlocker({ shouldBlockFn: () => unprinted && !window.confirm(LEAVE), enableBeforeUnload: () => unprinted })

  const run = useCallback(
    async (list: ResetTarget[]) => {
      setStage('running')
      setDone(0)
      setQueue(list)
      setFailures((f) => f.filter((x) => !list.some((y) => y.id === x.id)))
      await resetInBatches(
        list,
        async (ids) => manageStudents({ action: 'reset-password', studentIds: ids }),
        (batch, n) => {
          // Кожна пачка — одразу в пам'ять вкладки: обрив далі не губить уже скинутих
          if (batch.credentials.length) addCredentials(classId, batch.credentials)
          setCredentials((c) => [...c.filter((x) => !batch.credentials.some((y) => y.id === x.id)), ...batch.credentials].sort((a, b) => a.number - b.number))
          setFailures((f) => [...f, ...batch.failures])
          setPrinted(false)
          setDone(n)
        },
      )
      setStage('done')
      await qc.invalidateQueries({ queryKey: ['t', 'students', classId] })
    },
    [addCredentials, classId, qc],
  )

  const close = () => {
    if (unprinted && !window.confirm(LEAVE)) return
    onClose()
  }

  useEffect(() => {
    if (stage !== 'confirm') return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stage, onClose])

  const retryable = failures.filter((f) => f.reason !== 'archived')
  const single = targets.length === 1

  if (stage === 'confirm') {
    return (
      <section className={t.cardAccent} role="alertdialog" aria-labelledby="reset-title" aria-describedby="reset-text">
        <h2 id="reset-title" className={t.h2}>
          {single ? `Новий пароль: ${targets[0]!.displayName}` : `Нові паролі для ${studentsWord(targets.length)}`}
        </h2>
        <p id="reset-text" className={t.note} style={{ maxWidth: 640 }}>
          {single
            ? 'Старий пароль перестане діяти — учень увійде лише з новою карткою.'
            : 'Старі паролі цих учнів перестануть діяти — роздай їм нові картки. Паролі видно лише зараз, надрукуй картки одразу.'}
        </p>
        <div className={t.footerActions}>
          <button type="button" className={t.btn} onClick={onClose}>
            Скасувати
          </button>
          <button type="button" className={t.btnPrimary} onClick={() => void run(targets)}>
            {single ? 'Створити новий пароль' : 'Створити нові паролі'}
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className={t.cardAccent} aria-labelledby="reset-result">
      <div className={t.cardHead}>
        <h2 id="reset-result" className={t.h2}>
          Нові паролі
        </h2>
        <div className={t.actions}>
          <button type="button" className={t.btnPrimary} disabled={!credentials.length || stage === 'running'} onClick={() => setPrinting(true)}>
            Друкувати картки ({credentials.length})
          </button>
          <button type="button" className={t.btn} disabled={stage === 'running'} onClick={close}>
            Закрити
          </button>
        </div>
      </div>

      <p className={stage === 'running' ? t.note : retryable.length ? t.notice : t.success} role="status" aria-live="polite" style={{ maxWidth: 'none' }}>
        {stage === 'running' ? `Скинуто ${done} з ${queue.length}…` : `Готово: нові паролі для ${credentials.length} з ${credentials.length + failures.length}.`}
        {stage === 'done' && credentials.length > 0 && !printed && ' Надрукуй картки — паролі видно лише зараз.'}
      </p>
      <progress max={queue.length} value={done} aria-label="Прогрес нових паролів" style={{ width: '100%', height: 8 }} />

      {stage === 'done' && failures.length > 0 && (
        <div className={t.alert} role="alert">
          <p style={{ margin: '0 0 6px' }}>Не вдалося ({failures.length}) — старі паролі цих учнів і далі діють:</p>
          <ul style={{ margin: '0 0 8px', paddingLeft: 20 }}>
            {failures.map((f) => (
              <li key={f.id}>
                {f.displayName} — {REASON[f.reason]}
              </li>
            ))}
          </ul>
          {retryable.length > 0 && (
            <button type="button" className={t.btnSmall} onClick={() => void run(retryable)}>
              Повторити ({retryable.length})
            </button>
          )}
        </div>
      )}

      {printing && (
        <LoginCards
          credentials={credentials}
          className={className}
          schoolName={schoolName}
          onDone={afterPrint}
        />
      )}
    </section>
  )
}
