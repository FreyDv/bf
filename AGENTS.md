# AGENTS.md - agent and contributor guide

Primary entry point for coding agents (Claude Code via the thin `CLAUDE.md` router, Cursor, Codex and
others directly) and humans. Read this first. It is the single source of truth for conventions - other
files point here, they do not restate.

## Documentation hierarchy (altitude - highest wins)

```
docs/PRINCIPLES.md -> ADR / BDR (accepted decisions, docs/decision-records/)
  -> specs/<capability> (behavior) + docs/ARCHITECTURE.md (structure)
    -> conventions (this file, .claude/rules/, .claude/skills/)
      -> code
```

Behavioral source of truth = the [capability specs](specs/) (what the system does now). Decisions =
[ADR / BDR](docs/decision-records/) (why). Structure = [ARCHITECTURE.md](docs/ARCHITECTURE.md). There is no
TDR stream.

## Project

A new project, started from a clean slate on 2026-11-05 (ADR-006): the stack is chosen (ADR-007..033) and the
monorepo skeleton exists, but no capability is specified or built yet. What and why: [PRODUCT.md](docs/PRODUCT.md). The previous prototype (a NestJS service
monorepo with AWS infrastructure) was removed on purpose; it remains in the git history of `main` (last
commit `7c7928a`) and is not a source of rules.

This repo follows [repository-standards](https://repositorystandards.com). `.standards-version` records the
state it last aligned to - a bookmark, never a version it stays at; the target is always the latest. The
rules it is measured against are the numbered rules in [`SPEC.md`](SPEC.md); `node scripts/self-verify.mjs`
checks them ([self-verify.md](docs/standards/vendor/repository-standards-core/method/self-verify.md)).

## Two bodies of binding rules

1. **Repository Standards** - how the repository is run: specs by capability, decision records, the backlog,
   discovery, the guards, the spec loop. Normative core: `SPEC.md`.
2. **Domain-Driven Hexagon** - how every backend is built, extracted from the reference README into
   numbered, stack-agnostic rules: [`.claude/rules/architecture-rules.md`](.claude/rules/architecture-rules.md)
   and the session protocol [`.claude/rules/ai-protocol.md`](.claude/rules/ai-protocol.md). **Both files are
   loaded in every session, and every plan and implementation MUST follow them without deviation**
   (ADR-002). Reasoning: [rationale.md](docs/standards/domain-driven-hexagon/rationale.md); mapping of the
   source to rule IDs: [traceability.md](docs/standards/domain-driven-hexagon/traceability.md); the source
   itself is vendored verbatim under `docs/standards/vendor/domain-driven-hexagon/`.

## Architecture protocol (binding, summary - the rules are in the two files above)

- Before planning or writing backend code, read `architecture-rules.md` and the module's capability spec.
- Every plan carries an `## Architecture conformance` section (AIP-2); a plan without it is not implemented.
- Implement inside-out, one slice at a time: domain, application, infrastructure, driving adapters, tests
  (AIP-3). Cite rule IDs in plans, reviews and pull requests.
- A conflict with a rule is a stop: name the rule, propose the ADR, wait (AIP-1, AIP-4). Never deviate silently.
- No backend module is merged before the dependency-boundary check passes in CI (ENF-1): `pnpm deps`, config
  `.dependency-cruiser.mjs`, step `Architecture boundaries` in `.github/workflows/ci.yml` (ADR-014). A violation is fixed in the code, never in the config.
- A list query with a filter follows `.claude/rules/query-filter-rules.md` (QRY rules, ADR-024), also loaded in every session.
- Skills: `ddd-plan-module` (plan), `ddd-new-use-case` (implement a slice), `ddd-review` (review).

## Repo map

| Path | Purpose |
|------|---------|
| `apps/`, `packages/` | backend (NestJS), frontend (Next.js), shared config package (ADR-008, ADR-009) |
| `compose.yaml`, `deploy/` | local environment (ADR-033), ArgoCD bootstrap values; Helm charts and manifests arrive with CHART-1 |
| `docs/PRODUCT.md`, `docs/personas.md` | what we build and for whom; personas confirmed by the owner (BDR-001), success defined in the owner's words, metrics deferred (METRICS-1) |
| `docs/decision-records/` | ADR (technical why) and BDR (business why), MADR form |
| `specs/` | living capability specs + `capability-map.json` (R8-R11); empty until the first capability |
| `docs/backlog.md` | ordered, agent-first backlog and the alignment scope count |
| `docs/discovery/`, `docs/ideas/`, `docs/runbooks/` | raw material with provenance, ideas, operational runbooks |
| `docs/standards/` | knowledge base: both sources vendored verbatim, digests of everything they cite, rationale and traceability |
| `.claude/rules/` | always-loaded binding rules (architecture, AI protocol, query filters) and the repository-standards rules |
| `.claude/skills/` | the standard's 21 lifecycle skills plus `ddd-plan-module`, `ddd-new-use-case`, `ddd-review` |
| `.claude/hooks/`, `.claude/settings.json` | agent guards (remote-DB writes, force-push, CI secrets, elicitation) and the permission baseline |
| `package.json`, `turbo.json`, `lefthook.yml`, `.dependency-cruiser.mjs` | workspace, task runner, pre-commit, boundary check (ADR-009, ADR-014, ADR-018) |
| `scripts/` | the standard's dependency-free guards (`*.mjs`), spec engine, guard self-test |
| `.github/workflows/` | the standard's gates: `spec-guard`, `gitleaks`, `standards-update-watch` |

## Commands

```bash
nvm use                                 # Node from .nvmrc (the guards need it)
node scripts/self-verify.mjs            # drift against the standard (0 = aligned in shape)
node scripts/spec-structure.mjs --block && node scripts/spec-guard.mjs --audit --block
node scripts/decision-records-check.mjs --block
bash scripts/verifyAgentGuards.sh       # after any change under .claude/hooks/

pnpm install                            # exact pins, 7-day cooldown (pnpm-workspace.yaml)
pnpm build | lint | typecheck | test    # turbo run over all packages (ADR-009)
pnpm format:check                       # prettier on code (apps/, packages/)
pnpm deps                               # architecture boundaries (DEP-2, DEP-3, DEP-5, DEP-8, DEP-9)
pnpm deps:test                          # the rules fire on violating fixtures; run after editing the config
pnpm contracts:generate                 # rebuild packages/contracts/src/generated/server.ts (the AppRouter type, ADR-035); commit it
pnpm contracts:check                    # fails when that file is out of date (CI and pre-commit); run after touching a router or request DTO
pnpm local:up | local:cdc | local:down | local:reset   # docker compose: Postgres, NATS (+ Debezium with local:cdc), ADR-033
pnpm charts                             # helm lint + helm template for the shared chart and every app under deploy/apps (ADR-019)
pnpm charts:test                        # chart behaviour: what it renders and refuses; needs `helm` on PATH
pnpm test:e2e                           # turbo run test:e2e against bf_test and NATS; start them with `pnpm local:up` first (ADR-036)
pnpm migrations:check                   # applies the migrations of main, then of this branch, to a clean Postgres; skips when none changed (ADR-036); needs Docker
pnpm migrations:test                    # the migration check on fixtures; needs Docker
pnpm image:check lint|secrets|vulns|affected   # hadolint and Trivy as pinned Docker images, and which apps need an image (ADR-036); needs Docker
```

Helm (v4) is a local requirement for the chart commands above. Before any of it the toolchain the
guards need must be present: [prerequisites.md](docs/standards/vendor/repository-standards-core/method/prerequisites.md).
Node and `jq` are not optional: without `jq` the `PreToolUse` guards deny every Bash command rather than pass
it unchecked.

## Conventions

- **Commits:** Conventional Commits, `type(scope): imperative summary`; one commit = one logical change; small,
  focused PRs; ASCII hyphen `-` only. **No AI or tool attribution** in commits or PR text (the owner chose the
  standard's convention, 2026-11-05).
  A `lefthook` pre-commit hook (`lefthook.yml`, ADR-018) runs typecheck, prettier, eslint and the boundary check on
  staged files and re-stages what it fixed. Agents never bypass it (`--no-verify`); CI is the real gate.
- **Branch and history (R23):** branch off `main`, base every PR on `main`, never on another open PR's branch;
  update by rebase, never merge `main` into your branch; land by **squash-merge** (ADR-003); never rewrite a
  branch someone else builds on.
- **Dependencies (R21, ADR-005):** exact versions, a committed lockfile, a 7-day release cooldown; a new
  dependency needs an ADR.
- **Comments:** explain *why*, never *what*. Match the comment density of the file you are editing. If a comment
  restates the line below it, delete it. Context that only matters across a work session belongs in the plan or
  the spec, not in the source.
- **Working language** (ADR-004, owner decision 2026-11-05): **code, identifiers, file and folder names, commits,
  PR text, CI output, guard messages, the agent instruction files (`AGENTS.md`, `CLAUDE.md`, `.claude/**`,
  `CONTRIBUTING.md`, `SECURITY.md`) and `docs/standards/**` in English; specs, decision records, `PRODUCT.md`,
  personas, the backlog, discovery, ideas, runbooks, principles and architecture in Russian; user-facing copy in the
  persona's language.** The marker family `[NEEDS ...]`, the headings the guards read (`## Clarifications`,
  `## Open questions`, `**Status:**`, `**Serves:**`, `**Spec tier:**`, `## Unreleased`, the required headings of this
  file) and intent ids are syntax and stay English inside a Russian document. The owner writes to the agent in
  Russian and is answered in Russian.
- **A fact has one home (R4).** A count, a version, a path or a command belongs in one file; everywhere else links
  to it or declares the restatement in `docs/facts.json`.
- **A bare record number means this repo's record.** `ADR-002` resolves against `docs/decision-records/`. The
  standard's own records are cited as `standard ADR-014`.
- The convention that keeps the fill check honest: angle brackets in prose mean *replace me*; angle brackets
  inside code formatting are notation and stay.

## Red flags - STOP and ask the human

1. Writing to a remote database (DML/DDL/migrations) - deliver a `.sql` or migration file for a human to apply.
2. Contradicting an Accepted ADR **or BDR** - propose a superseding record first. Both streams bind.
3. Adding a new dependency, datastore, broker or paid service without an ADR.
4. A breaking schema or contract change.
5. Hardcoded secrets, committed `.env` files, keys in the repo.
6. Shipping without the decision record the change implies.
7. Force-pushing a branch someone else has pulled or based work on; deleting a remote branch.
8. Deviating from `architecture-rules.md` in any way (AIP-1).
9. Writing backend code before the stack ADR and the boundary check exist.
10. Editing a vendored standard file (anything the manifest lists as `copy`) or `docs/standards/vendor/**`.

## Workflows

- **Add a feature / decision record** - the spec-driven flow. Raw discovery (meeting extracts, mails, the owner's
  requests) lands via `discovery-digest` in `docs/discovery/<topic>/` and feeds the loop - never re-asking what a
  spec already settled (standard ADR-024). New or changed behavior enters through `/spec-specify` +
  `/spec-clarify` (one capability); `/spec-impact` finds the ripple; `/spec-update` edits every affected spec;
  for backend work run `ddd-plan-module`, then `/spec-plan` -> `/spec-tasks` -> `/spec-implement` (slice by slice
  with `ddd-new-use-case`); `/spec-reconcile` closes spec == code == tests. Work items come from and return to
  [`docs/backlog.md`](docs/backlog.md). Roles and hand-offs:
  [ways of working](docs/standards/vendor/repository-standards-core/method/ways-of-working.md); where something
  goes: [taxonomy](docs/standards/vendor/repository-standards-core/method/taxonomy.md); the decision forks:
  [checklist](docs/standards/vendor/repository-standards-core/method/checklist.md).
- **Stay current with the standard** - `update-to-latest` applies the delta, then `node scripts/self-verify.mjs`
  proves it. The vendored snapshot under `docs/standards/vendor/` is refreshed in the same pass
  (provenance commits: `docs/standards/sources.md`).

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
  otherwise). If the change touches backend code, follow the binding architecture protocol (below) and run the
  boundary check before saying it is done.
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
- **The branch is ready for a pull request** -> run `ddd-review` (backend changes) and then `pre-pr-review` yourself, before pushing:
  local checks (the stack's tests and boundary check, `node scripts/self-verify.mjs`),
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

- Never write to a remote database; never force-push or delete a remote branch; never rewrite shared history.
- Never commit a secret, a real `.env`, a private key or a token.
- Never edit a vendored standard file or `docs/standards/vendor/**`.
- Never write backend code that breaks a rule of `architecture-rules.md`, and never loosen the boundary check to
  make a build pass.
- Never plan or implement against a spec with open `[NEEDS ...]` markers; never edit an Accepted record into a
  different decision - supersede it.
- Never bump a version or add a version heading to `CHANGELOG.md`; the maintainer cuts releases (R18).
- Never claim a check passed that you did not run; "I could not verify that" is a real answer.
