import { z } from 'zod'
import { Block } from '@shared/schemas/blocks.ts'
import { LessonDraft } from '@shared/schemas/lesson.ts'
import type { BuilderLesson } from '@/api/builder'
import type { GeoPackage, PackageMedia, PackageTask, PackageVideo } from '@/lib/packages/schema'
import { validatePackage } from '@/lib/packages/validate'
import { BLOCK_LABELS, type LessonDraftState } from './draft'

/*
 * Перевірка перед публікацією (SPEC 10.1, 10.2): той самий валідатор, що й для імпорту пакетів
 * (lib/packages/validate.ts), над чернеткою конструктора + правила публікації: TODO(teacher) і
 * незатверджене відео блокують. Помилки блокують «Опублікувати», попередження — ні.
 */

export interface DraftIssue {
  level: 'error' | 'warning'
  message: string
  /** Блок, до якого перейти з панелі перевірки */
  blockId?: string
}

const ukLocale = z.locales.uk().localeError

/** Зрозуміло вчителю: «не заповнено», «щонайменше 2»; решта — українська локаль zod */
const ukErrors: z.core.$ZodErrorMap = (iss) => {
  if (iss.code === 'too_small' && iss.origin === 'string') return 'не заповнено'
  if (iss.code === 'too_small' && iss.origin === 'array') return `потрібно щонайменше ${iss.minimum}`
  if (iss.code === 'too_big' && iss.origin === 'array') return `не більше ${iss.maximum}`
  if (iss.code === 'invalid_type' && iss.input === undefined) return 'не заповнено'
  return ukLocale(iss)
}

const FIELD: Record<string, string> = {
  title: 'тема', slug: 'адреса', number: '№ уроку', items: 'пункти', term: 'термін', definition: 'визначення',
  columns: 'стовпці', rows: 'рядки', source: 'джерело', asOf: 'дата актуальності', doc: 'текст', simplifiedDoc: 'спрощений текст',
  caption: 'підпис', variant: 'вид', taskIds: 'завдання',
}

const fieldName = (path: PropertyKey[]) => {
  const names = path.filter((p): p is string => typeof p === 'string' && p in FIELD).map((p) => FIELD[p])
  return names.at(-1) ?? ''
}

/** Порожній абзац у новому тексті — zod пропускає (абзац без вмісту допустимий), тут — помилка */
const isEmptyDoc = (doc: { content: { type: string; content?: unknown[] }[] } | undefined) =>
  !!doc && doc.content.every((n) => n.type === 'paragraph' && !n.content?.length)

function blockIssues(blocks: LessonDraftState['blocks'], prefix: string): DraftIssue[] {
  const issues: DraftIssue[] = []
  blocks.forEach((b, i) => {
    const label = `${prefix}${BLOCK_LABELS[b.type] ?? b.type} (блок ${i + 1})`
    const r = Block.safeParse(b, { error: ukErrors })
    if (!r.success) {
      const seen = new Set<string>()
      for (const iss of r.error.issues) {
        const field = fieldName(iss.path)
        const text = `${label}: ${field ? `${field} — ` : ''}${iss.message}`
        if (!seen.has(text)) issues.push({ level: 'error', message: text, blockId: b.id })
        seen.add(text)
      }
    }
    if ((b.type === 'text' || b.type === 'callout') && isEmptyDoc(b.doc)) issues.push({ level: 'error', message: `${label}: текст порожній`, blockId: b.id })
  })
  return issues
}

/** Чернетка → пакет: ті самі перевірки посилань, alt, джерел і педагогічні попередження, що й при імпорті */
function toPackage(d: LessonDraftState, refs: Pick<BuilderLesson, 'tasks' | 'media' | 'videos'>): GeoPackage {
  const tasks: PackageTask[] = Object.values(refs.tasks).map((t) => ({
    id: t.id, type: t.type as PackageTask['type'], level: t.level as PackageTask['level'], grp: t.grp as PackageTask['grp'],
    points: t.points, visibility: t.visibility, content: t.content, key: t.key, hint: t.hint ?? undefined,
    feedback: t.feedback ?? undefined,
  }))
  const media: PackageMedia[] = Object.values(refs.media).map((m) => ({
    id: m.id, file: `media/${m.id}`, kind: m.kind, alt: m.alt ?? undefined, caption: m.caption ?? undefined,
    source: m.source ?? undefined, license: m.license ?? undefined,
  }))
  const videos: PackageVideo[] = Object.values(refs.videos).map((v) => ({ id: v.id, youtubeId: v.youtubeId, title: v.title }))
  return {
    manifest: {} as GeoPackage['manifest'],
    lesson: {
      slug: d.slug, grade: d.grade as 6 | 7 | 8 | 9, number: d.number ?? undefined, title: d.title, outcomeCodes: [],
      blocks: d.blocks, homework: d.homework, simplified: d.simplified, quizPool: [],
    },
    tasks,
    media,
    videos,
    files: Object.fromEntries(media.map((m) => [m.file, new Uint8Array()])),
  }
}

const BLOCK_REF = /блок «([^»]+)»/

export function validateDraft(d: LessonDraftState, refs: Pick<BuilderLesson, 'tasks' | 'media' | 'videos'>): { errors: DraftIssue[]; warnings: DraftIssue[] } {
  const issues: DraftIssue[] = []
  const err = (message: string, blockId?: string) => issues.push({ level: 'error', message, blockId })
  const warn = (message: string, blockId?: string) => issues.push({ level: 'warning', message, blockId })

  const meta = LessonDraft.pick({ slug: true, title: true, number: true }).safeParse(
    { slug: d.slug, title: d.title, number: d.number ?? undefined },
    { error: ukErrors },
  )
  if (!meta.success) for (const iss of meta.error.issues) err(`Про урок: ${fieldName(iss.path)} — ${iss.message}`)
  if (!d.blocks.length) err('Урок порожній — додай хоча б один блок')
  issues.push(...blockIssues(d.blocks, ''), ...blockIssues(d.simplified?.blocks ?? [], 'Спрощений режим: '))
  if (d.blocks.filter((b) => b.type === 'homework').length > 1) err('Блок ДЗ може бути лише один')

  const pkg = { ...validatePackage(toPackage(d, refs)), hasTasks: Object.keys(refs.tasks).length > 0 }
  const byId = new Map(d.blocks.map((b) => [b.id, b]))
  for (const i of [...pkg.errors, ...pkg.warnings]) {
    if (i.message.includes('TODO(teacher)')) continue // нижче — як помилка публікації
    if (i.where === 'tasks.json' && !pkg.hasTasks) continue // без завдань попередження про ГР — зайве
    const blockId = BLOCK_REF.exec(i.where)?.[1]
    const where = blockId && byId.has(blockId) ? `${BLOCK_LABELS[byId.get(blockId)!.type]}: ` : ''
    issues.push({ level: i.level, message: `${where}${i.message}`, blockId: blockId && byId.has(blockId) ? blockId : undefined })
  }

  for (const v of Object.values(refs.videos)) {
    if (!v.approved) {
      const b = d.blocks.find((x) => x.type === 'video' && x.videoId === v.id)
      err(`Відео «${v.title}» не позначене як перевірене — учні його не побачать`, b?.id)
    }
  }
  const todo = (x: unknown) => JSON.stringify(x).includes('TODO(teacher)')
  if (todo({ ...d, outcomeIds: [] })) err('В уроці лишилося TODO(teacher) — заповни перед публікацією')
  for (const t of Object.values(refs.tasks)) if (todo([t.content, t.key, t.hint, t.feedback])) err(`У завданні уроку лишилося TODO(teacher) (${t.type})`)
  if (!d.outcomeIds.length) warn('Не обрано очікуваних результатів з довідника')

  const unique = (list: DraftIssue[]) => list.filter((x, i) => list.findIndex((y) => y.message === x.message) === i)
  return { errors: unique(issues.filter((i) => i.level === 'error')), warnings: unique(issues.filter((i) => i.level === 'warning')) }
}
