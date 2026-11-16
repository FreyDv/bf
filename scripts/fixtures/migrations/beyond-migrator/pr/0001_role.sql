-- migrator cannot create roles on DigitalOcean (ADR-053 item 1), so this fails here as it would there.
CREATE ROLE intruder LOGIN;
