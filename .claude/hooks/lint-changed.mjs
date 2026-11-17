#!/usr/bin/env node
// PostToolUse(Edit|Write|MultiEdit): eslint --fix для зміненого .ts/.tsx одразу після правки.
// Якщо лишились помилки — exit 2, і агент бачить їх у тому ж ході, а не наприкінці в CI.
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const input = JSON.parse(readFileSync(0, 'utf8'))
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd()
const file = path.resolve(root, String(input.tool_input?.file_path ?? ''))

if (!/\.(ts|tsx)$/.test(file) || !existsSync(file)) process.exit(0)
if (!existsSync(path.join(root, 'node_modules', '.bin', 'eslint'))) process.exit(0) // ще без npm ci

const r = spawnSync('npx', ['eslint', '--fix', '--no-warn-ignored', file], { cwd: root, encoding: 'utf8', timeout: 60_000 })
if (r.status !== 0) {
  process.stderr.write(`ESLint після правки ${path.relative(root, file)}:\n${r.stdout}${r.stderr}`)
  process.exit(2)
}
