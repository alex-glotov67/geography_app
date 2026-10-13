import type { SupabaseClient } from '@supabase/supabase-js'
import type { Block } from '@shared/schemas/blocks.ts'
import type { Database } from '@/types/database.types'
import type { GeoPackage } from './schema'

/**
 * Імпорт пакета в БД (SPEC 10.6): медіа → Storage, відео, завдання з ключами, урок (чернетка),
 * результати уроку за кодами. Нові id генеруються, локальні посилання переписуються, slug — з пакета.
 * Клієнт — сервісний (локальний seed) або вчительський (конструктор, Фаза 3).
 */
type Db = SupabaseClient<Database>

export type SlugConflict = 'replace' | 'copy' | 'skip'

export interface ImportOptions {
  ownerId: string
  schoolId: string
  /** Що робити, якщо урок з таким slug уже є (SPEC 10.6) */
  onConflict?: SlugConflict
  /** Лише для демо в локальному seed: одразу позначити перевіреним і опублікувати */
  publish?: boolean
}

export interface ImportResult {
  status: 'created' | 'replaced' | 'copied' | 'skipped'
  lessonId: string | null
  slug: string
  version: number | null
  counts: { tasks: number; media: number; videos: number; outcomes: number }
  missingOutcomes: string[]
}

const fail = (what: string, error: { message: string } | null) => {
  if (error) throw new Error(`${what}: ${error.message}`)
}

const MIME: Record<string, string> = { svg: 'image/svg+xml', webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pdf: 'application/pdf' }

function rewriteBlocks(blocks: Block[], ids: { task: Map<string, string>; media: Map<string, string>; video: Map<string, string> }): Block[] {
  const t = (id: string) => ids.task.get(id) ?? id
  const m = (id: string) => ids.media.get(id) ?? id
  return blocks.map((b) => {
    switch (b.type) {
      case 'practice':
        return { ...b, taskIds: b.taskIds.map(t) }
      case 'image':
      case 'file':
        return { ...b, mediaId: m(b.mediaId) }
      case 'gallery':
        return { ...b, items: b.items.map((i) => ({ ...i, mediaId: m(i.mediaId) })) }
      case 'video':
        return { ...b, videoId: ids.video.get(b.videoId) ?? b.videoId }
      default:
        return b
    }
  })
}

async function freeSlug(db: Db, ownerId: string, slug: string) {
  for (let n = 2; ; n++) {
    const candidate = `${slug}-${n}`.slice(0, 64)
    const { data } = await db.from('lessons').select('id').eq('owner_id', ownerId).eq('slug', candidate).maybeSingle()
    if (!data) return candidate
  }
}

export async function importPackage(db: Db, pkg: GeoPackage, opts: ImportOptions): Promise<ImportResult> {
  const { ownerId, schoolId } = opts
  const owned = { owner_id: ownerId, school_id: schoolId, is_demo: pkg.manifest.demo }
  const L = pkg.lesson

  const { data: existing, error: exErr } = await db.from('lessons').select('id').eq('owner_id', ownerId).eq('slug', L.slug).maybeSingle()
  fail('Пошук уроку', exErr)
  let slug = L.slug
  let status: ImportResult['status'] = 'created'
  if (existing) {
    const mode = opts.onConflict ?? 'skip'
    if (mode === 'skip') {
      return { status: 'skipped', lessonId: existing.id, slug, version: null, counts: { tasks: 0, media: 0, videos: 0, outcomes: 0 }, missingOutcomes: [] }
    }
    if (mode === 'copy') {
      slug = await freeSlug(db, ownerId, L.slug)
      status = 'copied'
    } else status = 'replaced'
  }

  // Медіа: файл у Storage (<owner_id>/…), рядок у media
  const mediaIds = new Map<string, string>()
  for (const m of pkg.media) {
    const id = crypto.randomUUID()
    const ext = m.file.split('.').pop()!.toLowerCase()
    const path = `${ownerId}/${id}.${ext}`
    const { error: upErr } = await db.storage.from('lesson-media').upload(path, pkg.files[m.file]!, { contentType: MIME[ext] ?? 'application/octet-stream' })
    fail(`Завантаження ${m.file}`, upErr)
    const { error } = await db.from('media').insert({
      id, ...owned, bucket_path: path, kind: m.kind, alt: m.alt ?? null, caption: m.caption ?? null, source: m.source ?? null,
      license: m.license ?? null, width: m.width ?? null, height: m.height ?? null, bytes: pkg.files[m.file]!.byteLength,
    })
    fail(`Медіа ${m.id}`, error)
    mediaIds.set(m.id, id)
  }

  // Відео: затвердження не переноситься — лише вчитель (SPEC 12); виняток — демо в seed
  const videoIds = new Map<string, string>()
  for (const v of pkg.videos) {
    const id = crypto.randomUUID()
    const { error } = await db.from('videos').insert({
      id, ...owned, youtube_id: v.youtubeId, title: v.title, channel: v.channel ?? null, duration_sec: v.durationSec ?? null,
      start_sec: v.startSec ?? null, end_sec: v.endSec ?? null, approved: pkg.manifest.demo && !!opts.publish,
    })
    fail(`Відео ${v.id}`, error)
    videoIds.set(v.id, id)
  }

  // Завдання й ключі
  const taskIds = new Map<string, string>()
  for (const t of pkg.tasks) {
    const id = crypto.randomUUID()
    const { error } = await db.from('tasks').insert({
      id, ...owned, type: t.type, level: t.level, grp: t.grp, points: t.points, visibility: t.visibility,
      content: t.content as never, hint: t.hint ?? null, feedback: (t.feedback ?? null) as never, tags: (t.tags ?? {}) as never,
    })
    fail(`Завдання ${t.id}`, error)
    const { error: kErr } = await db.from('task_keys').insert({ task_id: id, owner_id: ownerId, key: t.key as never })
    fail(`Ключ ${t.id}`, kErr)
    taskIds.set(t.id, id)
  }

  const ids = { task: taskIds, media: mediaIds, video: videoIds }
  const task = (id: string) => taskIds.get(id)!

  let sectionId: string | null = null
  if (L.sectionNumber) {
    const { data } = await db.from('sections').select('id').eq('owner_id', ownerId).eq('grade', L.grade).eq('number', L.sectionNumber).maybeSingle()
    sectionId = data?.id ?? null
  }

  const row = {
    slug, grade: L.grade, section_id: sectionId, number: L.number ?? null, title: L.title,
    textbook_ref: (L.textbookRef ?? null) as never, ktp_ref: L.ktpRef ?? null,
    blocks: rewriteBlocks(L.blocks, ids) as never,
    homework: (L.homework ? { taskIds: L.homework.taskIds.map(task) } : null) as never,
    simplified: (L.simplified
      ? {
          ...(L.simplified.blocks ? { blocks: rewriteBlocks(L.simplified.blocks, ids) } : {}),
          ...(L.simplified.homeworkTaskIds ? { homeworkTaskIds: L.simplified.homeworkTaskIds.map(task) } : {}),
        }
      : null) as never,
    quiz_pool: L.quizPool.map(task),
    // Імпорт — завжди чернетка, не перевірена вчителем (SPEC 10.6); виняток — демо-seed
    reviewed_by_teacher: !!opts.publish,
    is_demo: pkg.manifest.demo,
  }

  let lessonId: string
  if (status === 'replaced') {
    lessonId = existing!.id
    const { error } = await db.from('lessons').update(row).eq('id', lessonId)
    fail('Оновлення уроку', error)
    await db.from('lesson_outcomes').delete().eq('lesson_id', lessonId)
  } else {
    const { data, error } = await db.from('lessons').insert({ ...row, owner_id: ownerId, school_id: schoolId }).select('id').single()
    fail('Урок', error)
    lessonId = data!.id
  }

  // Результати уроку — за стабільними кодами довідника
  const { data: outcomes, error: oErr } = await db.from('program_outcomes').select('id, code').eq('owner_id', ownerId).in('code', L.outcomeCodes.length ? L.outcomeCodes : ['-'])
  fail('Результати', oErr)
  const found = new Map((outcomes ?? []).map((o) => [o.code, o.id]))
  const missingOutcomes = L.outcomeCodes.filter((c) => !found.has(c))
  if (found.size) {
    const { error } = await db.from('lesson_outcomes').insert([...found.values()].map((outcome_id) => ({ lesson_id: lessonId, outcome_id })))
    fail('Результати уроку', error)
  }

  let version: number | null = null
  if (opts.publish) {
    const { data, error } = await db.rpc('publish_lesson', { p_lesson_id: lessonId })
    fail('Публікація', error)
    version = data
  }

  return {
    status, lessonId, slug, version, missingOutcomes,
    counts: { tasks: taskIds.size, media: mediaIds.size, videos: videoIds.size, outcomes: found.size },
  }
}
