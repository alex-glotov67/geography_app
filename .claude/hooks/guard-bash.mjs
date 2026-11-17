#!/usr/bin/env node
// PreToolUse(Bash): блокує дії, які CLAUDE.md дозволяє лише вчителю (prod, злиття, force-push).
// Exit 2 = заблокувати; stderr бачить агент. Ловить команду будь-де в рядку (`cd x && wrangler deploy`).
import { readFileSync } from 'node:fs'

const input = JSON.parse(readFileSync(0, 'utf8'))
const cmd = String(input.tool_input?.command ?? '')

const rules = [
  [/\bwrangler\s+(deploy|publish|secret|versions\s+deploy)\b/, 'деплой фронту на prod — лише вчитель (Workers Builds з main)'],
  [/\bnpm\s+run\s+deploy\b/, 'деплой на prod — лише вчитель'],
  [/\bsupabase\s+(db\s+push|link|functions\s+deploy|secrets|projects|branches)\b/, 'дії з хмарним Supabase — лише вчитель (deploy-prod.yml)'],
  [/\bsupabase\b.*--linked\b/, 'команди з --linked працюють з prod — лише локальний Supabase'],
  [/\bgit\s+push\b.*(\s--force\b|\s-f\b|--force-with-lease)/, 'force-push заборонено'],
  [/\bgit\s+push\b[^;&|]*\s(\S+:)?main(\s|$)/, 'у main напряму не пушимо — лише PR'],
  [/\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f)/, 'руйнівні git-команди — спитай вчителя'],
  [/\bgh\s+(pr\s+merge|workflow\s+run|release\s+create|secret|variable)\b/, 'злиття, запуск workflow і секрети — лише вчитель'],
  [/\brm\s+-[a-z]*r[a-z]*f?\s+.*\b(supabase|seed|src|docs)\b/, 'видалення змісту/коду рекурсивно — спитай вчителя'],
]

for (const [re, why] of rules) {
  if (re.test(cmd)) {
    process.stderr.write(`Заблоковано хуком (.claude/hooks/guard-bash.mjs): ${why}.\nКоманда: ${cmd}\nЯкщо це справді потрібно — опиши в звіті як TODO(teacher).\n`)
    process.exit(2)
  }
}
