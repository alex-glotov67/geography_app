#!/usr/bin/env node
// PreToolUse(Edit|Write|MultiEdit): захищає файли, які CLAUDE.md забороняє змінювати без дозволу.
// Exit 2 = заблокувати; stderr бачить агент.
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const input = JSON.parse(readFileSync(0, 'utf8'))
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd()
const abs = path.resolve(root, String(input.tool_input?.file_path ?? ''))
const rel = path.relative(root, abs).split(path.sep).join('/')

const block = (why) => {
  process.stderr.write(`Заблоковано хуком (.claude/hooks/guard-files.mjs): ${rel} — ${why}\n`)
  process.exit(2)
}

// Чи є файл у main (тобто вже злитий / можливо задеплоєний на prod)
const inMain = (file) => {
  for (const ref of ['origin/main', 'main']) {
    try {
      execFileSync('git', ['cat-file', '-e', `${ref}:${file}`], { cwd: root, stdio: 'ignore' })
      return true
    } catch { /* немає у цьому ref або ref відсутній */ }
  }
  return false
}

if (/(^|\/)\.env(\..+)?$/.test(rel) && !rel.endsWith('.env.example')) {
  block('секрети й локальні змінні агент не редагує (CLAUDE.md, «Безпека і дані»).')
}
if (rel === 'seed/outcomes-g8.csv') {
  block('справжній довідник від вчителя; змінює лише вчитель.')
}
if (rel.startsWith('supabase/migrations/') && inMain(rel)) {
  block('міграція вже в main. Не змінюй старі міграції — створи нову (CLAUDE.md: «міграції попередніх фаз»).')
}
if (rel === 'src/types/database.types.ts') {
  block('файл генерується: npm run db:types (локальний Supabase).')
}
