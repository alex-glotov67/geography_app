import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import type { Me } from '@/api/auth'
import { saveSettings } from '@/api/teacher'
import t from './teacher.module.css'

/*
 * Налаштування (SPEC 8.2): назва школи (на картках входу), префікс логінів (якщо в школі кілька
 * вчителів), чи може учень сам змінювати пароль. Таблиця переведення % у бали — з результатами (Фаза 7).
 */

const Settings = z.object({
  schoolName: z.string().trim().min(1, 'Назва школи потрібна для карток входу').max(120, 'Задовга назва'),
  loginPrefix: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]{0,6}$/, 'До 6 малих латинських літер чи цифр, напр. hl'),
  studentsCanChangePassword: z.boolean(),
})
type Settings = z.infer<typeof Settings>

export function SettingsPage({ me }: { me: Extract<Me, { kind: 'teacher' }> }) {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState, control } = useForm<Settings>({
    resolver: zodResolver(Settings),
    defaultValues: {
      schoolName: me.schoolName,
      loginPrefix: me.loginPrefix,
      studentsCanChangePassword: me.studentsCanChangePassword,
    },
  })
  const prefix = useWatch({ control, name: 'loginPrefix' })

  const onSubmit = handleSubmit(async (values) => {
    setSaved(false)
    setError(null)
    try {
      await saveSettings(me.id, me.schoolId, values)
      await qc.invalidateQueries({ queryKey: ['me'] })
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося зберегти')
    }
  })

  return (
    <>
      <div className={t.pageHead}>
        <h1 className={t.pageTitle}>Налаштування</h1>
      </div>
      <form className={t.card} onSubmit={onSubmit} noValidate style={{ maxWidth: 720 }}>
        <label className={t.field}>
          <span className={t.fieldLabel}>Назва школи — на картках входу</span>
          <input className={t.input} {...register('schoolName')} aria-invalid={!!formState.errors.schoolName} />
          {formState.errors.schoolName && <span className={t.fieldError}>{formState.errors.schoolName.message}</span>}
        </label>
        <label className={t.field}>
          <span className={t.fieldLabel}>Префікс логінів — лише якщо в школі кілька вчителів (інакше порожньо)</span>
          <input
            className={`${t.input} ${t.mono}`}
            {...register('loginPrefix')}
            maxLength={6}
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={!!formState.errors.loginPrefix}
            aria-describedby="prefix-example"
          />
          {formState.errors.loginPrefix ? (
            <span className={t.fieldError}>{formState.errors.loginPrefix.message}</span>
          ) : (
            <span id="prefix-example" className={t.note}>
              Нові логіни матимуть вигляд <span className={t.mono}>{prefix ? `${prefix.toLowerCase()}-` : ''}8b-07</span>. Наявні логіни не
              змінюються.
            </span>
          )}
        </label>
        <label className={t.check}>
          <input type="checkbox" {...register('studentsCanChangePassword')} />
          Учень може сам змінити пароль у своєму кабінеті
        </label>
        {error && (
          <p className={t.alert} role="alert">
            {error}
          </p>
        )}
        {saved && !formState.isDirty && (
          <p className={t.success} role="status">
            Збережено
          </p>
        )}
        <div className={t.footerActions} style={{ justifyContent: 'flex-start' }}>
          <button type="submit" className={t.btnPrimary} disabled={formState.isSubmitting}>
            Зберегти
          </button>
        </div>
      </form>
    </>
  )
}
