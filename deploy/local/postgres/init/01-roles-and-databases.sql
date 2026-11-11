-- Mirrors the managed database bfdb (snapshot 2026-11-11, docs/runbooks/bfdb-postgres.md): the application role
-- doadmin is not a superuser; it can log in, create roles and databases, replicate and bypass row security,
-- and inherits the managed group roles. The image's bootstrap superuser (POSTGRES_USER) only runs this file.
-- The database name bf_test marks it as a test database; behavioural tests refuse any other (TST-3).
CREATE ROLE _doadmin_auditing NOLOGIN;
CREATE ROLE _doadmin_managed NOLOGIN IN ROLE _doadmin_auditing, pg_create_subscription, pg_read_all_stats,
  pg_signal_autovacuum_worker, pg_signal_backend, pg_stat_scan_tables;
CREATE ROLE doadmin_group NOLOGIN IN ROLE _doadmin_managed;
CREATE ROLE doadmin LOGIN CREATEROLE CREATEDB REPLICATION BYPASSRLS PASSWORD 'bf_local_only' IN ROLE doadmin_group;
ALTER DATABASE bf_dev OWNER TO doadmin;
CREATE DATABASE bf_test OWNER doadmin;
