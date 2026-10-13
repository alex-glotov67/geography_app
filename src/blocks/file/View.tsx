import type { z } from 'zod'
import type { FileBlock } from '@shared/schemas/blocks.ts'
import { useLesson } from '../lessonContext'
import classes from '../blocks.module.css'

export function FileView({ block }: { block: z.infer<typeof FileBlock> }) {
  const { media } = useLesson()
  const m = media[block.mediaId]
  if (!m) return null
  return (
    <a className={classes.linkRow} href={m.url} target="_blank" rel="noopener noreferrer">
      <span className={classes.fileBadge} aria-hidden="true">
        PDF
      </span>
      <span className={classes.linkTitle}>{block.title}</span>
      <span className={classes.linkMeta}>відкрити</span>
    </a>
  )
}
