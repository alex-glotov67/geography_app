import type { z } from 'zod'
import type { ImageBlock } from '@shared/schemas/blocks.ts'
import { Figure } from '../Figure'
import { useLesson } from '../lessonContext'

export function ImageView({ block }: { block: z.infer<typeof ImageBlock> }) {
  const { media } = useLesson()
  return <Figure media={media[block.mediaId]} caption={block.caption} />
}
