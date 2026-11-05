# docs/standards - the knowledge base behind this repository's rules

Two bodies of knowledge bind every planning, coding and review session here, and this folder
holds both **in full**: verbatim copies of the sources, fact-preserving digests of everything
they cite, and the authored layer that turns them into this repository's own rules. Nothing a
future session needs is one hop outside the repo.

| Body                                                                                                                      | What it governs                                                                                                                                                            | Normative entry point in this repo                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Repository Standards** ([repositorystandards.com](https://repositorystandards.com), `repository-standards/core` 1.0.19) | how the repository is run: the single agent entry point, specs by capability, decision records, the backlog, discovery, guards, the spec loop, adoption and updates        | [`SPEC.md`](../../SPEC.md) (R1-R28), `standard.manifest.json`, the skills under `.claude/skills/`, the guards under `scripts/`                                                                              |
| **Domain-Driven Hexagon** (`Sairyss/domain-driven-hexagon`)                                                               | how every backend service is built: modules and vertical slices, DDD building blocks, ports and adapters, CQS, Result-typed domain errors, persistence models, enforcement | [`domain-driven-hexagon/rules.md`](domain-driven-hexagon/rules.md) (DDH-1..128) and [`domain-driven-hexagon/bf-mapping.md`](domain-driven-hexagon/bf-mapping.md), bound by ADR-025, enforced by `pnpm deps` |

## How a session uses this folder

**Always loaded** (no action needed): `CLAUDE.md` imports `AGENTS.md`; the path-scoped files
under `.claude/rules/` load the hard rules when a session edits backend code, contracts, specs or
docs. Those files are deliberately short; this folder is where the depth is.

**Load by task** - read the row that matches what you are about to do, before you start:

| You are about to...                                                                 | Read first                                                                                                                                            | Then                                                                                                                                          |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| plan or implement a backend feature                                                 | `domain-driven-hexagon/bf-mapping.md` sections 2-7                                                                                                    | the capability spec; `rules.md` for the reasoning behind any rule you are tempted to bend; the vendored `src/` for how the reference wrote it |
| review a backend diff                                                               | `bf-mapping.md` section 10 (the checklist)                                                                                                            | `rules.md` DDH-115 (what the cruiser forbids); run `bf-architecture-review`                                                                   |
| write or change a spec, a record, the backlog                                       | [`SPEC.md`](../../SPEC.md) R4-R15, `vendor/repository-standards-core/method/taxonomy.md`                                                              | `.../method/working-with-specs.md`, `.../method/checklist.md` (the forks), the skill that owns the step                                       |
| decide something contestable                                                        | `.../method/taxonomy.md` (is it a record or a rule?), `.../method/checklist.md`                                                                       | `adr-write` / `bdr-write`; the standard's own ADRs in `vendor/repository-standards-core/decision-records/` as the model of a good record      |
| ingest meeting notes, mails, a long request                                         | `.../method/discovery.md`                                                                                                                             | `discovery-digest`                                                                                                                            |
| run a brownfield wave or an update of the standard                                  | `.../method/adoption.md`, `.../method/repo-assessment.md`, `.../method/self-verify.md`, `vendor/repository-standards-core/skills/align-to-standards/` | `docs/adoption-intake.md`, `docs/adoption-assessment.md`, `docs/adoption-provenance.md`, `docs/backlog.md` (the alignment scope)              |
| drive an agent well (context, verification, review, blast radius)                   | `.../method/working-with-ai/README.md` and its nine notes                                                                                             | `digests/D9-standard-external-refs.md` for the evidence behind them                                                                           |
| compare this stack with the standard's Node picks                                   | `repository-standards/node-stack-vs-bf.md`                                                                                                            | `vendor/repository-standards-node/DECISIONS.md`, `digests/D4-node-stack.md`                                                                   |
| understand why a DDD rule exists, or what an article the README cites actually says | `rules.md` (the rule), then `digests/D5..D8-ddh-links-*.md` (the cited article, digested)                                                             | `vendor/domain-driven-hexagon/README.md` (verbatim)                                                                                           |

**Binding order on conflict** (the altitude in `AGENTS.md`): `docs/PRINCIPLES.md` -> accepted
ADR/BDR -> specs + `docs/ARCHITECTURE.md` -> conventions (`AGENTS.md`, `.claude/rules/`,
`bf-mapping.md`) -> code. Within this folder: the vendored originals are the authority on what a
standard _says_; the authored files (`rules.md`, `bf-mapping.md`, `node-stack-vs-bf.md`) are the
authority on what _this repository_ does with it; the digests are a faithful reading aid and
never add a rule of their own. The living standard at `main` of `repository-standards/core` wins
over the vendored snapshot where they differ (standard ADR-025) - `update-to-latest` refreshes
the snapshot.

## Contents

```
README.md                      this index
sources.md                     provenance: URL, commit, licence of every vendored source
domain-driven-hexagon/
  rules.md                     every README recommendation as a numbered rule (DDH-1..128), with the reasoning
  bf-mapping.md                the binding form for this stack: layout, dependency rules, building blocks, events, tRPC routers, Drizzle, tests, review checklist
repository-standards/
  node-stack-vs-bf.md          the Node stack's picks (Layer 2) compared with this repo's, pick by pick
digests/                       fact-preserving digests written from the sources (no opinions added)
  D1-core-adrs.md                       the standard's 62 decision records
  D2a-core-docs-questions-cases.md      product docs, FAQ, case studies, ideas, open questions
  D2b-core-product-validation.md        PRODUCT, backlog, contributing, attributions, changelog history, validation runs
  D3-core-tree-manifest-scripts.md      every shipped path, the manifest schema, what each guard script checks
  D4-node-stack.md                      the Node/TypeScript stack repository
  D5..D8-ddh-links-*.md                 the 202 external pages the Domain-Driven Hexagon README cites
  D9-standard-external-refs.md          the formats, practices and AI-practice sources the standard cites
vendor/                        verbatim copies (see sources.md); never edited
  repository-standards-core/   method manual, decision records, product docs, case studies, open questions, ideas, transition skills, the pristine shipped tree
  repository-standards-node/   the Node stack: README, DECISIONS, ADAPTING, SHIPPED, specs, starter configs
  domain-driven-hexagon/       README, licence, configs, src/, tests/, database/, docker/, assets
```

## Why this shape

- **Verbatim first, digest second, rule third.** A paraphrase drifts; a copy cannot. The
  owner's requirement was that no fact, recommendation or line of reasoning from the sources be
  lost, so the sources are copied whole and the authored layer only _selects and binds_.
- **One home per rule.** A rule that binds this repo is stated once - in `AGENTS.md`, a
  `.claude/rules/` file or `bf-mapping.md` - and everything else links to it (R4).
- **Loaded just in time.** Always-on instruction files stay short (the standard's note
  "instructions that survive"); the depth here is read when the task needs it, which is why
  every row above names a file rather than saying "read the docs".
- **Refreshable.** `sources.md` records the commits; `update-to-latest` (standard) and a
  re-vendoring of the two other sources are the only way this folder changes.
