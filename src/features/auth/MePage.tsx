import { Link, useNavigate } from '@tanstack/react-router'
import { signOut, type Me } from '@/api/auth'
import classes from './MePage.module.css'

/**
 * Мій кабінет учня (SPEC 8.1, макет Cabinet.dc.html) — у Фазі 2 лише ім'я, клас і помітна кнопка
 * «Вийти» (спільні шкільні комп'ютери). «Чекає на тебе», результати й «Мій підйом» — з ДЗ (Фаза 4).
 */
export function MePage({ me }: { me: Extract<Me, { kind: 'student' }> }) {
  const navigate = useNavigate()
  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <Link to="/" className={classes.back}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Уроки
        </Link>
        <h1 className={classes.name}>{me.displayName}</h1>
        <p className={classes.cls}>Клас {me.className}</p>
      </header>
      <main className={classes.main}>
        <section className={classes.card}>
          <h2 className={classes.h2}>Чекає на тебе</h2>
          <p className={classes.text}>Тут з'являться домашні завдання від вчителя. Поки що можна тренуватися в уроках.</p>
          <Link to="/" className={classes.link}>
            До уроків
          </Link>
        </section>
        <button
          type="button"
          className={classes.logout}
          onClick={async () => {
            await signOut()
            await navigate({ to: '/', replace: true })
          }}
        >
          Вийти
        </button>
        <p className={classes.hint}>На спільному комп'ютері завжди виходь після роботи.</p>
      </main>
    </div>
  )
}
