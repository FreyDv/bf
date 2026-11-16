-- Step 1 of 2 (ADR-078, ADR-053): run by the owner as doadmin, connected to the database bf, before the first
-- deploy with a database (DBSEC-7). Never run by an agent (AGENTS.md red flag 1). Safe to run again.
--   psql "<doadmin connection to bf>" -v ON_ERROR_STOP=1 -f database/roles/01-as-doadmin.sql
-- Then step 2 as migrator: database/roles/02-as-migrator.sql.
--
-- The roles migrator and app are created by DigitalOcean (doctl databases user create) with no attributes beyond
-- LOGIN; doadmin is not a superuser and may have no admin option on them, so this file checks their attributes
-- instead of changing them, and makes migrator the owner of bf only when doadmin may act as migrator.
\set ON_ERROR_STOP on

DO $$
BEGIN
  IF current_database() <> 'bf' THEN
    RAISE EXCEPTION 'connect to the database bf, not %', current_database();
  END IF;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('migrator', 'app')) <> 2 THEN
    RAISE EXCEPTION 'create the roles migrator and app first (doctl databases user create)';
  END IF;
  -- ADR-053 item 1: neither role may create roles or databases, replicate, bypass row security or be a superuser.
  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname IN ('migrator', 'app')
      AND (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'migrator or app has SUPERUSER, CREATEROLE, CREATEDB, REPLICATION or BYPASSRLS; remove it first';
  END IF;
END
$$;

-- Only the two roles and the owner's own login (doadmin, for these files and manual checks, ADR-053 item 1) connect
-- to bf; nobody else gets the default CONNECT and TEMPORARY of PUBLIC. CURRENT_USER keeps doadmin able to connect
-- once bf belongs to migrator.
REVOKE ALL ON DATABASE bf FROM PUBLIC;
GRANT CONNECT ON DATABASE bf TO migrator, app, CURRENT_USER;
-- migrator creates the schema app and owns every object in it (ADR-053 item 3).
GRANT CREATE ON DATABASE bf TO migrator;
-- No role creates objects in public; the application lives in the schema app (ADR-078).
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- ADR-053 item 2: migrator owns bf, when doadmin may act as migrator. Otherwise bf stays doadmin's and the
-- invariant that matters (migrator owns the objects, app only uses them) holds through the CREATE above (ADR-078).
DO $$
BEGIN
  IF pg_has_role(current_user, 'migrator', 'USAGE') THEN
    ALTER DATABASE bf OWNER TO migrator;
    -- The owner change moves the old owner's entries in the ACL to migrator, so the CONNECT of the login running
    -- this file is granted again, now on behalf of migrator.
    EXECUTE format('GRANT CONNECT ON DATABASE bf TO %I', current_user);
    RAISE NOTICE 'bf is now owned by migrator';
  ELSE
    RAISE NOTICE 'bf stays owned by %: % cannot act as migrator; migrator has CREATE on bf instead (ADR-078)',
      (SELECT datdba::regrole FROM pg_database WHERE datname = 'bf'), current_user;
  END IF;
END
$$;

-- What the owner writes into docs/runbooks/bfdb-postgres.md.
SELECT datname, datdba::regrole AS owner, datacl FROM pg_database WHERE datname = 'bf';
SELECT rolname, rolcanlogin, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls
FROM pg_roles WHERE rolname IN ('migrator', 'app') ORDER BY rolname;
