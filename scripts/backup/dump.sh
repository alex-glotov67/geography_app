#!/usr/bin/env bash
# Дамп БД для бекапу (SPEC 3.5): ролі, схема, дані. Використання:
#   scripts/backup/dump.sh <out-dir> [--db-url <url> | --local]
# Дані — без того, що створюють міграції (private.settings, storage.buckets), і без службових
# таблиць Storage: файли Storage копіює storage.ts, тож відновлення — «міграції + дані + файли».
set -euo pipefail
out="$1"; shift
mkdir -p "$out"
exclude=(
  private.settings
  storage.buckets storage.objects storage.buckets_analytics storage.buckets_vectors
  storage.s3_multipart_uploads storage.s3_multipart_uploads_parts
  storage.iceberg_namespaces storage.iceberg_tables storage.vector_indexes
  supabase_functions.hooks
)
x=(); for t in "${exclude[@]}"; do x+=(-x "$t"); done
npx supabase db dump "$@" --role-only -f "$out/roles.sql"
npx supabase db dump "$@" -f "$out/schema.sql"
npx supabase db dump "$@" --data-only --use-copy "${x[@]}" -f "$out/data.sql"
echo "✓ дамп: $(du -sh "$out" | cut -f1) у $out"
