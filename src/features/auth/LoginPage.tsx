import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { LoginError, signIn } from '@/api/auth'
import { ContourBackground } from '@/components/ContourBackground'
import classes from './LoginPage.module.css'

/*
 * Вхід (SPEC 5.1, 8.1; макет Login.dc.html). Одне поле «Логін»: учень вводить логін з картки
 * (8b-07), вчитель — свій email. React Hook Form + zod — як у всіх формах (SPEC 3.2).
 */

const LoginForm = z.object({
  login: z.string().trim().min(1, 'Введи логін'),
  password: z.string().min(1, 'Введи пароль'),
})
type LoginForm = z.infer<typeof LoginForm>

export function LoginPage({ initialLogin, redirect }: { initialLogin?: string; redirect?: string }) {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(LoginForm), defaultValues: { login: initialLogin ?? '', password: '' } })

  const onSubmit = handleSubmit(async ({ login, password }) => {
    setServerError(null)
    try {
      const me = await signIn(login, password)
      const fallback = me.kind === 'teacher' ? '/t' : '/'
      await navigate({ to: redirect ?? fallback, replace: true })
    } catch (e) {
      setServerError(e instanceof LoginError ? e.message : 'Не вдалося увійти. Спробуй ще раз.')
    }
  })

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <ContourBackground />
        <div className={classes.headerInner}>
          <span className={classes.brand}>Географія</span>
          <h1 className={classes.title}>Вхід</h1>
        </div>
      </header>

      <main className={classes.main}>
        <form className={classes.form} onSubmit={onSubmit} noValidate>
          <label className={classes.field}>
            <span className={classes.label}>Логін</span>
            <input
              {...register('login')}
              className={`${classes.input} ${classes.mono}`}
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Наприклад: 8b-07"
              aria-invalid={!!errors.login}
              aria-describedby={errors.login ? 'login-error' : undefined}
            />
            {errors.login && (
              <span id="login-error" className={classes.fieldError}>
                {errors.login.message}
              </span>
            )}
          </label>

          <div className={classes.field}>
            <label htmlFor="password" className={classes.label}>
              Пароль
            </label>
            <span className={classes.passwordWrap}>
              <input
                {...register('password')}
                id="password"
                className={`${classes.input} ${classes.mono} ${classes.passwordInput}`}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
              />
              <button
                type="button"
                className={classes.eye}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Сховати пароль' : 'Показати пароль'}
                aria-pressed={showPassword}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                  {showPassword && <path d="M3 3l18 18" />}
                </svg>
              </button>
            </span>
            {errors.password && (
              <span id="password-error" className={classes.fieldError}>
                {errors.password.message}
              </span>
            )}
          </div>

          {serverError && (
            <p className={classes.error} role="alert">
              {serverError}
            </p>
          )}

          <button type="submit" className={classes.submit} disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? 'Входимо…' : 'Увійти'}
          </button>
          <p className={classes.hint}>Логін і пароль видає вчитель. Забув їх? Скажи вчителю — він створить новий пароль.</p>
        </form>

        <div className={classes.divider} />

        <Link to="/quiz" className={classes.card}>
          <span className={classes.cardIcon} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 3l14 9-14 9z" />
            </svg>
          </span>
          <span className={classes.cardText}>
            <span className={classes.cardTitle}>Живий квіз</span>
            <span className={classes.cardSub}>Увійти за PIN-кодом з екрана</span>
          </span>
        </Link>
        <Link to="/" className={classes.guest}>
          Переглянути уроки без входу
        </Link>
      </main>
    </div>
  )
}
