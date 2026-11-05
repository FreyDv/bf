# Security

**Reporting a vulnerability.** Use GitHub's private vulnerability reporting on this repository
(Security tab -> "Report a vulnerability") so the report reaches the owner without a public
issue; do not open a public issue for anything exploitable. Expect an acknowledgment within
3 business days.

**Scope.** This repo and the services it deploys (the malinina.ca platform: edge, auth, order,
course, billing, admin, ai, the two front ends and the AWS stacks under `infra/aws`).
Third-party dependencies go to their own maintainers; link the advisory here if it affects us.

**No secrets in this repo.** Enforced by the gitleaks gate (`.github/workflows/gitleaks.yml`,
`.gitleaks.toml`) - a leaked secret is rotated, not deleted from history and forgotten. The
only committed key material is the dev-only RS256 pair in `.env.example` files, replaced by
`pnpm gen:jwt-keys`; production keys live in ECS secrets.

**Baseline.** The axes of the standard's security baseline (secrets, authentication,
authorization, input validation, output and injection, transport and headers, rate limiting,
logging and privacy, dependencies, CI permissions, agent boundaries, data at rest, adversarial
testing, threat model, embargoed work, negative scope) are answered in ADR-028; agent access to
remote databases, force-pushes and CI secrets is write-blocked by `.claude/settings.json` and
the hooks under `.claude/hooks/`.
