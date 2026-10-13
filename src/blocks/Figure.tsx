import type { MediaInfo } from './lessonContext'
import classes from './blocks.module.css'

/** Зображення з медіатеки: alt, підпис, джерело й ліцензія (SPEC 10.5). Розміри — щоб не було зсуву. */
export function Figure({ media, caption }: { media: MediaInfo | undefined; caption?: string }) {
  if (!media) return null
  const credit = [media.source && `Джерело: ${media.source}`, media.license].filter(Boolean).join(', ')
  const text = caption ?? media.caption
  return (
    <figure className={classes.figure}>
      <img
        className={classes.image}
        src={media.url}
        alt={media.alt ?? ''}
        width={media.width ?? undefined}
        height={media.height ?? undefined}
        loading="lazy"
        decoding="async"
      />
      {(text || credit) && (
        <figcaption>
          {text && <span className={classes.caption}>{text} </span>}
          {credit && <span className={classes.credit}>{credit}</span>}
        </figcaption>
      )}
    </figure>
  )
}
