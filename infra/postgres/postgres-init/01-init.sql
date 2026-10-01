-- Runs once, on first start of an empty data volume (docker-entrypoint-initdb.d).
-- Everything here is idempotent so it can also be re-run by hand safely:
--   PGPASSWORD=bf psql -h localhost -U bf -d bf -v DBNAME=bf -f infra/postgres/postgres-init/01-init.sql
--
-- One database per service (public schema inside): auth, order, course, billing, admin.
-- Migrations run as the owner (POSTGRES_USER, "bf"); each service also gets a dev-only role
-- "<svc>_user" (password = role name) in case you want least-privilege connections locally.

SELECT 'CREATE DATABASE "auth"'    WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'auth')    \gexec
SELECT 'CREATE DATABASE "order"'   WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'order')   \gexec
SELECT 'CREATE DATABASE "course"'  WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'course')  \gexec
SELECT 'CREATE DATABASE "billing"' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'billing') \gexec
SELECT 'CREATE DATABASE "admin"'   WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'admin')   \gexec

DO $$
DECLARE
  svc text;
BEGIN
  FOREACH svc IN ARRAY ARRAY['auth', 'order', 'course', 'billing', 'admin'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = svc || '_user') THEN
      EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', svc || '_user', svc || '_user');
    END IF;
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', svc, svc || '_user');
  END LOOP;
END
$$;

-- Per-database grants must run connected to that database.
\connect auth
GRANT ALL ON SCHEMA public TO auth_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO auth_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO auth_user;

\connect order
GRANT ALL ON SCHEMA public TO order_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO order_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO order_user;

\connect course
GRANT ALL ON SCHEMA public TO course_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO course_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO course_user;

\connect billing
GRANT ALL ON SCHEMA public TO billing_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO billing_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO billing_user;

\connect admin
GRANT ALL ON SCHEMA public TO admin_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin_user;
