import { z } from 'zod'
import { Group, Id, Level, Text } from '@shared/schemas/common.ts'
import { LessonDraft } from '@shared/schemas/lesson.ts'
import { TASK_TYPES, type TaskType } from '@shared/schemas/tasks/index.ts'

/**
 * Пакет уроку `.geo.zip` (SPEC 10.6), formatVersion 1:
 *   manifest.json  версія формату, автор, демо, перелік файлів з SHA-256
 *   lesson.json    урок (LessonDraft); посилання на завдання, медіа й відео — локальні id пакета
 *   tasks.json     завдання: зміст + ключ + видимість
 *   media.json     опис зображень і PDF; самі файли — media/…
 *   videos.json    відео YouTube (затвердження вчителем не переноситься)
 * Зміна формату → нова formatVersion + міграція старих пакетів у read.ts і round-trip тест.
 */
export const FORMAT_VERSION = 1

export const Manifest = z.object({
  formatVersion: z.literal(FORMAT_VERSION),
  createdAt: z.iso.datetime(),
  author: Text,
  generator: z.string().default('geography-6-9'),
  /** Демо-зміст (is_demo) — лише для локального Supabase і CI */
  demo: z.boolean().default(false),
  /** Пакет містить ключі відповідей — не передавати учням */
  containsAnswers: z.literal(true).default(true),
  files: z.array(z.object({ path: z.string().min(1), sha256: z.string().regex(/^[0-9a-f]{64}$/) })),
})
export type Manifest = z.infer<typeof Manifest>

export const PackageTask = z.object({
  id: Id,
  type: z.enum(TASK_TYPES as [TaskType, ...TaskType[]]),
  level: Level,
  grp: Group,
  points: z.number().positive().max(100).multipleOf(0.5).default(1),
  visibility: z.enum(['open', 'secure']),
  content: z.record(z.string(), z.unknown()),
  key: z.record(z.string(), z.unknown()),
  hint: Text.optional(),
  feedback: z.object({ correct: Text.optional(), incorrect: Text.optional() }).optional(),
  tags: z.record(z.string(), z.unknown()).optional(),
})
export type PackageTask = z.infer<typeof PackageTask>

export const PackageMedia = z.object({
  id: Id,
  file: z.string().regex(/^media\/[A-Za-z0-9._-]+$/),
  kind: z.enum(['image', 'pdf']),
  alt: Text.optional(),
  caption: Text.optional(),
  source: Text.optional(),
  license: Text.optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
})
export type PackageMedia = z.infer<typeof PackageMedia>

export const PackageVideo = z.object({
  id: Id,
  youtubeId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  title: Text,
  channel: Text.optional(),
  durationSec: z.number().int().positive().optional(),
  startSec: z.number().int().min(0).optional(),
  endSec: z.number().int().positive().optional(),
})
export type PackageVideo = z.infer<typeof PackageVideo>

export interface GeoPackage {
  manifest: Manifest
  lesson: z.infer<typeof LessonDraft>
  tasks: PackageTask[]
  media: PackageMedia[]
  videos: PackageVideo[]
  /** Вміст файлів media/… */
  files: Record<string, Uint8Array>
}
