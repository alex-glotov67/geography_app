/**
 * Копія файлів Supabase Storage для бекапу (SPEC 3.5).
 *   tsx scripts/backup/storage.ts download <dir> [--local]   — усі бакети → <dir>/<бакет>/<шлях>
 *   tsx scripts/backup/storage.ts upload <dir> [--local]     — назад (бакети вже створено міграціями)
 * Доступ: --local — ключі локального Supabase (supabase status); інакше SUPABASE_URL і
 * SUPABASE_SERVICE_ROLE_KEY із середовища (у CI — секрети). Сервісний ключ лише тут, не в клієнті.
 */
import { execFileSync } from 'node:child_process'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const [mode, dir, flag] = process.argv.slice(2)
if ((mode !== 'download' && mode !== 'upload') || !dir) {
  console.error('Використання: storage.ts download|upload <dir> [--local]')
  process.exit(2)
}

function credentials(): { url: string; key: string } {
  if (flag === '--local') {
    const env = Object.fromEntries(
      execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8' })
        .split('\n')
        .map((l) => /^([A-Z_]+)="?(.*?)"?$/.exec(l))
        .filter((m): m is RegExpExecArray => !!m)
        .map((m) => [m[1]!, m[2]!]),
    )
    return { url: env.API_URL!, key: env.SERVICE_ROLE_KEY! }
  }
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Потрібні SUPABASE_URL і SUPABASE_SERVICE_ROLE_KEY')
  return { url, key }
}

const { url, key } = credentials()
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const MANIFEST = 'manifest.json'

/** Усі файли бакета (рекурсивно по «папках») з типом вмісту */
async function list(bucket: string, prefix = ''): Promise<{ path: string; contentType: string }[]> {
  const files: { path: string; contentType: string }[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000, offset })
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`)
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id === null) files.push(...(await list(bucket, path))) // папка
      else files.push({ path, contentType: String(item.metadata?.mimetype ?? 'application/octet-stream') })
    }
    if (data.length < 1000) return files
  }
}

async function walk(root: string): Promise<string[]> {
  const out: string[] = []
  for (const e of await readdir(root, { withFileTypes: true }).catch(() => [])) {
    const p = join(root, e.name)
    if (e.isDirectory()) out.push(...(await walk(p)))
    else out.push(p)
  }
  return out
}

if (mode === 'download') {
  const { data: buckets, error } = await db.storage.listBuckets()
  if (error) throw new Error(error.message)
  // Тип вмісту кожного файлу — для відновлення (бакети дозволяють лише певні типи)
  const manifest: Record<string, string> = {}
  for (const b of buckets) {
    for (const { path, contentType } of await list(b.id)) {
      const { data, error: e } = await db.storage.from(b.id).download(path)
      if (e) throw new Error(`${b.id}/${path}: ${e.message}`)
      const file = join(dir, b.id, ...path.split('/'))
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, new Uint8Array(await data.arrayBuffer()))
      manifest[`${b.id}/${path}`] = contentType
    }
  }
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, MANIFEST), JSON.stringify(manifest, null, 2))
  console.log(`✓ Storage: ${Object.keys(manifest).length} файлів з ${buckets.length} бакетів → ${dir}`)
} else {
  const manifest: Record<string, string> = JSON.parse(await readFile(join(dir, MANIFEST), 'utf8').catch(() => '{}'))
  let n = 0
  for (const file of await walk(dir)) {
    const rel = relative(dir, file).split(sep).join('/')
    if (rel === MANIFEST) continue
    const [bucket, ...rest] = rel.split('/')
    const { error } = await db.storage
      .from(bucket!)
      .upload(rest.join('/'), await readFile(file), { upsert: true, contentType: manifest[rel] ?? 'application/octet-stream' })
    if (error) throw new Error(`${bucket}/${rest.join('/')}: ${error.message}`)
    n++
  }
  console.log(`✓ Storage: ${n} файлів завантажено з ${dir}`)
}
