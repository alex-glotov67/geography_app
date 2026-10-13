/**
 * Демо-зміст у ЛОКАЛЬНИЙ Supabase (і CI): довідник seed/demo-outcomes.csv і демо-пакети seed/<тека>
 * (пакуються в .geo.zip і імпортуються через той самий шлях, що й справжні пакети), публікація.
 * Перед цим: npm run db:reset (seed.sql створює демо-школу, демо-вчителя і вмикає show_demo).
 */
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { importPackage } from '../src/lib/packages/import.ts'
import { readPackage } from '../src/lib/packages/read.ts'
import { packFolder } from './lib/folder.ts'
import { importOutcomesFile } from './import-outcomes.ts'
import { DEMO_SCHOOL, DEMO_TEACHER, localServiceClient } from './lib/local.ts'

await importOutcomesFile('seed/demo-outcomes.csv', true)

const db = localServiceClient()
for (const name of readdirSync('seed')) {
  const dir = join('seed', name)
  if (!statSync(dir).isDirectory()) continue
  const { pkg, errors } = await readPackage(await packFolder(dir, { demo: true }))
  if (!pkg) {
    for (const e of errors) console.error(`  ${e.where}: ${e.message}`)
    throw new Error(`${dir}: пакет з помилками`)
  }
  const r = await importPackage(db, pkg, { ownerId: DEMO_TEACHER, schoolId: DEMO_SCHOOL, onConflict: 'replace', publish: true })
  console.log(
    `✓ ${dir} → /lesson/${r.slug} (${r.status}, версія ${r.version}): завдань ${r.counts.tasks}, медіа ${r.counts.media}, відео ${r.counts.videos}, результатів ${r.counts.outcomes}`,
  )
  if (r.missingOutcomes.length) console.log(`  немає в довіднику: ${r.missingOutcomes.join(', ')}`)
}
