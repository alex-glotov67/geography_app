import type { z } from 'zod'
import type { GoalBlock } from '@shared/schemas/blocks.ts'
import layout from '@/features/lesson/lessonLayout.module.css'
import classes from '../blocks.module.css'

export function GoalView({ block }: { block: z.infer<typeof GoalBlock> }) {
  return (
    <section className={layout.section}>
      <h2 className={layout.h2}>Що ти дізнаєшся</h2>
      <ul className={classes.list}>
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}
