import type { z } from 'zod'
import type { GalleryBlock } from '@shared/schemas/blocks.ts'
import { Figure } from '../Figure'
import { useLesson } from '../lessonContext'
import classes from '../blocks.module.css'

export function GalleryView({ block }: { block: z.infer<typeof GalleryBlock> }) {
  const { media } = useLesson()
  return (
    <div className={classes.gallery}>
      {block.items.map((item) => (
        <Figure key={item.mediaId} media={media[item.mediaId]} caption={item.caption} />
      ))}
    </div>
  )
}
