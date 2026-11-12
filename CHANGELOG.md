# Changelog

All notable changes to this project, in [Keep a Changelog](https://keepachangelog.com/) style. Semver: MAJOR = breaking changes, MINOR = new functionality (backwards compatible), PATCH = fixes and clarifications.

## Unreleased

<!-- A PR describes its change here, one entry per change - never a version heading, never VERSION itself (R18). The maintainer alone promotes this section into a release: https://github.com/repository-standards/core/blob/main/docs/method/changelog-process.md -->

### AI provider recorded (2026-11-12)

For the owner and every future spec author: ADR-041 records OpenAI as the AI provider (the owner's choice of 2026-11-11) and the rules around it. Any call to the provider goes through a port in `application/ports/` with its adapter in `infrastructure/` and an in-memory double; the first spec that calls it names the port, the module and the process. The key is `OPENAI_API_KEY`, held per ADR-020, and only the process that calls the provider receives it (a separate secret if that is a worker apart from the public API). The official `openai` package is pre-approved for the adapter only and is not added yet. The cost ceiling belongs to BUDGET-1 and personal data sent to the provider to PRIVACY-1; the record carries no numbers or models. No separate BDR was written for the vendor; switching provider is a revisit signal. The agent decided the rules on the owner's blanket delegation of 2026-11-12. Worth knowing: until BUDGET-1 exists the key has no spending ceiling, and nothing but review stops an `openai` import outside the adapter (OPENAI-1). Content rights for uploaded courses are COURSES-1.

### Authentication and authorization recorded (2026-11-12)

For the owner and every future spec author: ADR-040 decides how Danya and Valeria sign in and what they may do. Passwords are hashed with argon2id from `node:crypto` (no new dependency), sessions live in Postgres behind a `__Host-` cookie (7 days idle, 30 absolute), accounts are created and reset by an operator command that the owner runs, and permissions are data: Danya's account holds all of them, Valeria starts with none until Danya grants them. The check runs in the handler through a port, with the scope in `WHERE` outside the caller's filter (QRY-17). The buyer stays account-less and tracks an order by phone; how the phone proves ownership goes to the orders spec. ChatGPT through MCP gets a revocable token bound to a person's account, with the protocol left to the first MCP spec. It closes the AUTH-1 deferrals of ADR-037. The agent decided this on the owner's blanket delegation of 2026-11-12, not item by item. Worth knowing: without a second factor the admin rests on a password, limits and a failed-attempt counter (AUTH-2), and `synchronous_commit=off` (DBSEC-2) can bring back a just-deleted session after a node crash. Implementation rows: AUTH-3, AUTH-4.

### Testing strategy recorded (2026-11-12)

For every future spec author and agent: ADR-039 names the test levels and where each runs. `test` holds domain unit, use-case (in-memory port doubles) and type-level tests and needs no Docker; `test:e2e` holds behavioural tests through the driving adapter against `bf_test` and NATS. Test files sit next to the slice (`*.test.ts`, `*.e2e.test.ts`), port doubles are `*.in-memory.ts`. Money, access, personal data, external contracts, query filters and the outbox transaction need a behavioural test; there is no numeric coverage threshold. Nothing is wired yet: the Vitest preset, the `test:e2e` script, the database-name guard and the boundary-check exemption for test files are backlog rows TEST-2 and TEST-3.

### Security baseline recorded (2026-11-12)

For the owner and every future spec author: ADR-037 answers all 16 axes of the standard's security baseline in one table (secrets, input validation, CI permissions, dependencies, data at rest, threat model and the rest), linking decisions already taken and naming the row that owns each deferral (authentication and authorization - AUTH-1). It was decided by the agent on the owner's blanket delegation of 2026-11-12, not item by item. Findings worth knowing: private vulnerability reporting, which `SECURITY.md` points reporters to, is switched off on GitHub, and `bfdb` backups have never been restore-tested (GHSET-1, BACKUP-1). `SECURITY.md` now states the embargo rule, and `docs/runbooks/github-settings.md` lists the security settings with their check commands.

### CI builds, checks and publishes images; migrations and e2e are wired (2026-11-12)

For every contributor and agent: `ci.yml` now has three jobs (ADR-036). `ci` keeps its name and adds the e2e and migration steps, which run only once a package defines `test:e2e` and only when a pull request touches `apps/backend/migrations/`. The new `image` job runs hadolint and builds and scans the images of the affected apps; the new `publish` job pushes `ghcr.io/freydv/bf-backend` and `bf-frontend`, tagged with the commit SHA, on `main` and is the only job with `packages: write`. Both apps now have a `Dockerfile` (ADR-027). The owner adds `image` to the required checks and makes the GHCR packages public by hand: paths in `docs/runbooks/github-settings.md`. New commands: `pnpm test:e2e`, `migrations:check`, `migrations:test`, `image:check`.

### Success defined, metrics deferred (2026-11-12)

For every future spec author: `PRODUCT.md` now says what success means in the owner's words (each new pastry moves along course -> ingredients -> intermediate -> finished -> sold) and gives the ~12-month horizon and the stake. North Star numbers are deferred by the owner until the first features (backlog METRICS-1); a spec's `Success metric` names the step of the chain it moves.

### Personas confirmed by the owner (2026-11-11)

For every future spec author: the four personas are now confirmed and binding (BDR-001 Accepted) - `Владелец-оператор` (Даня, primary), `Кондитер` (Валерия), `Покупатель`, `ChatGPT через MCP` - with every field filled in `docs/personas.md`. The owner's product story is filed under `docs/discovery/product-vision/`; `PRODUCT.md` no longer says the platform serves one person.

### Clean slate with repository standards and binding architecture rules (2026-11-05)

For the owner and every future contributor or agent: the earlier prototype (services, infrastructure, decisions) was removed. The repository now carries only its foundation: the standard's shipped tree (`AGENTS.md` as the single entry point, guards, skills, CI gates), a knowledge base under `docs/standards/` holding both sources verbatim with digests, and the Domain-Driven Hexagon rules extracted into stack-agnostic, always-loaded rules (`.claude/rules/architecture-rules.md`, `.claude/rules/ai-protocol.md`) with skills for planning, implementing and reviewing. No stack is chosen yet.
