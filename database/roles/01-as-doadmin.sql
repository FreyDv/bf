-- Step 1 of 2 (ADR-078, ADR-053): run by the owner as doadmin, connected to the database bf, before the first
-- deploy with a database (DBSEC-7). Never run by an agent against the managed database (AGENTS.md red flag 1).
-- Safe to run again.
--   psql "<doadmin connection to bf>" -v ON_ERROR_STOP=1 -f database/roles/01-as-doadmin.sql
-- Then step 2 as migrator: database/roles/02-as-migrator.sql.
-- The database it expects is bf. The local environment applies the same file to bf_dev and bf_test (ADR-079):
--   psql ... -v db=bf_test -f database/roles/01-as-doadmin.sql
-- Every statement below names the database through current_database(), so the file acts on the one it is connected
-- to, and the check at the top refuses any other than the expected one.
--
-- The roles migrator and app are created by DigitalOcean (doctl databases user create) with no attributes beyond
-- LOGIN; doadmin is not a superuser and may have no admin option on them, so this file checks their attributes
-- instead of changing them, and makes migrator the owner of bf only when doadmin may act as migrator.
\set ON_ERROR_STOP on
\if :{?db}
\else
  \set db bf
\endif
SELECT set_config('bf.expected_db', :'db', false) AS expected_db \gset _

DO $$
BEGIN
  IF current_database() <> current_setting('bf.expected_db') THEN
    RAISE EXCEPTION 'connect to the database %, not %', current_setting('bf.expected_db'), current_database();
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
DO $$
BEGIN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO migrator, app, CURRENT_USER', current_database());
  -- migrator creates the schema app and owns every object in it (ADR-053 item 3).
  EXECUTE format('GRANT CREATE ON DATABASE %I TO migrator', current_database());
END
$$;
-- No role creates objects in public; the application lives in the schema app (ADR-078).
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- ADR-053 item 2: migrator owns bf, when doadmin may act as migrator. Otherwise bf stays doadmin's and the
-- invariant that matters (migrator owns the objects, app only uses them) holds through the CREATE above (ADR-078).
DO $$
BEGIN
  IF pg_has_role(current_user, 'migrator', 'USAGE') THEN
    EXECUTE format('ALTER DATABASE %I OWNER TO migrator', current_database());
    -- The owner change moves the old owner's entries in the ACL to migrator, so the CONNECT of the login running
    -- this file is granted again, now on behalf of migrator.
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), current_user);
    RAISE NOTICE '% is now owned by migrator', current_database();
  ELSE
    RAISE NOTICE '% stays owned by %: % cannot act as migrator; migrator has CREATE on it instead (ADR-078)',
      current_database(),
      (SELECT datdba::regrole FROM pg_database WHERE datname = current_database()), current_user;
  END IF;
END
$$;

-- What the owner writes into docs/runbooks/bfdb-postgres.md.
SELECT datname, datdba::regrole AS owner, datacl FROM pg_database WHERE datname = current_database();
SELECT rolname, rolcanlogin, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls
FROM pg_roles WHERE rolname IN ('migrator', 'app') ORDER BY rolname;
