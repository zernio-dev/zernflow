#!/bin/sh
# Applies supabase/migrations/ALL_MIGRATIONS.sql once the auth schema exists,
# then grants the API roles and wires the two tables the inbox subscribes to
# into the realtime publication.
set -e

export PGPASSWORD="$POSTGRES_PASSWORD"
PSQL="psql -h ${POSTGRES_HOST:-db} -U supabase_admin -d ${POSTGRES_DB:-postgres} -v ON_ERROR_STOP=1"
MIGRATIONS="${MIGRATIONS_FILE:-/migrations/ALL_MIGRATIONS.sql}"

# The schema has foreign keys and a trigger on auth.users, so GoTrue has to run
# its own migrations first.
echo "[migrate] waiting for GoTrue to create auth.users..."
i=0
until $PSQL -c 'select 1 from auth.users limit 1' >/dev/null 2>&1; do
  i=$((i + 1))
  [ $i -gt 120 ] && { echo "[migrate] auth.users never appeared - did GoTrue start?"; exit 1; }
  sleep 2
done

if [ "$($PSQL -tAc "select to_regclass('public.workspaces') is not null")" = "t" ]; then
  echo "[migrate] schema already applied, skipping"
else
  echo "[migrate] applying $MIGRATIONS"
  $PSQL -f "$MIGRATIONS"
fi

echo "[migrate] granting API roles and enabling realtime"
$PSQL <<SQL
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- The inbox subscribes to postgres_changes on these two tables; on Supabase
-- Cloud you would tick "Enable Realtime" for them in the dashboard.
do \$\$
declare t text;
begin
  foreach t in array array['conversations', 'messages'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I replica identity full', t);
      if not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime'
                       and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end if;
  end loop;
end
\$\$;

notify pgrst, 'reload schema';
SQL

echo "[migrate] done"
