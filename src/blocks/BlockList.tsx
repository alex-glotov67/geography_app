import type { Block } from '@shared/schemas/blocks.ts'
import { BLOCK_VIEWS } from './registry'
import { useLesson } from './lessonContext'

/**
 * Блоки уроку по порядку. Спрощений режим (SPEC 10.2): окремий список simplified.blocks, якщо є,
 * інакше — лише блоки з прапорцем simplified.
 */
export function BlockList({ blocks, simplifiedBlocks }: { blocks: Block[]; simplifiedBlocks?: Block[] }) {
  const { simplified } = useLesson()
  const list = simplified ? (simplifiedBlocks ?? blocks.filter((b) => b.simplified)) : blocks
  return (
    <>
      {list.map((block) => {
        const View = BLOCK_VIEWS[block.type] as React.ComponentType<{ block: Block }>
        return <View key={block.id} block={block} />
      })}
    </>
  )
}
