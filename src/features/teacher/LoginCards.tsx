import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { encode } from 'uqr'
import type { Credentials } from '@shared/schemas/students.ts'
import { loginUrl } from '@/lib/links'
import classes from './LoginCards.module.css'

/*
 * Картки входу для друку (SPEC 5.1): A4, 10 карток (2×5). На картці — школа, прізвище й ініціал,
 * клас, адреса сайту, логін і пароль (JetBrains Mono), QR на сторінку входу з підставленим
 * логіном. Друк — через діалог браузера (там само «Зберегти як PDF» для попереднього перегляду).
 * Пароль є лише тут і в таблиці щойно створених акаунтів: на сервері він не зберігається.
 */

const PER_SHEET = 10

/** QR як SVG-шлях (без innerHTML): кожен темний модуль — квадрат 1×1 */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { path, size } = useMemo(() => {
    const qr = encode(value, { ecc: 'M', border: 2 })
    let d = ''
    qr.data.forEach((row, y) => row.forEach((on, x) => on && (d += `M${x} ${y}h1v1h-1z`)))
    return { path: d, size: qr.size }
  }, [value])
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={classes.qr} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  )
}

interface Props {
  credentials: Credentials[]
  className: string
  schoolName: string
  /** Після закриття діалогу друку */
  onDone: () => void
}

/** Аркуші карток у портал поза #root: на екрані приховані, при друці — лише вони */
export function LoginCards({ credentials, className, schoolName, onDone }: Props) {
  useEffect(() => {
    document.body.classList.add(classes.printing!)
    const after = () => onDone()
    window.addEventListener('afterprint', after)
    // Дати браузеру відмалювати картки до відкриття діалогу
    const id = window.setTimeout(() => window.print(), 50)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('afterprint', after)
      document.body.classList.remove(classes.printing!)
    }
  }, [onDone])

  const sheets: Credentials[][] = []
  for (let i = 0; i < credentials.length; i += PER_SHEET) sheets.push(credentials.slice(i, i + PER_SHEET))
  const host = window.location.host

  return createPortal(
    <div className={classes.root} data-print-cards="">
      {sheets.map((sheet, i) => (
        <section key={i} className={classes.sheet} aria-label={`Аркуш ${i + 1}`}>
          {sheet.map((c) => (
            <article key={c.id} className={classes.card}>
              <div className={classes.text}>
                {schoolName && <span className={classes.school}>{schoolName}</span>}
                <span className={classes.name}>
                  {c.displayName}, {className}
                </span>
                <span className={classes.site}>{host}/login</span>
                <span className={classes.row}>
                  <span className={classes.label}>Логін</span>
                  <span className={classes.mono}>{c.login}</span>
                </span>
                <span className={classes.row}>
                  <span className={classes.label}>Пароль</span>
                  <span className={classes.mono}>{c.password}</span>
                </span>
              </div>
              <QrCode value={loginUrl(c.login)} label={`QR-код входу для ${c.login}`} />
            </article>
          ))}
        </section>
      ))}
    </div>,
    document.body,
  )
}
