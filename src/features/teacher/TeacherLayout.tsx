import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { signOut, type Me } from '@/api/auth'
import t from './teacher.module.css'

/** Пункти меню — лише те, що вже працює; Уроки, Банк, Результати, Квізи з'являться у своїх фазах */
const LINKS = [
  { to: '/t', label: 'Огляд', exact: true },
  { to: '/t/classes', label: 'Класи й учні', exact: false },
  { to: '/t/settings', label: 'Налаштування', exact: true },
] as const

/** Кабінет вчителя (SPEC 8.2): меню зліва на комп'ютері, над вмістом на телефоні */
export function TeacherLayout({ me }: { me: Extract<Me, { kind: 'teacher' }> }) {
  const navigate = useNavigate()
  return (
    <div className={t.layout}>
      <nav className={t.nav} aria-label="Кабінет вчителя">
        <Link to="/t" className={t.brand}>
          Географія
        </Link>
        <span className={t.brandSub}>Кабінет вчителя</span>
        <div className={t.navLinks}>
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className={t.navLink} activeOptions={{ exact: l.exact }}>
              {l.label}
            </Link>
          ))}
        </div>
        <div className={t.navFoot}>
          <span className={t.who}>{me.displayName || 'Вчитель'}</span>
          <Link to="/" className={t.navLink}>
            Сайт для учнів
          </Link>
          <button
            type="button"
            className={t.btn}
            onClick={async () => {
              await signOut()
              await navigate({ to: '/login', replace: true })
            }}
          >
            Вийти
          </button>
        </div>
      </nav>
      <main className={t.content}>
        <Outlet />
      </main>
    </div>
  )
}
