-- The read-only role of postgres_exporter (ADR-083 item 10, ADR-086): run by the owner as doadmin, connected to the
-- database bf. Never run by an agent against the managed database (AGENTS.md red flag 1). Safe to run again.
--   psql "<doadmin connection to bf>" -v ON_ERROR_STOP=1 -f database/roles/03-as-doadmin-monitor.sql
-- The role monitor is created by DigitalOcean first (doctl databases user create <cluster> monitor), like migrator
-- and app (01-as-doadmin.sql): DigitalOcean sets and prints its password.
--
-- monitor reads statistics and settings, never data: pg_monitor is the built-in role for exactly that (pg_stat_*,
-- pg_settings, pg_database_size of every database, pg_replication_slots). doadmin is not a superuser, and on
-- PostgreSQL 16 and later granting a built-in role needs its ADMIN option, which doadmin may not hold for pg_monitor.
-- So the file tries pg_monitor first and, when that is refused, each of the three roles it is made of; the result at
-- the end says what monitor got.
\set ON_ERROR_STOP on

DO $$
BEGIN
  IF current_database() <> 'bf' THEN
    RAISE EXCEPTION 'connect to the database bf, not %', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'monitor') THEN
    RAISE EXCEPTION 'create the role monitor first (doctl databases user create <cluster> monitor)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'monitor' AND (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'monitor has SUPERUSER, CREATEROLE, CREATEDB, REPLICATION or BYPASSRLS; remove it first';
  END IF;
END
$$;

-- bf takes no CONNECT from PUBLIC (01-as-doadmin.sql), so monitor gets its own; nothing on the schema app or its
-- tables: the exporter reads only the catalog and the statistics views.
GRANT CONNECT ON DATABASE bf TO monitor;

DO $$
DECLARE
  part text;
BEGIN
  BEGIN
    GRANT pg_monitor TO monitor;
    RAISE NOTICE 'monitor is a member of pg_monitor';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_monitor refused (%); granting its parts one by one', SQLERRM;
    FOREACH part IN ARRAY ARRAY['pg_read_all_stats', 'pg_read_all_settings', 'pg_stat_scan_tables'] LOOP
      BEGIN
        EXECUTE format('GRANT %I TO monitor', part);
        RAISE NOTICE 'monitor is a member of %', part;
      EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE '% refused (%)', part, SQLERRM;
      END;
    END LOOP;
  END;
END
$$;

-- What the owner writes into docs/runbooks/bfdb-postgres.md, and tells the agent: the built-in roles monitor holds.
SELECT rolname, rolcanlogin, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls
FROM pg_roles WHERE rolname = 'monitor';
SELECT r.rolname AS member_of
FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.roleid
WHERE m.member = 'monitor'::regrole ORDER BY 1;
