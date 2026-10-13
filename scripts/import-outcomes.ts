/**
 * Імпорт довідника розділів і результатів з CSV (SPEC 10.6) у ЛОКАЛЬНИЙ Supabase.
 * npm run import:outcomes -- файл.csv [--demo]
 * Справжній довідник на prod вчитель імпортує в конструкторі (Фаза 3).
 */
import { readFileSync } from 'node:fs'
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
      `результатів нових ${plan.outcomes.create.length}, змінено ${plan.outcomes.update.length}, без змін ${plan.outcomes.unchanged.length}`,
  )
  if (plan.outcomes.missing.length) console.log(`  у базі, але не у файлі (запропонувати архівувати): ${plan.outcomes.missing.map((m) => m.code).join(', ')}`)
  return plan
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2]
  if (!file) {
    console.error('Вкажи CSV: npm run import:outcomes -- файл.csv [--demo]')
    process.exit(1)
  }
  await importOutcomesFile(file, process.argv.includes('--demo'))
}
