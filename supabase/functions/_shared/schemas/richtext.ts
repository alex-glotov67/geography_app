import { z } from 'zod'

/**
 * Форматований текст блоків (SPEC 10.2): JSON у форматі Tiptap / ProseMirror, лише дозволені
 * вузли й позначки — ніякого довільного HTML (10.7). Рендер — src/blocks/RichText.tsx.
 */
const Mark = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bold') }),
  z.object({ type: z.literal('italic') }),
  z.object({
    type: z.literal('link'),
    attrs: z.object({ href: z.url({ protocol: /^https?$/ }) }),
  }),
])

export interface RichNode {
  type: string
  text?: string
  marks?: z.infer<typeof Mark>[]
  attrs?: Record<string, unknown>
  content?: RichNode[]
}

const TextNode = z.object({ type: z.literal('text'), text: z.string().min(1), marks: z.array(Mark).optional() })
const Inline = z.union([TextNode, z.object({ type: z.literal('hardBreak') })])

const Paragraph = z.object({ type: z.literal('paragraph'), content: z.array(Inline).optional() })
const Heading = z.object({
  type: z.literal('heading'),
  attrs: z.object({ level: z.literal(3) }),
  content: z.array(Inline).min(1),
})

const ListItem: z.ZodType<RichNode> = z.lazy(() =>
  z.object({ type: z.literal('listItem'), content: z.array(z.union([Paragraph, BulletList, OrderedList])).min(1) }),
)
const BulletList: z.ZodType<RichNode> = z.lazy(() =>
  z.object({ type: z.literal('bulletList'), content: z.array(ListItem).min(1) }),
)
const OrderedList: z.ZodType<RichNode> = z.lazy(() =>
  z.object({ type: z.literal('orderedList'), content: z.array(ListItem).min(1) }),
)

const Cell = z.object({ type: z.enum(['tableCell', 'tableHeader']), content: z.array(Paragraph).min(1) })
const Table = z.object({
  type: z.literal('table'),
  content: z.array(z.object({ type: z.literal('tableRow'), content: z.array(Cell).min(1) })).min(1),
})

export const RichDoc = z.object({
  type: z.literal('doc'),
  content: z.array(z.union([Paragraph, Heading, BulletList, OrderedList, Table])).min(1),
})
export type RichDoc = z.infer<typeof RichDoc>

/** Простий текст з абзаців — для заготовок і тестів. */
export const plainDoc = (...paragraphs: string[]): RichDoc => ({
  type: 'doc',
  content: paragraphs.map((text) => ({ type: 'paragraph' as const, content: [{ type: 'text' as const, text }] })),
})
