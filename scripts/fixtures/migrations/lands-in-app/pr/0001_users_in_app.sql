-- 0000_users.sql names no schema; it must have landed in app (search_path of migrator, ADR-078).
CREATE VIEW user_emails AS SELECT email FROM app.users;
