#!/usr/bin/env bash
# Перевірка бекапу (SPEC 15: «бекап відновлюється в локальний Supabase»), лише локально / у CI:
# лічильники рядків → дамп + файли Storage → архів (зашифрований age, якщо є) → розшифрування →
# відновлення в чисту локальну БД → ті самі лічильники й вхід демо-вчителя.
set -euo pipefail
project_id=$(sed -n 's/^project_id *= *"\(.*\)"/\1/p' supabase/config.toml)
db="supabase_db_${project_id}"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

counts() {
  docker exec -i "$db" psql -U postgres -d postgres -At -c "
    select 'auth.users', count(*) from auth.users union all
    select 'teachers', count(*) from public.teachers union all
    select 'classes', count(*) from public.classes union all
    select 'students', count(*) from public.students union all
    select 'audit_log', count(*) from public.audit_log union all
    select 'lessons', count(*) from public.lessons union all
    select 'lesson_versions', count(*) from public.lesson_versions union all
    select 'task_versions', count(*) from public.task_versions union all
    select 'program_outcomes', count(*) from public.program_outcomes union all
    select 'storage.objects', count(*) from storage.objects
    order by 1"
}

counts > "$work/before.txt"
scripts/backup/dump.sh "$work/backup" --local
npx tsx scripts/backup/storage.ts download "$work/backup/storage" --local
tar -C "$work" -czf "$work/backup.tar.gz" backup

if command -v age >/dev/null; then
  age-keygen -o "$work/key.txt" 2>/dev/null
  age -r "$(age-keygen -y "$work/key.txt")" -o "$work/backup.tar.gz.age" "$work/backup.tar.gz"
  rm -rf "$work/backup" "$work/backup.tar.gz"
  age -d -i "$work/key.txt" -o "$work/backup.tar.gz" "$work/backup.tar.gz.age"
  echo "✓ age: зашифровано й розшифровано"
else
  rm -rf "$work/backup"
  echo "⚠ age не встановлено — перевірка без шифрування"
fi
tar -C "$work" -xzf "$work/backup.tar.gz"

scripts/backup/restore-local.sh "$work/backup"
counts > "$work/after.txt"
if ! diff -u "$work/before.txt" "$work/after.txt"; then
  echo "✗ після відновлення інші кількості рядків"; exit 1
fi
cat "$work/after.txt"

key=$(npx supabase status -o env | sed -n 's/^PUBLISHABLE_KEY="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')
api=$(npx supabase status -o env | sed -n 's/^API_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')
curl -sf -X POST "$api/auth/v1/token?grant_type=password" -H "apikey: $key" -H 'content-type: application/json' \
  -d '{"email":"demo-teacher@example.invalid","password":"demo-teacher-2026"}' >/dev/null
echo "✓ бекап відновлено: рядки збігаються, вхід за паролем з бекапу працює"
