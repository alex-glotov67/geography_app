import { Link } from '@tanstack/react-router'
import { useMe } from '@/api/auth'
import { ContourBackground } from '@/components/ContourBackground'
import { GradeTile } from '@/components/GradeTile'
import { GRADES } from '@/lib/grades'
import classes from './HomePage.module.css'

const LoginIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--water)' }}>
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <path d="M10 17l5-5-5-5" />
    <path d="M15 12H3" />
  </svg>
)

const PersonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--water)' }}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </svg>
)

/** «Увійти» для гостя; ім'я учня з переходом у кабінет; «Кабінет вчителя» для вчителя */
function AccountLink() {
  const me = useMe()
  if (me?.kind === 'student') {
    return (
      <Link to="/me" className={classes.login}>
        <PersonIcon />
        {me.displayName}
      </Link>
    )
  }
  if (me?.kind === 'teacher') {
    return (
      <Link to="/t" className={classes.login}>
        <PersonIcon />
        Кабінет вчителя
      </Link>
    )
  }
  return (
    <Link to="/login" className={classes.login}>
      <LoginIcon />
      Увійти
    </Link>
  )
}

/**
 * Вибір класу (SPEC 8.1, макет Main.dc.html). Для учня, що увійшов, — ім'я замість «Увійти»
 * з переходом у кабінет; «Продовжити, де зупинився» — з кабінетом учня (Фаза 4).
 */
export function HomePage() {
  const me = useMe()
  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <ContourBackground />
        <div className={classes.headerInner}>
          <AccountLink />
          <h1 className={classes.title}>Географія</h1>
          <p className={classes.lead}>Уроки, завдання і домашні роботи для 6–9 класів</p>
        </div>
      </header>

      <main className={classes.main}>
        <h2 className={classes.h2}>Обери свій клас</h2>
        <nav aria-label="Класи" className={classes.grades}>
          {GRADES.map((g) => (
            <GradeTile key={g} grade={g} />
          ))}
        </nav>
        <p className={classes.hint}>Кольори класів — як висоти на фізичній карті: від низовини до гір.</p>

        <Link to="/quiz" className={classes.card}>
          <span className={classes.cardIcon} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
              <path d="M6 4l14 8-14 8z" />
            </svg>
          </span>
          <span className={classes.cardText}>
            <span className={classes.cardTitle}>Живий квіз</span>
            <span className={classes.cardSub}>Увійти за PIN-кодом з екрана</span>
          </span>
        </Link>
      </main>

      {!me && (
        <footer className={classes.footer}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <p>Уроки відкриті без входу. Щоб виконувати домашні завдання, увійди з логіном від вчителя.</p>
        </footer>
      )}
    </div>
  )
}
