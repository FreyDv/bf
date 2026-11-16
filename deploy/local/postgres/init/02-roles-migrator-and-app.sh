#!/bin/bash
# Local counterpart of what DigitalOcean and the owner do on bfdb (ADR-053 item 8, ADR-078, ADR-079): create the roles
# migrator and app the way `doctl databases user create` leaves them (LOGIN, nothing else), then apply the same two
# files the owner applies to bf, database/roles/01-as-doadmin.sql as doadmin and 02-as-migrator.sql as migrator, to
# bf_dev and to bf_test. compose.yaml mounts database/roles read-only at /database/roles.
# Runs once, on an empty volume, as the entrypoint's temporary server on the unix socket (no TCP yet); the
# entrypoint runs this file (it is executable) with POSTGRES_USER and the other variables set.
set -eo pipefail

roles=/database/roles
# The same dummy password as doadmin in 01-roles-and-databases.sql; this machine only.
password=bf_local_only

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --no-password --no-psqlrc --dbname postgres <<SQL
CREATE ROLE migrator LOGIN PASSWORD '$password';
CREATE ROLE app LOGIN PASSWORD '$password';
SQL

as_role() {
  local role=$1 database=$2 file=$3
  PGPASSWORD=$password psql -v ON_ERROR_STOP=1 -v "db=$database" --username "$role" --no-psqlrc \
    --dbname "$database" --file "$roles/$file" --quiet --tuples-only --output /dev/null
}

for database in bf_dev bf_test; do
  as_role doadmin "$database" 01-as-doadmin.sql
  as_role migrator "$database" 02-as-migrator.sql
done
