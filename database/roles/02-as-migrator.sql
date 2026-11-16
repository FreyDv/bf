-- Step 2 of 2 (ADR-078, ADR-053): run by the owner as migrator, connected to the database bf, after
-- 01-as-doadmin.sql (DBSEC-7). Never run by an agent against the managed database (AGENTS.md red flag 1).
-- Safe to run again.
--   psql "<migrator connection to bf>" -v ON_ERROR_STOP=1 -f database/roles/02-as-migrator.sql
-- The database it expects is bf. The local environment applies the same file to bf_dev and bf_test (ADR-079):
--   psql ... -v db=bf_test -f database/roles/02-as-migrator.sql
--
-- The schema is named app like the role app; Postgres keeps schemas and roles apart, so `GRANT USAGE ON SCHEMA app
-- TO app` reads "the schema app to the role app".
\set ON_ERROR_STOP on
\if :{?db}
\else
  \set db bf
\endif
SELECT set_config('bf.expected_db', :'db', false) AS expected_db \gset _

DO $$
BEGIN
  IF current_user <> 'migrator' OR current_database() <> current_setting('bf.expected_db') THEN
    RAISE EXCEPTION 'connect as migrator to %, not as % to %',
      current_setting('bf.expected_db'), current_user, current_database();
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION migrator;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
-- app uses the schema and never creates in it (ADR-053 items 1 and 3).
GRANT USAGE ON SCHEMA app TO app;

-- Every table and sequence migrator creates in app is usable by app at once, with no grant per table (ADR-053 item 3).
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA app
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app;
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA app
  GRANT USAGE, SELECT ON SEQUENCES TO app;

-- Migrations use unqualified names; in bf they land in app. The application sets search_path itself from
-- DB_SCHEMA=app (@bf/db-utils, ADR-061).
DO $$
BEGIN
  EXECUTE format('ALTER ROLE migrator IN DATABASE %I SET search_path = app', current_database());
END
$$;

SELECT nspname, nspowner::regrole AS owner, nspacl FROM pg_namespace WHERE nspname IN ('app', 'public');
SELECT pg_get_userbyid(defaclrole) AS owner, defaclnamespace::regnamespace AS schema, defaclobjtype, defaclacl
FROM pg_default_acl;
