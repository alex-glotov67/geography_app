import { z } from 'zod'
import { Id, SourceMeta, Text } from './common.ts'
import { RichDoc } from './richtext.ts'

/**
 * Блоки уроку (SPEC 10.2). Посилання на завдання, медіа й відео — `Ref`: у базі це uuid, у пакеті
 * `.geo.zip` — локальні id (імпорт переписує). Формат узгоджений з SQL (міграція content_publish):
 * practice.taskIds, image/file.mediaId, gallery.items[].mediaId, video.videoId.
 * Фаза 1: усі блоки, крім map (Фаза 5), chart і reflection (Фаза 8).
 */
export const Ref = z.string().min(1).max(64)

const base = {
  id: Id,
  /** Показувати в спрощеному режимі (SPEC 10.2) */
  simplified: z.boolean().default(true),
}

export const GoalBlock = z.object({ ...base, type: z.literal('goal'), items: z.array(Text).min(2).max(5) })

export const TextBlock = z.object({
  ...base,
  type: z.literal('text'),
  title: Text.optional(),
  doc: RichDoc,
  /** Окремий простіший варіант тексту для спрощеного режиму */
  simplifiedDoc: RichDoc.optional(),
})

export const TermsBlock = z.object({
  ...base,
  type: z.literal('terms'),
  items: z.array(z.object({ term: Text, definition: Text })).min(1).max(12),
})

export const ImageBlock = z.object({ ...base, type: z.literal('image'), mediaId: Ref, caption: Text.optional() })

export const GalleryBlock = z.object({
  ...base,
  type: z.literal('gallery'),
  items: z.array(z.object({ mediaId: Ref, caption: Text.optional() })).min(2).max(8),
})

export const VideoBlock = z.object({ ...base, type: z.literal('video'), videoId: Ref })

export const CalloutBlock = z.object({
  ...base,
  type: z.literal('callout'),
  variant: z.enum(['interesting', 'attention', 'local']),
  title: Text.optional(),
  doc: RichDoc,
})

/** Таблиця даних — обов'язково з джерелом і датою актуальності (SPEC 2.1, 10.2) */
export const TableBlock = z
  .object({
    ...base,
    type: z.literal('table'),
    caption: Text.optional(),
    columns: z.array(Text).min(1).max(8),
    rows: z.array(z.array(z.string())).min(1).max(60),
    meta: SourceMeta,
  })
  .refine((t) => t.rows.every((r) => r.length === t.columns.length), {
    message: 'Кожен рядок таблиці має стільки ж клітинок, скільки стовпців',
    path: ['rows'],
  })

export const FileBlock = z.object({ ...base, type: z.literal('file'), mediaId: Ref, title: Text })

/** Тренування: відкриті завдання з банку, рівні беруться із самих завдань */
export const PracticeBlock = z.object({
  ...base,
  type: z.literal('practice'),
  title: Text.optional(),
  taskIds: z.array(Ref).min(1).max(20),
})

/** Місце розділу ДЗ на сторінці (один на урок); завдання — у lesson.homework */
export const HomeworkBlock = z.object({ ...base, type: z.literal('homework') })

export const Block = z.discriminatedUnion('type', [
  GoalBlock,
  TextBlock,
  TermsBlock,
  ImageBlock,
  GalleryBlock,
  VideoBlock,
  CalloutBlock,
  TableBlock,
  FileBlock,
  PracticeBlock,
  HomeworkBlock,
])
export type Block = z.infer<typeof Block>
export type BlockType = Block['type']
export const BLOCK_TYPES = Block.options.map((o) => o.shape.type.value) as BlockType[]
