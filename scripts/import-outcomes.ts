/**
 * Імпорт довідника розділів, тем і результатів з CSV (SPEC 10.6) у ЛОКАЛЬНИЙ Supabase.
 *   npm run import:outcomes -- seed/outcomes-g8.csv        справжній довідник (лише цією командою)
 *   npm run import:outcomes -- seed/demo-outcomes.csv --demo
 * Перевірити файл без запису: npm run import:outcomes -- файл.csv --check
 * На prod довідник вчитель імпортує в конструкторі (Фаза 3).
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { parseOutcomes } from '../src/lib/outcomes.ts'
import { applyOutcomes } from '../src/lib/outcomesDb.ts'
import { DEMO_SCHOOL, DEMO_TEACHER, localServiceClient } from './lib/local.ts'

export async function importOutcomesFile(path: string, isDemo: boolean) {
  const { rows, errors, encoding } = parseOutcomes(new Uint8Array(readFileSync(path)))
  if (errors.length) {
    for (const e of errors) console.error(`  рядок ${e.line}: ${e.message}`)
    throw new Error(`${path}: ${errors.length} помилок, нічого не імпортовано`)
  }
  const plan = await applyOutcomes(localServiceClient(), rows, { ownerId: DEMO_TEACHER, schoolId: DEMO_SCHOOL, isDemo })
  console.log(
    `✓ ${path} (${encoding}): розділів нових ${plan.sections.create.length}, перейменовано ${plan.sections.rename.length}; ` +
      `тем нових ${plan.topics.create.length}, перейменовано ${plan.topics.rename.length}; ` +
      `результатів нових ${plan.outcomes.create.length}, змінено ${plan.outcomes.update.length}, без змін ${plan.outcomes.unchanged.length}`,
  )
  if (plan.outcomes.missing.length) console.log(`  у базі, але не у файлі (запропонувати архівувати): ${plan.outcomes.missing.map((m) => m.code).join(', ')}`)
  return plan
}

// Запущено напряму (а не імпортовано з seed-local); pathToFileURL — шлях може мати пробіли
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2]
  if (!file) {
    console.error('Вкажи CSV: npm run import:outcomes -- файл.csv [--demo] [--check]')
    process.exit(1)
  }
  if (process.argv.includes('--check')) {
    const { rows, errors, encoding } = parseOutcomes(new Uint8Array(readFileSync(file)))
    const sections = new Set(rows.map((r) => `${r.grade}-${r.sectionNumber}`))
    const topics = new Set(rows.map((r) => `${r.grade}-${r.sectionNumber}-${r.topicNumber}`))
    for (const e of errors) console.error(`  рядок ${e.line}: ${e.message}`)
    console.log(`${errors.length ? '✗' : '✓'} ${file} (${encoding}): розділів ${sections.size}, тем ${topics.size}, результатів ${rows.length}, помилок ${errors.length}`)
    process.exit(errors.length ? 1 : 0)
  }
  await importOutcomesFile(file, process.argv.includes('--demo'))
}
