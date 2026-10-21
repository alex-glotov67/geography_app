-- Фаза 3: конфлікт ревізій — код PT409 замість 40001 (виправлення 20261015090000_builder.sql).
-- 40001 — serialization_failure: PostgREST повторює такі транзакції сам, тож запит через Data API
-- зависав до 504 замість відповіді «урок змінено деінде». Коди PTxyz PostgREST віддає як HTTP xyz:
-- PT409 → 409 Conflict, у тілі помилки code = 'PT409'. Зворотно сумісно: лише тіло функції.
create or replace function private.revision_conflict(p_what text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% змінено в іншій вкладці чи на іншому пристрої', p_what using errcode = 'PT409';
end;
$$;
