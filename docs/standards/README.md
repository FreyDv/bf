# docs/standards - the knowledge base behind this repository's rules

Two bodies of knowledge bind every planning, coding and review session, and this folder holds both **in
full**: verbatim copies of the sources, fact-preserving digests of everything they cite, and the authored
layer that turns them into this repository's rules. Nothing a future session needs is one hop outside the repo.

| Body | What it governs | Where the binding rules are |
|---|---|---|
| **Repository Standards** ([repositorystandards.com](https://repositorystandards.com), `repository-standards/core` 1.0.19) | how the repository is run: single agent entry point, specs by capability, decision records, backlog, discovery, guards, the spec loop, adoption and updates | [`SPEC.md`](../../SPEC.md) (R1-R28), `standard.manifest.json`, `.claude/skills/`, `scripts/`, `.claude/rules/repository-standards.md` |
| **Domain-Driven Hexagon** (`Sairyss/domain-driven-hexagon`) | how every backend is built, extracted from the README into stack-agnostic rules | [`.claude/rules/architecture-rules.md`](../../.claude/rules/architecture-rules.md) and [`.claude/rules/ai-protocol.md`](../../.claude/rules/ai-protocol.md), **loaded in every session**, bound by ADR-002 |

## How a session uses this folder

**Always loaded** (no action needed): `CLAUDE.md` imports `AGENTS.md`; `.claude/rules/architecture-rules.md` and
`ai-protocol.md` load at launch; `.claude/rules/repository-standards.md` loads when a session touches documents,
specs or scripts. Planning is covered too, because those two files are not path-scoped.

**Load by task** - read the row that matches what you are about to do, before you start:

| You are about to... | Read first | Then |
|---|---|---|
| plan or implement backend code | `.claude/rules/architecture-rules.md` + `ai-protocol.md` (loaded), the capability spec | `ddd-plan-module`, `ddd-new-use-case`; `domain-driven-hexagon/rationale.md` before proposing any deviation |
| review a backend diff | `ai-protocol.md` AIP-6 | `ddd-review` |
| understand why a DDD rule exists or what a cited article says | `domain-driven-hexagon/rationale.md`, `traceability.md` | `digests/D5..D8-ddh-links-*.md`, then `vendor/domain-driven-hexagon/README.md` |
| write or change a spec, a record, the backlog | `SPEC.md` R4-R15, `vendor/repository-standards-core/method/taxonomy.md` | `.../working-with-specs.md`, `.../checklist.md`, the skill that owns the step |
| decide something contestable | `.../method/taxonomy.md`, `.../method/checklist.md` | `adr-write` / `bdr-write`; the standard's ADRs in `vendor/repository-standards-core/decision-records/` as the model |
| ingest meeting notes, mails, a long request | `.../method/discovery.md` | `discovery-digest` |
| run a brownfield wave or update the standard | `.../method/adoption.md`, `.../repo-assessment.md`, `.../self-verify.md`, `vendor/repository-standards-core/skills/align-to-standards/` | `docs/adoption-*.md`, `docs/backlog.md` |
| drive an agent well (context, verification, review, blast radius) | `.../method/working-with-ai/README.md` | `digests/D9-standard-external-refs.md` |
| choose the stack (when the time comes) | `vendor/repository-standards-node/DECISIONS.md`, `.../ADAPTING.md`, `digests/D4-node-stack.md` | an ADR per fork of the decision checklist |

**Binding order on conflict:** `docs/PRINCIPLES.md` -> accepted ADR/BDR -> specs + `docs/ARCHITECTURE.md` ->
conventions (`AGENTS.md`, `.claude/rules/`) -> code. Inside this folder the vendored originals are the authority on
what a source *says*; `.claude/rules/architecture-rules.md` is the authority on what *this repository requires*;
digests are reading aids and never add a rule. The living standard at `main` of `repository-standards/core` wins
over the vendored snapshot where they differ (standard ADR-025); `update-to-latest` refreshes it.

## Contents

```
README.md                      this index
sources.md                     provenance: URL, commit, licence of every vendored source
domain-driven-hexagon/
  rationale.md                 why each rule group exists (the README's reasoning, stack-neutral) + a worked example
  traceability.md              every README section -> rule IDs; what was left to the stack ADR and why
digests/                       fact-preserving digests written from the sources (no opinions added)
  D1 core ADRs . D2a docs/FAQ/cases/open questions . D2b product/backlog/changelog/validation . D3 shipped tree, manifest, guards
  D4 Node stack . D5..D8 the 202 pages the DDH README cites . D9 formats, practices and AI sources the standard cites
vendor/                        verbatim copies (see sources.md); never edited
  repository-standards-core/   method manual, decision records, product docs, case studies, open questions, ideas, transition skills, the pristine shipped tree
  repository-standards-node/   the Node stack: README, DECISIONS, ADAPTING, SHIPPED, specs, starter configs (reference for the stack decision)
  domain-driven-hexagon/       README, licence, configs, src/, tests/, database/, docker/, assets
```

## Why this shape

- **Rules first, sources behind them.** What binds is a short, numbered, imperative rule set that is loaded
  automatically; the sources prove nothing is lost (traceability) and explain why (rationale, digests).
- **One home per rule.** A rule that binds this repo is stated once - `architecture-rules.md` for architecture,
  `AGENTS.md` for conventions - and everything else links to it (R4).
- **Loaded just in time, except the two files that must never be missed.** The standard's note "instructions that
  survive": keep always-loaded text short; the two architecture files are the deliberate exception, and the depth
  stays here, read on demand.
- **Refreshable.** `sources.md` records the commits; `update-to-latest` and a re-vendoring are the only ways this
  folder changes.
