# Stack contract

**Spec tier:** buildable
**Serves:** `Adoption agent`, `Stack maintainer`
**Success metric:** an adopting repository's drift number counts this layer's entries in the
same total as the core's, with no second compliance story to run.
**Status:** in-refinement

## Purpose

Publish this stack in the one machine-readable form the core's align and verify machinery
already reads, so that adopting a technology layer costs no new engine, no new vocabulary and
no second drift number.

## Scope

[`stack.manifest.json`](../../stack.manifest.json) - the technology name, the registry
back-pointer, and the file and guard entries the engine classifies a repository against.
[`SHIPPED.md`](../../SHIPPED.md) - what those entries mean for a repository that adopts them,
and what each check actually needs to run.

## Out of scope

- **The registry itself.** `stacks.json` lives in the core repository and is what makes a
  stack official; this repository points at it and cannot list itself.
- **A compatibility range.** The link to the core is a pointer, never a version range - the
  standard is living and latest is the only target.

## Core concepts

- **Same schema, second file** - the stack manifest uses the core manifest's schema plus
  `technology`. The engine reads both files and merges them, which is why there is one drift
  number rather than two reports.
- **`requiredKeys`** - what a `merge`-class entry must still contain after an adopter merges
  it into their own file. Presence is worthless for an entry whose whole point is a block
  inside a file the adopter also edits.
- **Provenance is per layer** - the adopter's copy of this manifest records which commit of
  this repository it came from, and the core's manifest records the same for the core. A stack
  is linked by a registry pointer rather than a version range, so the two advance on separate
  clocks and neither commit can be derived from the other.
- **Required is about the check, not the calendar** - an entry marked required counts as drift
  while it is absent, which is what makes a half-finished migration visible; an entry marked
  optional is one the decision behind it can be satisfied without, at a path this schema cannot
  name.
- **The guard** - a live command whose verdict is part of the drift number, as distinct from a
  declarative entry describing layout.

## Data contracts

`stack.manifest.json`, top level:

| Key | Type | Meaning |
|---|---|---|
| `technology` | string | the single technology this stack covers; one stack per technology is policy |
| `version` | string | this stack's own version, independent of the core's |
| `provenanceCommit` | string \| null | the commit of THIS repository an adopter's copy last aligned to; ships `null` and is written into the adopter's copy by the run that applies or updates the layer. What an update's delta is computed from - `version` names the release, this names the tree |
| `registry` | string | back-pointer to the core's `stacks.json`, which is what confers official status |
| `files` | array | entries in the core manifest's file-entry schema (`path`, `adapt`, `required`, `purpose`, and `requiredKeys` where the entry is a merge) |
| `guards` | array | entries in the core manifest's guard schema (`id`, `run`) |

## Interface contracts

There is no HTTP endpoint or callable function here - the interface is a filename the engine
discovers by convention, and a shell command the engine runs. The consumer is
`scripts/self-verify.mjs`, read here as this repository's own copy of the core's engine.

| Consumer | Trigger | Exit / effect |
|---|---|---|
| stack-manifest read | any file matching `^stack(?:\.[A-Za-z0-9][A-Za-z0-9._-]*)?\.manifest\.json$` (`STACK_MANIFEST`), read in filename order | valid JSON: `files`, `sections`, `guards`, `exceptions` are concatenated onto the core manifest's own arrays before checking runs, so the run reports one drift number rather than two. Unparseable: `fail("stack", "<file> is present but unparseable: <message>")` |
| profile resolution | `--profile` flag, else `manifest.profile` (this file's own copy), else `"scale"` | no `profile` key: `warning`, falls back to `scale` - the stricter tier, never the looser one. Unknown value: `warning`, treated as `scale`. `core` or `scale`: `note`, used as the default tier for both layers at once |
| a guard's `run` command (e.g. `stack-check-all`) | executed as a shell command | exit 0 passes; nonzero is drift and cannot be waived by a manifest exception (see Rules). A `requires` entry (`kind: "command"` or `"path"`) whose prerequisite is absent: reported as not run, counted as neither drift nor adoption |
| a `merge`-class entry's `requiredKeys` | checked once the entry's path is confirmed to exist | a named key absent from the merged file: drift on that entry, distinct from the file being missing outright |

Errors surface through the same `note` / `warning` / `fail` calls every other manifest entry
uses - there is no separate error channel for the technology layer, which is the mechanism
behind the one-drift-number promise in Success metric above.

## Rules

- A `merge`-class entry whose point is a policy block declares `requiredKeys` naming the keys
  that must survive the merge. Without them the entry checks that a file exists, which for a
  merged file is close to no check at all.
- A guard's failure is drift. It cannot be waived by a manifest exception - waiving a live
  check removes it rather than recording a deviation from it.
- The manifest carries no version range against the core.
- `provenanceCommit` ships `null` and is never a commit of the core repository. A release
  that changes shipped content is what makes a recorded commit stale; nothing in this
  repository rewrites an adopter's copy.
- An entry is `required` only where its absence is itself the deviation. Where a decision can
  be satisfied at a path the schema cannot express - one config per workspace package rather
  than one at the root - the entry is optional, because a required entry there manufactures
  drift for a repository that did nothing wrong, and an exception recording it buries the
  cases that mean something.

## Acceptance criteria

- Given an adopting repository carrying both manifests, when the verifier runs, then it
  reports one drift number covering both layers and names the technology layer explicitly.
- Given a repository that merged `pnpm-workspace.yaml` but dropped the supply-chain policy
  block, when the verifier runs, then the entry fails on its `requiredKeys` rather than
  passing on the file's existence.
- Given a manifest exception targeting a guard, when the verifier runs, then the exception is
  rejected as drift rather than silently honoured.
- Given an adopting repository whose copy of this manifest records a `provenanceCommit`, when
  the next update of this layer runs, then the delta is computed from that commit and every
  entry is enumerated, rather than from the version string with the `merge` entries unlisted.
- Given a workspace that configures the test tiers in each package and carries no root
  `vitest.config.ts`, when the verifier runs, then that entry is reported as an unmet optional
  rather than as drift, and the repository records no exception for it.

## Open questions

- **This repository cannot satisfy its own stack manifest, and that is not yet decided
  either way.** The entries describe a repository that *consumes* the stack - `biome.json`,
  `tsconfig.base.json` and `pnpm-workspace.yaml` at the repository root - while this
  repository *publishes* it and ships those files inside
  [`starter/`](../../starter). Measured: with both manifests present, the three entries fail
  and the `stack-check-all` guard fails with `ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND`, because
  the guard runs `pnpm check:all` at a root that has no `package.json`. The manifest schema
  has no notion of publisher versus consumer, and the guard cannot be excepted by design. The
  options are recorded in the backlog rather than guessed at here.
