import type { z } from 'zod'
import type { TextBlock } from '@shared/schemas/blocks.ts'
import layout from '@/features/lesson/lessonLayout.module.css'
import { RichText } from '../RichText'
import { useLesson } from '../lessonContext'
import classes from '../blocks.module.css'

/** Пояснення; у спрощеному режимі — простіший варіант тексту в зеленій рамці (Lesson.dc.html). */
export function TextView({ block }: { block: z.infer<typeof TextBlock> }) {
  const { simplified } = useLesson()
  const simple = simplified && block.simplifiedDoc
  return (
    <section className={layout.section}>
      <h2 className={layout.h2}>{block.title ?? 'Пояснення'}</h2>
      {simple ? <RichText doc={block.simplifiedDoc!} className={classes.simpleBox} /> : <RichText doc={block.doc} />}
    </section>
  )
}
