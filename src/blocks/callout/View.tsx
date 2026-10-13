import type { z } from 'zod'
import type { CalloutBlock } from '@shared/schemas/blocks.ts'
import { RichText } from '../RichText'
import classes from '../blocks.module.css'

const TITLES = { interesting: 'Цікаво знати', attention: 'Зверни увагу', local: 'Мій край' } as const

export function CalloutView({ block }: { block: z.infer<typeof CalloutBlock> }) {
  return (
    <aside className={classes.callout} data-variant={block.variant}>
      <h3 className={classes.calloutTitle}>{block.title ?? TITLES[block.variant]}</h3>
      <RichText doc={block.doc} />
    </aside>
  )
}
