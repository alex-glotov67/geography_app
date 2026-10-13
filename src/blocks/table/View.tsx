import type { z } from 'zod'
import type { TableBlock } from '@shared/schemas/blocks.ts'
import layout from '@/features/lesson/lessonLayout.module.css'
import classes from '../blocks.module.css'

/** Таблиця даних: завжди з джерелом і датою актуальності (SPEC 2.1). Широка — прокручується в блоці. */
export function TableView({ block }: { block: z.infer<typeof TableBlock> }) {
  return (
    <section className={layout.section}>
      <div className={classes.tableScroll}>
        <table className={classes.table}>
          {block.caption && <caption className={classes.srOnlyCaption}>{block.caption}</caption>}
          <thead>
            <tr>
              {block.columns.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={classes.note}>
        {block.caption ? `${block.caption}. ` : ''}Джерело: {block.meta.source}, станом на {block.meta.asOf}.
      </p>
    </section>
  )
}
