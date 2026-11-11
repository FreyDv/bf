# Adapting a brownfield repo to this stack

## Start it

You do not walk this table yourself. Say it to your coding agent:

```
> take this repo onto repositorystandards.com with the node stack
```

It measures the repository first - what is here, what technology, how much you want done -
and comes back with a plan naming who has to act on each item. Nothing is touched before
you have seen it.

Want the plan without the work?

```
> score this repo against repositorystandards.com with the node stack - count the work, do not do it
```

## What the agent is reading

This table. Each note answers one question: the repository already has something in this
spot - how do we get from theirs to ours without breaking the build? The reasoning behind
every pick is in [the decisions](DECISIONS.md); this file is only the how, per entry, and
it is here for you as much as for the agent - a plan you cannot check is a plan you have to
take on trust.

Two things worth knowing before you read it. **Nothing here is all-or-nothing**: an entry
that does not fit gets an exception recorded rather than forced, and the drift number counts
what you took, not what you skipped. And the order matters more than the speed - every note
is written as a move that leaves the build green, because a migration that goes red in the
middle is a migration that gets reverted.

**Where to record the exception:** in this stack's own `stack.manifest.json`, in its
`exceptions` array - the file this table talks about. `self-verify.mjs` (core repo) merges
this stack's `files`/`sections`/`guards` and `exceptions` into the check it runs, so an
entry recorded here is honoured exactly like a core-manifest one:

```json
{ "kind": "file", "match": "pnpm-workspace.yaml", "reason": "npm workspace kept - no cooldown equivalent, see ADAPTING.md" }
```

`kind` is `"file"`, `"section"`, `"content"`, or `"key"`; `match` is the path exactly as
this stack's own entry above spells it (`file#heading` for a section, `file#key.path` for
a declared key). A guard script itself cannot be excepted by presence - that would delete
the check rather than waive it; a `kind: "content"` exception on a guard is allowed, since
the guard still runs and must pass.

**Where your copy came from:** when the run finishes, write this repository's commit SHA
into your `stack.manifest.json` as `provenanceCommit`. `version` says which release you took;
the commit says which tree, and that is what the next update diffs against. Without it the
stack half of an update has nothing to compare but a version string, and every `merge` entry
- which is most of them - goes unenumerated. The core manifest carries the same field for its
own layer and the two move independently: updating one stack never implies the core or
another stack.

| Entry | The repo probably has | The move |
|---|---|---|
| `biome.json` | ESLint + Prettier | Two-step, never big-bang: install Biome alongside, port rule intents (`biome migrate eslint --write` gets most), run both until the diff stabilizes, then remove ESLint/Prettier in their own PR. Keep Prettier only if SCSS stays (Biome does not format SCSS - that is the pick's own escape hatch). The entry is required and the migration is deliberately not: while you are between the two steps you have no `biome.json`, so record the exception with the step in its reason - `"reason": "ESLint + Prettier; Biome migration step 1 of 2, see ADAPTING.md"` - and delete it when step 2 lands. The exception is how the unfinished migration stays visible; making the entry optional would hide it. |
| `pnpm-workspace.yaml` | npm, yarn, bun, or Deno, maybe no workspace | `pnpm import` converts the existing lockfile where that source tool is actually supported - see the by-source-tool breakdown below, it is not all four. Workspaces map 1:1. The policy block (release-age cooldown, allowed build scripts) is the point of the entry - merge it even if the workspace globs differ. Without a migration path, or without migration appetite: record the exception (see above); the cooldown has no equivalent outside pnpm's own config, name that trade-off. |
| `tsconfig.base.json` | a looser tsconfig | Stage strictness: `strict` first, then `noUncheckedIndexedAccess` and friends one flag per PR - each flag surfaces real findings; a hundred errors at once teaches nothing. Extend, do not replace: their paths/aliases stay theirs. |
| `vitest.config.ts` | Jest, or tests mixed in one pile | Vitest reads most Jest suites as-is (`vitest run` first, fix the stragglers). The entry's real content is the tier split - unit vs integration as separate projects; introduce the naming convention (`*.test.ts` / `*.integration.test.ts`) before touching any test body. A workspace whose packages each carry a config already has the tiers where they run - configure them there and leave the root without the file, rather than adding a projects config that runs every suite a second time. That is why this entry is optional: for that shape the root file is wrong, not missing. |
| `playwright.config.ts` | Cypress, or nothing | Nothing: start with the starter's two journeys (auth, home) adapted to their routes. Cypress: do not port wholesale - write the 3-5 journeys that matter in Playwright, retire Cypress when they cover the old suite's intent. |
| `docker-compose.test.yml` | mocks, or a shared dev database | The move is philosophical (DECISIONS: real dependencies, not mocks) - land it with the integration tier, non-default ports so it never collides with their dev stack. |
| `perf/` + `scripts/perf-budget.sh` | nothing, or another perf tool | Run it once against the built app before changing a number: the first run writes the baseline, and a baseline nobody argued about is worth more than a target somebody guessed. It is deliberately not a CI gate - a budget that blocks a merge on day one gets disabled by the end of the week. Adapt the script's seed/build/start hooks to their stack, keep the committed history so a regression is a diff rather than an opinion. If a perf tool already exists, keep one, not both. |
| `.github/workflows/*` | existing CI | Merge jobs into their workflow, never replace it: the hardened permissions block and the cooldown-respecting install are the substance; their job names and triggers stay theirs. |
| `renovate.json` | Dependabot, or nothing | Keep Dependabot if the org already lives in it - the substance is the 7-day cooldown and the grouped minor/patch, both expressible there. On nothing: start with the grouping only, add the cooldown once somebody has seen a week of PRs; turning both on at once produces a wall nobody triages. |
| `.github/workflows/ci.yml` | an existing pipeline | Merge jobs into theirs, never replace it. The substance is the hardened permissions block and the cooldown-respecting install; their job names, triggers and matrix stay theirs. A replaced pipeline is a pipeline the team stops recognising, and they will fork it back within a month. |
| `.github/workflows/e2e.yml` | nothing, or e2e mixed into the main pipeline | Land it as its own workflow even if their e2e currently rides the fast gate: this tier boots a Docker stack and the app, so mixing it in makes every commit pay for a check most commits do not need. It is the one you gate a release on. |
| `.nvmrc` | none, or an older pin | Copy; if their runtime is older, the Node major bump is its own migration - route it through the modernize pass in the core's adoption guide, not through this phase. |

## `pnpm import`, by source package manager

The row above says `pnpm import` "converts the existing lockfile" as if that holds for
whatever the repo showed up with. It does not. Tested this week against two real
brownfield repos, both against this stack's pinned pnpm (11.1.2 - if a different `pnpm`
is the one actually on PATH, that mismatch is the first thing to check, see the yarn row):

| From | Command | What actually happens |
|---|---|---|
| npm (`package-lock.json`) | `pnpm import` | works - documented, supported input. |
| yarn classic (`yarn.lock` v1) | `pnpm import` | works - documented, supported input. |
| yarn Berry / yarn 4 (`yarn.lock` v2+) | drop `packageManager: "yarn@..."` from `package.json` first, then `pnpm import` | pnpm refuses to run at all ("This project is configured to use yarn") while that field still names yarn - dropping it is the adoption anyway, not a workaround. Once dropped, the dependency graph itself imports fine. Two real gaps, not blockers: a yarn `resolutions` override is silently dropped - `pnpm import` never reads that field, so re-create anything load-bearing as `pnpm.overrides` by hand and verify the pinned version still resolves. Older pnpm (7.x) crashed on a nested-path override selector (`pkg/**/pkg`, `ERR_PNPM_INVALID_OVERRIDE_SELECTOR`) migrating such an override; retested against 11.1.2 here and it no longer reproduces - if it still happens, the `pnpm` actually running is not the one this stack pins. |
| bun (`bun.lock` / `bun.lockb`) | no importer path - `pnpm import --help` lists only `package-lock.json` / `npm-shrinkwrap.json` / `yarn.lock` | fails immediately, `ERR_PNPM_LOCKFILE_NOT_FOUND` (reproduced). The real move: delete `bun.lock`/`bun.lockb`, run a fresh `pnpm install`. Every dependency re-resolves to whatever `package.json` allows rather than what bun had pinned - if the ranges there are not already exact (common outside this stack's `saveExact` policy, DECISIONS#8), diff the deleted `bun.lock` against the new `pnpm-lock.yaml` before merging and hand-repin anything that moved. |
| Deno (`deno.lock`) | no importer path, same supported-input list as bun | same real move as bun: delete `deno.lock`, fresh `pnpm install`, hand-repin from the deleted lockfile. Not tested against a live Deno repo this round (the two repos tested were bun and yarn) - treat this row as the same failure mode by inspection of `pnpm import`'s supported-input list, not as independently verified. |

## The app shell - picks, not table rows

The manifest's config entries migrate via the table above. The app-shell picks
(DECISIONS #10 - auth, proxy, styling) and the deferred forks (#15, #16) are
architecture moves, not config merges: an existing auth system, Express/Koa API or
Tailwind setup is not "drifted config", it is a standing decision. Record the repo's
own superseding ADR (the core standard's deviation mechanism) or plan a real migration
with its own ADR. The three hard cases:

**Existing auth vs Better Auth.** Migrating means a session-store migration, a
password-hash migration and a cutover window - none of it incidental. The superseding
ADR is usually the honest first move: record why the incumbent stays, revisit when the
product forces it.

**Existing Express/Koa vs Fastify.** The shape transfers even when the framework
stays - plugins/hooks and the default-deny session gate map onto their middleware
chain. Adopt the boundary pattern (one error contract, default-deny, config validated
at boot), defer the rewrite.

**Existing styling vs CSS Modules + tokens.** Tokens first - they are stack-agnostic
and pay off regardless of the component layer; the component migration to CSS Modules
follows the repo's own tempo.
