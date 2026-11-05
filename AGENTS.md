# AGENTS.md - bf agent and contributor guide

Primary entry point for coding agents (Claude Code via the thin `CLAUDE.md` router, Cursor,
Codex and others directly) and humans. Read this first. It is the single source of truth for
conventions - other files point here, they do not restate.

## Documentation hierarchy (altitude - highest wins)

```
docs/PRINCIPLES.md -> ADR / BDR (accepted decisions, docs/decision-records/)
  -> specs/<capability> (behavior) + docs/ARCHITECTURE.md (structure)
    -> conventions (this file, .claude/rules/, .claude/skills/)
      -> code
```

Behavioral source of truth = the [capability specs](specs/) (what the system does now).
Decisions = [ADR / BDR](docs/decision-records/) (why). Structure =
[ARCHITECTURE.md](docs/ARCHITECTURE.md). There is no TDR stream.

## Project

bf is a NestJS service monorepo (edge + six services, two Next.js front ends) that will carry
the courses-and-orders product published at malinina.ca. What/why:
[PRODUCT.md](docs/PRODUCT.md). How: [ARCHITECTURE.md](docs/ARCHITECTURE.md). Quick start and
commands: [README.md](README.md).

This repo follows [repository-standards](https://repositorystandards.com). `.standards-version`
records the state it last aligned to - a bookmark, never a version it stays at; the target is
always the latest. The rules it is measured against are the numbered rules in
[`SPEC.md`](SPEC.md); [`standard.manifest.json`](standard.manifest.json) is their
machine-readable projection and `node scripts/self-verify.mjs` is how they are checked
([self-verify.md](docs/standards/vendor/repository-standards-core/method/self-verify.md)).

Two bodies of knowledge bind every session here, both captured in full under
[`docs/standards/`](docs/standards/README.md):

1. **Repository Standards** - how this repository is run: specs by capability, decision
   records, the backlog, the guards, the spec loop. Normative core: `SPEC.md`.
2. **Domain-Driven Hexagon** - how every backend service is built: modules, vertical slices,
   DDD building blocks, ports and adapters, Result-typed domain errors. Rules:
   [`docs/standards/domain-driven-hexagon/rules.md`](docs/standards/domain-driven-hexagon/rules.md),
   mapping to this stack:
   [`docs/standards/domain-driven-hexagon/bf-mapping.md`](docs/standards/domain-driven-hexagon/bf-mapping.md).

The path-scoped files under [`.claude/rules/`](.claude/rules/) load the hard rules of each body
exactly when a session touches the code they govern.

## Repo map

| Path                                                                                                                                                          | Purpose                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`                                                                                                                                                    | edge: verifies the RS256 JWT, enforces `ROUTE_ROLES`, rate-limits, proxies `/<svc>/*`; hosts the sleep/wake orchestrator (`apps/api/src/orchestrator`, admin control at `/_services`) |
| `apps/auth`, `apps/order`, `apps/course`, `apps/billing`, `apps/admin`, `apps/ai`                                                                             | NestJS services, one Postgres database each, tRPC procedures under `/trpc`                                                                                                            |
| `apps/fe-main`, `apps/fe-admin`                                                                                                                               | Next.js static exports served from S3 behind CloudFront                                                                                                                               |
| `packages/contracts`                                                                                                                                          | contract-first tRPC contracts: hand-written zod schemas + generated router types (`pnpm contracts:generate`)                                                                          |
| `packages/trpc`, `packages/server`, `packages/db`, `packages/events`, `packages/shared`, `packages/storage`, `packages/llm`, `packages/ui`, `packages/config` | shared runtime, server bootstrap, Drizzle, outbox, S3 port, LLM port, UI kit, lint/tsconfig/prettier presets                                                                          |
| `infra/aws`                                                                                                                                                   | AWS CDK (ECS Fargate scale-to-zero, CloudFront + S3, Aurora Serverless v2) and the TypeScript ops scripts                                                                             |
| `infra/*`                                                                                                                                                     | local docker compose files per dependency                                                                                                                                             |
| `docker/`                                                                                                                                                     | the Dockerfiles for Nest apps, Next exports and migrations                                                                                                                            |
| `.github/workflows/pipeline.yml`                                                                                                                              | the one pipeline from PR to production (`ci ok` is the required check); `spec-guard.yml`, `gitleaks.yml`, `standards-update-watch.yml` are the standard's gates                       |
| `specs/`                                                                                                                                                      | living capability specs + `capability-map.json` (R8-R11)                                                                                                                              |
| `docs/decision-records/`                                                                                                                                      | ADR (technical why) and BDR (business why), MADR form                                                                                                                                 |
| `docs/backlog.md`                                                                                                                                             | ordered, agent-first backlog - the work the repo still owes itself (features + spec/decision/doc debt)                                                                                |
| `docs/discovery/`                                                                                                                                             | dossiers of raw material with provenance (never normative)                                                                                                                            |
| `docs/standards/`                                                                                                                                             | the knowledge base: both standards vendored verbatim, digests, rules, the mapping to this stack                                                                                       |
| `.claude/skills/`                                                                                                                                             | the 21 lifecycle skills of the standard plus this repo's own (`bf-*`)                                                                                                                 |
| `.claude/hooks/`, `.claude/settings.json`                                                                                                                     | agent guards (remote-DB writes, force-push, CI secrets, elicitation) and the permission baseline                                                                                      |
| `scripts/`                                                                                                                                                    | this repo's TypeScript ops scripts (run by plain `node`) and the standard's dependency-free guards (`*.mjs`)                                                                          |

## Commands

```bash
nvm use && npm i -g pnpm@10.15.0 && pnpm install
pnpm setup:env                          # .env.example -> .env for every app and infra folder
pnpm infra:core && pnpm build && pnpm dev
pnpm lint && pnpm typecheck && pnpm test  # ESLint flat, tsc, Jest - per package through turbo
pnpm deps                               # dependency-cruiser: the hexagonal boundaries, per app
pnpm format:check                       # prettier, whole repo (vendored standard files are ignored)
pnpm contracts:generate && pnpm contracts:check
pnpm db:generate | db:check | db:migrate   # drizzle-kit per service, POSTGRES_DB=<svc>, local only
node scripts/self-verify.mjs            # drift against the standard (0 = aligned in shape)
node scripts/spec-structure.mjs --block && node scripts/spec-guard.mjs --audit --block
bash scripts/verifyAgentGuards.sh       # after any change under .claude/hooks/
```

Before any of it the toolchain the shipped guards need must be present:
[prerequisites.md](docs/standards/vendor/repository-standards-core/method/prerequisites.md).
Node and `jq` are not optional: without `jq` the `PreToolUse` guards deny every Bash command
rather than pass it unchecked.

## Conventions

<!-- Merged from docs/conventions.md (the standard's canonical block) and this repo's own
     decisions. Keep it here; do not duplicate into CLAUDE.md or .cursor/rules. -->

- **Commits:** Conventional Commits, `type(scope): imperative summary`; one commit = one
  logical change; small, focused PRs; ASCII hyphen `-` only in commits and PR text.
  **No AI or tool attribution** in commits or PR text (no `Co-Authored-By: Claude`, no "Generated with"): the owner chose the standard's convention on 2026-11-05 (backlog `CONV-1` removes the trailers carried by older commits).
- **Branch and history (R23):** branch off `main` and base every PR on `main`, never on another
  open PR's branch; update by rebase (`git rebase main`), never merge `main` into your branch;
  land by **squash-merge** (the integration method this repository already uses - ADR-027);
  never rewrite a branch someone else builds on.
- **Language:** TypeScript everywhere. Ops, CI and infra scripts are TypeScript run by plain
  `node` (Node 26 strips types); infrastructure is AWS CDK in TypeScript. No bash of our own -
  the standard's shipped `.sh` guards and spec engine are the one exception, kept verbatim.
- **Communication:** FE <-> BE and service <-> service calls are tRPC only, contract-first through
  `@bf/contracts` (ADR-017). No ad-hoc REST, no hand-written HTTP clients. `router.ts` files are
  generated - never edited.
- **Backend architecture:** every service module follows Domain-Driven Hexagon - the rules in
  `.claude/rules/backend-architecture.md` are mandatory and `pnpm deps` enforces the boundaries.
- **Database (R24, adapted):** one Postgres database per service, Drizzle schema under
  `apps/<svc>/src/db/schema.register.ts` is the typed definition every read and write goes
  through; migrations are committed under `apps/<svc>/drizzle` and run as one-off Fargate tasks
  in production. Never apply a schema change to a remote database by hand - the pipeline does it.
  The DDL twin under `database/schema/` is open work (backlog `DB-SCHEMA-1`).
- **Resources:** let the AWS SDK discover resources (names, tags) instead of threading ids
  through env vars; no DynamoDB or any extra state store for the orchestrator (ADR-023).
- **Budget:** the platform must stay within the recorded cap (BDR-002); every infra change states
  its monthly cost.
- **Comments:** explain _why_, never _what_. Match the comment density of the file you are
  editing. If a comment restates the line below it, delete it. Context that only matters across
  a work session belongs in the plan or the spec, not in the source.
- **Working language** (decided by the owner on 2026-11-05, intake card 1): **code,
  identifiers, file and folder names, commit messages, PR text, CI output, guard messages and
  the agent instruction files (`AGENTS.md`, `CLAUDE.md`, `.claude/**`, `CONTRIBUTING.md`,
  `SECURITY.md`) and `docs/standards/**` (reference that mirrors its English sources) in English; specs, decision records, `PRODUCT.md`, personas, the backlog,
  discovery, ideas, runbooks, principles and architecture in Russian; user-facing copy in the
  persona's language.** The marker family `[NEEDS ...]`, the headings the guards read
  (`## Clarifications`, `## Open questions`, `**Status:**`, `**Serves:**`, `**Spec tier:**`,
  `## Unreleased`, the four required headings of this file) and intent ids are syntax and stay
  English inside a Russian document. The owner writes to the agent in Russian and is answered in
  Russian. Documents written in English before this decision are translated in waves (backlog
  `LANG-2`).
- **A fact has one home (R4).** A count, a version, a path or a command belongs in one file;
  everywhere else links to it or declares the restatement in `docs/facts.json`.
- **A bare record number means this repo's record.** `ADR-014` resolves against
  `docs/decision-records/`. The standard's own records are cited as `standard ADR-014`.
- The convention that keeps the fill check honest: angle brackets in prose mean _replace me_;
  angle brackets inside code formatting are notation and stay.

## Red flags - STOP and ask the human

1. Writing to a remote database (DML/DDL/migrations) - deliver the migration file instead; the
   pipeline applies it as a one-off Fargate task.
2. Contradicting an Accepted ADR **or BDR** - propose a superseding record first. Both streams
   bind; the product-side one is the one a feature request actually collides with.
3. Adding a new dependency, a second datastore, a message broker or any infrastructure that
   costs money without an ADR that states the monthly cost.
4. A breaking change to a contract in `packages/contracts` or to a database schema.
5. Hardcoded secrets, committed `.env` files, keys in the repo (the only committed key pair is
   the dev-only RS256 pair that `pnpm gen:jwt-keys` replaces).
6. Shipping without the decision record the change implies.
7. Force-pushing a branch someone else has pulled or based work on; deleting a remote branch.
8. Deploying to AWS outside the pipeline (`pnpm aws:deploy`, `aws:release`, `cdk deploy`) or
   touching production ECS/Aurora state by hand.
9. A health check that reaches the database from `/health/live` - Aurora must be able to pause
   (ADR-023).
10. Editing a generated file (`packages/contracts/src/*/router.ts`, `apps/*/drizzle/**`) or a
    vendored standard file (anything the manifest lists as `copy`, anything under
    `docs/standards/vendor/`).
11. A domain-layer file importing NestJS, Drizzle, pg, express or another module's internals.

## Workflows

- **Add a feature / migration / decision record** - the spec-driven flow. Raw discovery
  (meeting extracts, mails, the owner's requests) lands via `discovery-digest` in
  `docs/discovery/<topic>/` and feeds the loop - never re-asking what a spec already settled
  (standard ADR-024). New or changed behavior enters through `/spec-specify` +
  `/spec-clarify` (one capability); `/spec-impact` finds the ripple; `/spec-update` edits every
  affected spec; `/spec-plan` -> `/spec-tasks` -> `/spec-implement` build it; `/spec-reconcile`
  closes spec == code == tests and checks the specs still agree with each other. Work items
  come from and return to [`docs/backlog.md`](docs/backlog.md). Roles and hand-offs
  (PO -> dev -> AI): the standard's
  [ways of working](docs/standards/vendor/repository-standards-core/method/ways-of-working.md).
  Not sure where something goes - a decision, a rule, raw material, a work item?
  [taxonomy.md](docs/standards/vendor/repository-standards-core/method/taxonomy.md) is the
  routing map; the decision catalog itself is
  [checklist.md](docs/standards/vendor/repository-standards-core/method/checklist.md).
- **Add a backend module or use case** - `bf-new-module` and `bf-new-use-case` scaffold the
  Domain-Driven Hexagon shape (domain, commands/queries, ports, adapters, contract schemas,
  tests) and say which files a slice needs; `bf-architecture-review` reads a diff against the
  rules before a PR.
- **Bring this repo up to the standard (brownfield)** - alignment + onboarding run from a
  checkout of repository-standards (`skills/align-to-standards`, vendored under
  `docs/standards/vendor/repository-standards-core/skills/`): assess, seed specs, record the
  decisions the code implies, queue the rest in the backlog. Incremental, never a big-bang.
  The first wave (2026-11-04/05) is recorded in `docs/adoption-intake.md`,
  `docs/adoption-assessment.md` and `docs/adoption-provenance.md`.
- **Stay current with the standard** - `.standards-version` records the state last aligned to.
  `update-to-latest` applies the delta (not a re-scaffold), then `node scripts/self-verify.mjs`
  proves it complies. The vendored snapshot under `docs/standards/vendor/` is refreshed in the
  same pass (its provenance commits are listed in `docs/standards/sources.md`).

## The loop runs itself (unprompted)

Do not wait to be asked. The standard's loop is **AI-led** (standard ADR-010; the clarify gate).

**The first rule of working here: check whether a skill owns the request before you act on
it, and check again when the work is done.** The skills in [`.claude/skills/`](.claude/skills/)
are how this repo does things, not a menu of shortcuts for people who remember the names.
Each one's description says which situation it is for. Three layers make this hold, and only
the last is certain - so do not rely on it:

1. **A skill fires on its own** when what you were asked matches its description.
2. **This file and `CLAUDE.md` tell you to look.** That covers what the descriptions miss.
3. **The guards catch the outcome regardless.** The coupling guard blocks a pull request where
   a capability's code moved without its spec, `pnpm deps` fails a boundary violation, and the
   hooks refuse a remote write, whether or not any skill ran.

A user should never have to say "remember to use the skills". If that becomes necessary, the
skill's description is wrong and fixing it is the bug.

- **The user describes a feature, story, or behavior change** -> start the loop yourself: ask
  the clarify questions, record answers in the spec's `## Clarifications`. A deferral is an
  answer - record it, route it, never drop it. Loop until zero open markers of the
  `[NEEDS ...` family.
- **The user changes code** -> run `spec-impact` on your own; if the change touches a
  capability's behavior, update its spec in the same PR (the coupling guard will block
  otherwise). If the change touches a backend module, apply the Domain-Driven Hexagon rules
  (`.claude/rules/backend-architecture.md`) and run `pnpm deps` before saying it is done.
- **The user drops meeting notes, a transcript, a mail or a long request** -> run
  `discovery-digest`: extract the essence (with provenance) into the topic's dossier under
  `docs/discovery/`, flag contradictions, and say whether the topic is ripe for
  `/spec-specify`. If a spec already exists, route only entries newer than the dossier's
  `Last reconciled:` stamp through `/spec-clarify`.
- **You are answering a question about this repo** - what is true, why a decision went the way
  it did, whether something exists - or you are about to research or explain how something
  works **-> answer from the corpus, and name the file you took it from.** The corpus is
  `docs/decision-records/` (both streams bind equally), `specs/` for behaviour,
  `docs/discovery/` for what was said, `docs/backlog.md` for what the repo still owes itself,
  `docs/ideas/` for what was floated, and `docs/standards/` for what the two standards say.
  Read the records first: an Accepted record outranks a dossier and outranks the request
  (standard ADR-033). Cite it by number and path. Search `docs/discovery/` in full, including
  entries older than the stamp (standard ADR-049). **When the corpus is silent, say so in those
  words - "no record of this" - and stop**, then offer the record that would close it
  (`add-to-backlog`, `idea-write`, `adr-write` / `bdr-write`).
- **Never take a spec to plan / tasks / the tracker** unless it passes the clarify gate
  (`Status: ready-to-develop`). If the user asks you to skip ahead, show what is open instead.
- **Ask once, up front**: will the user author the technical detail, or should you propose it?
  Either way you propose and guide - hand-holding is the product.
- **Work surfaces that is not this change** -> run `add-to-backlog` rather than doing it now or
  losing it: one row with its source, the role that must act, and what done looks like.
- **The user asks what the work state is** -> run `show-backlog`. The work state has one home -
  the committed files.
- **A decision gets made in conversation** -> run `adr-write` (technical) or `bdr-write`
  (product) _while it is still fresh_. Who would overrule it decides which.
- **The repo cannot say who it is for, or what it is building** -> `personas-write` and
  `product-write`. Both are drafted and marked `[NEEDS REVIEW]` here; the owner confirms them.
- **The branch is ready for a pull request** -> run `pre-pr-review` yourself, before pushing:
  local checks (`pnpm lint typecheck test deps format:check`, `node scripts/self-verify.mjs`),
  then read the diff as if someone else wrote it, then fix what it finds.
- **The user asks to move to a newer standard version** -> run `update-to-latest`.
- **On request, explain simply**: any ADR/BDR/spec, in plain language with examples anchored
  to `docs/personas.md` - the owner must never have to gate what they cannot read.

None of these skills waits to be invoked by name.

## Volunteer, don't wait to be asked

Matching a request against the skill descriptions is not enough when the request itself is
ambiguous. If a message mentions - in passing, not as the main ask - something that sounds
like a bug, a decision, or scope creep, and no skill description clearly claims it, say so and
name the candidate: "that sounds like a bug - want me to `add-to-backlog` it, or are you
fixing it now?" Do not silently do the extra work, and do not silently file nothing. A wrong
guess costs one line to correct; silence costs the record.

## Say where you are, every minute or two

Long work is silent by default. While work is running, post **one or two sentences every
60-120 seconds**: what you are doing now, and what you are waiting on. Not a recap, not the
plan again, not a menu of options. The rule that can actually be obeyed is **do not chain a
long run of silent tool calls**: a line before each batch, not one per file opened.

- **Waiting is an update.** Say what you are waiting on and for how long.
- **Never invent progress, and never report a result that has not come back.** Do not present
  a subagent's findings before the subagent has returned them, and do not guess what it will
  find. Silence is bad; fabricated progress is worse.
- **A countable total earns a measured percentage.** `Progress: N/M (Z%)` from a real count.
- **No countable total still earns a percentage, labelled as an estimate:** `~Z% (estimate)`.
- **It does not replace the answer, and it is not a ceremony.** Thirty seconds of work has
  nothing to report.

## What you must not do

The hard bans for this repo - each is also a guard, a lint rule or a CI check where one can be:

- Never write to a remote database; never run `cdk deploy`, `aws:release`, `aws:static` or an
  ECS update by hand - the pipeline is the only path to production.
- Never force-push or delete a remote branch; never rewrite shared history.
- Never commit a secret, a real `.env`, a private key or a token; never read another person's
  `~/.ssh` or `~/.aws`.
- Never edit a generated file, a vendored standard file or `docs/standards/vendor/**`.
- Never let a domain layer import a framework, an ORM, a driver or another module's internals;
  never let a use case import another use case (`pnpm deps` is the gate).
- Never add REST endpoints, hand-written HTTP clients or a second RPC style between our own
  services and front ends - tRPC through `@bf/contracts` only.
- Never add DynamoDB, a second datastore, a broker or a paid AWS resource without an ADR and
  the cost in it.
- Never bump a version or add a version heading to `CHANGELOG.md`; the maintainer cuts
  releases (R18).
- Never plan or implement against a spec with open `[NEEDS ...]` markers; never edit an
  Accepted record into a different decision - supersede it.
- Never claim a check passed that you did not run; "I could not verify that" is a real answer.
