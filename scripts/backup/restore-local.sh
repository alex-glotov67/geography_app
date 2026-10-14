#!/usr/bin/env bash
# Відновлення бекапу в ЛОКАЛЬНИЙ Supabase (SPEC 3.5, 15). Prod не чіпає.
#   scripts/backup/restore-local.sh <розпакований-каталог-бекапу>
# Кроки: міграції з нуля без seed → дані (тригери вимкнено: session_replication_role = replica) →
# файли Storage. Схема з бекапу (schema.sql) — для відновлення в новий хмарний проєкт, тут не потрібна:
# локальні міграції дають ту саму схему.
set -euo pipefail
dir="$1"
project_id=$(sed -n 's/^project_id *= *"\(.*\)"/\1/p' supabase/config.toml)
db="supabase_db_${project_id}"
npx supabase db reset --no-seed
{
  echo 'set session_replication_role = replica;'
  cat "$dir/data.sql"
} | docker exec -i "$db" psql -v ON_ERROR_STOP=1 -q -U postgres -d postgres >/dev/null
npx tsx scripts/backup/storage.ts upload "$dir/storage" --local
echo "✓ відновлено в локальний Supabase з $dir"
