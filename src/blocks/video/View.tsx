import { useState } from 'react'
import type { z } from 'zod'
import type { VideoBlock } from '@shared/schemas/blocks.ts'
import layout from '@/features/lesson/lessonLayout.module.css'
import { useLesson } from '../lessonContext'
import classes from '../blocks.module.css'

const duration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/**
 * Відео (SPEC 8.1, 12): лише затверджені, youtube-nocookie, iframe — тільки після натискання
 * (без трекерів і зайвого трафіку до кліку).
 */
export function VideoView({ block }: { block: z.infer<typeof VideoBlock> }) {
  const { videos } = useLesson()
  const [playing, setPlaying] = useState(false)
  const v = videos[block.videoId]
  if (!v) return null
  const params = new URLSearchParams({ autoplay: '1', rel: '0' })
  if (v.startSec) params.set('start', String(v.startSec))
  if (v.endSec) params.set('end', String(v.endSec))
  const meta = [v.channel, v.durationSec ? duration(v.durationSec) : null].filter(Boolean).join(', ')
  return (
    <section className={layout.section}>
      <h2 className={layout.h2}>Відео</h2>
      {playing ? (
        <iframe
          className={`${classes.videoFrame} ${layout.video}`}
          src={`https://www.youtube-nocookie.com/embed/${v.youtubeId}?${params}`}
          title={v.title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button type="button" className={`${classes.videoCover} ${layout.video}`} onClick={() => setPlaying(true)} aria-label={`Відтворити відео: ${v.title}`}>
          <span className={classes.play} aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="var(--water)">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className={classes.videoTitle}>{v.title}</span>
          {meta && <span className={classes.videoMeta}>{meta}</span>}
        </button>
      )}
      <p className={classes.note}>Відео завантажиться лише після натискання.</p>
    </section>
  )
}
