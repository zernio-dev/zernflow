#!/bin/sh
# Prepares the database for GoTrue, PostgREST and Realtime.
#
# Connects as supabase_admin, NOT postgres: in the supabase/postgres image the
# postgres role is not a superuser, and supautils guards the internal roles.
# Using postgres here fails with:
#   ERROR: "authenticator" is a reserved role, only superusers can modify it
set -e

export PGPASSWORD="$POSTGRES_PASSWORD"
PSQL="psql -h ${POSTGRES_HOST:-db} -U supabase_admin -d ${POSTGRES_DB:-postgres} -v ON_ERROR_STOP=1"

echo "[init] waiting for postgres..."
i=0
until $PSQL -c 'select 1' >/dev/null 2>&1; do
  i=$((i + 1))
  [ $i -gt 120 ] && { echo "[init] postgres never became reachable"; exit 1; }
  sleep 2
done

echo "[init] configuring roles and schemas"
$PSQL <<SQL
-- The image creates anon/authenticated/service_role/authenticator/supabase_auth_admin
-- but leaves them without a password, so they cannot connect over TCP.
alter role authenticator with login password '${POSTGRES_PASSWORD}';
alter role supabase_auth_admin with login password '${POSTGRES_PASSWORD}';
grant anon, authenticated, service_role to authenticator;

-- Realtime keeps its own state here; this is the one schema the image lacks.
create schema if not exists _realtime authorization supabase_admin;

alter database ${POSTGRES_DB:-postgres} set "app.settings.jwt_secret" to '${JWT_SECRET}';
alter database ${POSTGRES_DB:-postgres} set "app.settings.jwt_exp" to '3600';

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

do \$\$
begin
  if not exists (select from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
\$\$;
SQL

echo "[init] done"
