-- Step 2 of 2 (ADR-078, ADR-053): run by the owner as migrator, connected to the database bf, after
-- 01-as-doadmin.sql (DBSEC-7). Never run by an agent (AGENTS.md red flag 1). Safe to run again.
--   psql "<migrator connection to bf>" -v ON_ERROR_STOP=1 -f database/roles/02-as-migrator.sql
--
-- The schema is named app like the role app; Postgres keeps schemas and roles apart, so `GRANT USAGE ON SCHEMA app
-- TO app` reads "the schema app to the role app".
\set ON_ERROR_STOP on

DO $$
BEGIN
  IF current_user <> 'migrator' OR current_database() <> 'bf' THEN
    RAISE EXCEPTION 'connect as migrator to bf, not as % to %', current_user, current_database();
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
ALTER ROLE migrator IN DATABASE bf SET search_path = app;

SELECT nspname, nspowner::regrole AS owner, nspacl FROM pg_namespace WHERE nspname IN ('app', 'public');
SELECT pg_get_userbyid(defaclrole) AS owner, defaclnamespace::regnamespace AS schema, defaclobjtype, defaclacl
FROM pg_default_acl;
