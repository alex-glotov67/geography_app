import type { Block } from '@shared/schemas/blocks.ts'
import { groupBlocks } from './groupBlocks'
import { BLOCK_VIEWS } from './registry'
import { useLesson } from './lessonContext'
import classes from './blocks.module.css'

const render = (block: Block) => {
  const View = BLOCK_VIEWS[block.type] as React.ComponentType<{ block: Block }>
  return <View key={block.id} block={block} />
}

/**
 * Блоки уроку по порядку. Спрощений режим (SPEC 10.2): окремий список simplified.blocks, якщо є,
 * інакше — лише блоки з прапорцем simplified.
 */
export function BlockList({ blocks, simplifiedBlocks }: { blocks: Block[]; simplifiedBlocks?: Block[] }) {
  const { simplified } = useLesson()
  const list = simplified ? (simplifiedBlocks ?? blocks.filter((b) => b.simplified)) : blocks
  return (
    <>
      {groupBlocks(list).map((g) =>
        g.length === 2 ? (
          <div key={g.map((b) => b.id).join('+')} className={classes.pair}>
            {g.map(render)}
          </div>
        ) : (
          render(g[0]!)
        ),
      )}
    </>
  )
}
