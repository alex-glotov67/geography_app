import { strToU8, unzipSync, zipSync } from 'fflate'
import { z } from 'zod'
import { LessonDraft } from '@shared/schemas/lesson.ts'
import { FORMAT_VERSION, Manifest, PackageMedia, PackageTask, PackageVideo, type GeoPackage } from './schema'
import { validatePackage, type Issue } from './validate'

const JSON_FILES = ['lesson.json', 'tasks.json', 'media.json', 'videos.json'] as const

export async function sha256(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const json = (bytes: Uint8Array | undefined) => (bytes ? JSON.parse(new TextDecoder().decode(bytes)) : undefined)

const zodIssues = (file: string, e: z.ZodError): Issue[] =>
  e.issues.map((i) => ({ level: 'error', where: `${file}${i.path.length ? ' → ' + i.path.join('.') : ''}`, message: i.message }))

export interface ReadResult {
  pkg: GeoPackage | null
  errors: Issue[]
  warnings: Issue[]
}

/** Розбір і повна перевірка пакета (SPEC 10.6, 17). Зрозумілі помилки замість винятків. */
export async function readPackage(zip: Uint8Array): Promise<ReadResult> {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(zip)
  } catch {
    return { pkg: null, warnings: [], errors: [{ level: 'error', where: 'архів', message: 'Файл пошкоджений або це не .geo.zip' }] }
  }
  const errors: Issue[] = []
  const rawManifest = json(entries['manifest.json'])
  if (!rawManifest) return { pkg: null, warnings: [], errors: [{ level: 'error', where: 'manifest.json', message: 'Немає manifest.json' }] }
  if (rawManifest.formatVersion !== FORMAT_VERSION) {
    return {
      pkg: null,
      warnings: [],
      errors: [{ level: 'error', where: 'manifest.json', message: `Непідтримувана версія формату ${rawManifest.formatVersion} (очікується ${FORMAT_VERSION})` }],
    }
  }
  const manifest = Manifest.safeParse(rawManifest)
  if (!manifest.success) return { pkg: null, warnings: [], errors: zodIssues('manifest.json', manifest.error) }

  // Контрольні суми й повнота переліку
  const listed = new Set(manifest.data.files.map((f) => f.path))
  for (const f of manifest.data.files) {
    const bytes = entries[f.path]
    if (!bytes) errors.push({ level: 'error', where: f.path, message: 'Файл зазначено в manifest.json, але його немає в архіві' })
    else if ((await sha256(bytes)) !== f.sha256) errors.push({ level: 'error', where: f.path, message: 'Контрольна сума не збігається — файл пошкоджено' })
  }
  for (const path of Object.keys(entries)) {
    if (path !== 'manifest.json' && !path.endsWith('/') && !listed.has(path))
      errors.push({ level: 'error', where: path, message: 'Файл є в архіві, але не зазначений у manifest.json' })
  }

  const lesson = LessonDraft.safeParse(json(entries['lesson.json']))
  if (!lesson.success) errors.push(...zodIssues('lesson.json', lesson.error))
  const tasks = z.array(PackageTask).safeParse(json(entries['tasks.json']) ?? [])
  if (!tasks.success) errors.push(...zodIssues('tasks.json', tasks.error))
  const media = z.array(PackageMedia).safeParse(json(entries['media.json']) ?? [])
  if (!media.success) errors.push(...zodIssues('media.json', media.error))
  const videos = z.array(PackageVideo).safeParse(json(entries['videos.json']) ?? [])
  if (!videos.success) errors.push(...zodIssues('videos.json', videos.error))
  if (!lesson.success || !tasks.success || !media.success || !videos.success) return { pkg: null, errors, warnings: [] }

  const files = Object.fromEntries(Object.entries(entries).filter(([p]) => p.startsWith('media/')))
  const pkg: GeoPackage = { manifest: manifest.data, lesson: lesson.data, tasks: tasks.data, media: media.data, videos: videos.data, files }
  const v = validatePackage(pkg)
  return { pkg: errors.length || v.errors.length ? null : pkg, errors: [...errors, ...v.errors], warnings: v.warnings }
}

/** Збирає пакет: JSON-файли + media/…, manifest із SHA-256. */
export async function writePackage(
  parts: Omit<GeoPackage, 'manifest'> & { author: string; demo?: boolean; createdAt?: string },
): Promise<Uint8Array> {
  const out: Record<string, Uint8Array> = {
    'lesson.json': strToU8(JSON.stringify(parts.lesson, null, 2)),
    'tasks.json': strToU8(JSON.stringify(parts.tasks, null, 2)),
    'media.json': strToU8(JSON.stringify(parts.media, null, 2)),
    'videos.json': strToU8(JSON.stringify(parts.videos, null, 2)),
    ...parts.files,
  }
  const files = await Promise.all(Object.keys(out).sort().map(async (path) => ({ path, sha256: await sha256(out[path]!) })))
  const manifest = {
    formatVersion: FORMAT_VERSION,
    createdAt: parts.createdAt ?? new Date().toISOString(),
    author: parts.author,
    generator: 'geography-6-9',
    demo: parts.demo ?? false,
    containsAnswers: true,
    files,
  }
  out['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))
  // Фіксований час у zip — однакові пакети дають однакові байти
  return zipSync(out, { level: 6, mtime: new Date('2026-01-01T00:00:00Z') })
}

export { JSON_FILES }
