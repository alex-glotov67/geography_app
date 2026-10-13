/**
 * Перевірка пакетів уроків (SPEC 10.6, 17) — тими самими схемами, що й імпорт.
 * npm run validate                       → демо-пакети з seed/
 * npm run validate -- урок.geo.zip тека/ → конкретні пакети або теки-джерела
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { readPackage } from '../src/lib/packages/read.ts'
import { packFolder } from './lib/folder.ts'

const args = process.argv.slice(2)
const targets = args.length
  ? args
  : readdirSync('seed').map((n) => join('seed', n)).filter((p) => statSync(p).isDirectory() || p.endsWith('.geo.zip'))

let failed = 0
for (const target of targets) {
  const bytes = statSync(target).isDirectory() ? await packFolder(target, { demo: true }) : new Uint8Array(readFileSync(target))
  const { errors, warnings } = await readPackage(bytes)
  console.log(`\n${errors.length ? '✗' : '✓'} ${target}`)
  for (const e of errors) console.log(`  помилка   ${e.where}: ${e.message}`)
  for (const w of warnings) console.log(`  увага     ${w.where}: ${w.message}`)
  if (errors.length) failed++
}
if (failed) {
  console.error(`\nПакетів з помилками: ${failed}`)
  process.exit(1)
}
