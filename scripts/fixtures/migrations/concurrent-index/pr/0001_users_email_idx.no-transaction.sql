-- Built without locking writes to users; Postgres refuses this inside a transaction block (ADR-075).
CREATE INDEX CONCURRENTLY users_email_idx ON users (email);
