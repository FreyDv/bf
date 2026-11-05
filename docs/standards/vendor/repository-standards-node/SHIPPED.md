# What ships, and what to do with it

An adopting repository receives these paths. The reference copy of each lives in
[`starter/`](starter/README.md), and the per-entry migration notes - what to do when you
already have your own - are in [adapting](ADAPTING.md).

Two words carry the meaning in the last column. **Copy as-is** means the file is the
decision; changing it is deviating, and deviating is fine if you record it. **Merge into
yours** means the substance is a block inside the file, not the whole file: your globs,
your job names, your paths stay yours.

**Required** means the verifier counts its absence as drift - not that you must take it
today. A repository part-way through one of the migrations in [adapting](ADAPTING.md)
records the entry as an exception naming the step it is on, and deletes the exception when
the step lands; that is the migration's visible state, not a way around the check.

| Path | What it is | How to take it |
|---|---|---|
| `.nvmrc` | the Node version pin - one runtime, no drift between machines | copy as-is &middot; required |
| `biome.json` | lint + format, one tool - the reference copy encodes the strictness the picks assume | merge into yours &middot; required |
| `tsconfig.base.json` | strict TypeScript base every package extends | merge into yours &middot; required |
| `pnpm-workspace.yaml` | workspace globs + the supply-chain policy (release-age cooldown, allowed build scripts, save-exact) - the policy block is the point | merge into yours &middot; required |
| `vitest.config.ts` | unit and integration tiers as separate Vitest projects - a workspace may configure them per package instead | merge into yours &middot; optional |
| `playwright.config.ts` | the e2e tier - real browser journeys against the running app | merge into yours &middot; optional |
| `docker-compose.test.yml` | ephemeral real dependencies for integration/e2e - not mocks | copy as-is &middot; optional |
| `perf/` | local Lighthouse perf-budget runner - report-only, committed baseline + dated history, no external upload; edit config.mjs routes | copy as-is &middot; optional |
| `scripts/perf-budget.sh` | local perf env prep (seed/build/start) - copy, then adapt its SEED/BUILD/START hooks to your stack | copy as-is &middot; optional |
| `renovate.json` | dependency updates as reviewed diffs, riding the same 7-day cooldown | merge into yours &middot; optional |
| `.github/workflows/ci.yml` | hardened least-privilege CI template | merge into yours &middot; optional |
| `.github/workflows/e2e.yml` | the e2e tier in CI, against the docker test stack | merge into yours &middot; optional |

## What gets checked

The same engine that verifies the standard verifies this layer, and reports one drift
number across both. These are what it runs here:

| Runs | Proves |
|---|---|
| `pnpm check:all` | format + types + lint green - the stack's own quality gate counted in the same drift number |
| the manifest's `requiredKeys` on `pnpm-workspace.yaml` | the supply-chain policy block (release-age cooldown, save-exact, no unreviewed lifecycle scripts) survived the merge, not just the file - the engine reads the three keys directly, no pnpm on PATH required |

Only `check:all` needs pnpm on PATH, and needs more than that to pass rather than fail
opaquely: this repo's dependencies already installed (`pnpm install` - the full tree, no
partial shortcut, network required at least once). It is a real toolchain run - format,
types, lint against the actual code - not something a config-file read could substitute
for, unlike the guard above it. Without pnpm on PATH the guard now says so explicitly
("pnpm not on PATH...") rather than failing with a bare shell `command not found` that
reads identically to a real lint failure in the drift report. Layer 1's own prerequisites
page (`docs/method/prerequisites.md` in the core repo) lists what every guard needs
generically (Node, git, bash, jq); this is this stack's addition to that same table, and
nothing here names it yet.

## What is not here

No Dockerfile and no deploy target. That is the least portable decision a repository makes,
and a starter that faked one would boot on nothing. The shape ships instead - standalone
output, plain node process, stdout logging, env-only config - and the target is a decision
you record. [The decisions](DECISIONS.md) says what that record has to cover.
