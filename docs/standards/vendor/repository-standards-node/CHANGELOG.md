# Changelog

Notable changes to this stack. Semver: MAJOR = a pick removed or reversed, MINOR = a new pick
or a new shipped entry, PATCH = fixes and clarifications.

This file starts at the alignment to Layer 1. Everything before it is in the git history: the
repository shipped nine versions, 0.1.0 through 0.3.1, with no changelog at any of them, and
then took five more commits without a bump. Reconstructing those headings now would be a
guess dressed as a record - the unversioned range is `be3eae3..5afd40d`, 25 commits, and
splitting them across nine headings after the fact is exactly the fabrication this file
exists to make unnecessary.

## Unreleased

### An adopter's copy of this manifest says which tree it came from (2026-09-04)

`stack.manifest.json` gains `provenanceCommit`, shipping `null`, written into the adopting
repository's copy by the run that applies or updates this layer. The core's manifest has
carried the equivalent since standard ADR-052, and the difference showed the first time a real
repository updated: the core half of the delta is an exact diff between two commits, while the
stack half had a version string and nothing else to compare. Most entries here are `merge`
class and carry no hash, so that half was not merely coarse - it was unenumerated, and a
release's additions could go unapplied with the drift number still reading zero. The two
layers advance on separate clocks, so the field records a commit of this repository and never
one of the core's.

`vitest.config.ts` becomes optional. The requirement behind it is the tier split, not the
path: a workspace whose packages each configure the tiers satisfies DECISIONS#9 where the
tests actually run, and a root projects config on top of those runs every suite twice. Marked
required, the entry manufactured drift for a repository that had done nothing wrong, and the
exception recording it sat beside the exceptions that mean something. What the schema cannot
yet say - this path, or one per workspace package - is the core's to fix, and it is filed as
SELF-11 rather than papered over here.

One consequence lands in this repository's own adoption: it carried a `kind: file` exception
for `vitest.config.ts`, waiving an entry that can no longer fail. A stale exception is the
thing this change is against, so it is deleted, and the `stack-contract` spec's open question
now says three entries rather than four - a measured claim, kept measured.

`biome.json` deliberately stays required. The adaptation path prescribes a two-step Biome
migration, so a repository following it correctly has no `biome.json` between the steps -
which is a real, unfinished deviation from DECISIONS#3 and should read as one. `ADAPTING.md`
now gives the exception to record, with the migration step in its reason, and says it comes
out when step 2 lands. That is the difference between the two entries: one is a decision
satisfied elsewhere, the other is a decision not yet taken.

### The stack layer became an adopter of the standard it belongs to (2026-08-06)

This repository carried a `stack.manifest.json` and nothing else the core standard asks for.
The core's own decision on satellite stacks names this repository as the standard's first
genuinely aligned adopter once it pins a version, and until now it had not.

It now carries the pin, the manifest copy, the shipped guards and skills, an agent entry
point, a persona roster, four capability specs with the map that couples them to what they
describe, a work ledger and a decision log.

Three numbers, all measured rather than estimated. Against the verifier's built-in skeleton -
the fallback for a repository with no manifest - this repository read `drift 5 - 0% adopted
(0/5)`, and the verifier said in the same breath that the number is not the real distance.
With the manifest in place the real number was `drift 18 - 71% adopted (44/62)`: more than
three times the skeleton's count, which is the point of the warning the skeleton prints. It
now reads `drift 5 - 92% adopted (55/60)`, and every one of those five is a Layer 2 entry
described below. Not one core entry is unmet.

**What this alignment cannot reach, and why that is written down rather than worked around.**
Four of the remaining entries and one guard belong to this repository's own stack manifest,
and they describe a repository that *consumes* this stack - `biome.json`,
`tsconfig.base.json`, `pnpm-workspace.yaml` and `vitest.config.ts` at the repository root.
This repository *publishes* the stack and ships those files inside `starter/`, which is where
they belong. The `stack-check-all` guard runs `pnpm check:all` at a root that has no
`package.json` and fails with `ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND`. The manifest schema has
no word for publisher versus consumer, and a guard cannot be waived by a manifest exception
by design - so there is no configuration of the shipped mechanism under which this repository
reaches an honest drift 0. The four options are in [`backlog.md`](backlog.md) and none was
chosen here; picking one silently would be the kind of quiet redefinition the standard exists
to prevent.

A second finding fell out of the same run: the verifier merges a stack manifest only when a
core manifest is already present. Before this change, this repository's twelve stack file
entries and its guard were read by nothing at all, while the published claim is one drift
number across both layers.

### Updated to the standard at 1.0.6, and a missing tool no longer reads as broken code (2026-09-03)

This repository's copy had sat pinned to core's tree since commit `cef91d6`, unmoved through a
month of the core's own commits. The delta between that commit and 1.0.6 (`308309a`) landed
here: renamed skills (`cycle-open`/`cycle-close` became `sprint-open`/`sprint-close`,
`docs/cycles/` became `docs/sprints/`), the elicitation layer (`.claude/elicitation/points.json`,
the `elicitation-guard.mjs` hook, `docs/adoption-provenance.md`), the removal of
`update-to-version` in favor of `update-to-latest`, the dashboard generator, the backlog
archive and its guard, and the `.claude/settings.json` that wires this repository's own hooks
in for the first time - they existed on disk before this change but nothing invoked them.

`SELF-7` is done: the core shipped the `requires` field this stack's guard was blocked on, so
`stack-check-all` now declares its two prerequisites (`pnpm` on `PATH`, `node_modules`
present) and a missing toolchain reads as not-run rather than as the same drift a real lint
failure would produce.

The update surfaced three gaps of its own, all fixed in this same change rather than carried
forward: `SPEC.md` was a stale `copy` entry, still on R1-R25 and missing the rules and
embargo language core added since; `specs/stack-contract/spec.md` was missing the
`## Interface contracts` section the buildable tier requires; and four files that arrived
with the delta (`.github/pull_request_template.md`, `dashboard.yml`, `gitleaks.yml`,
`standards-update-watch.yml`) were unclaimed by `specs/capability-map.json`.

The elicitation ledger's six reached points are recorded in `docs/adoption-provenance.md` -
two confirmed by a human (`adopt.tracker`, and `adopt.intent`: migrate everything applicable,
with the consumer-shaped stack-manifest gap declined by design rather than left unfinished),
four left provisional pending a decision (`adopt.backlog`, `green.stack`, `spec.scope`,
`spec.acceptance` - tracked as `SELF-9`, `SELF-8` and `SELF-10`). `docs/adoption-assessment.md`
and the alignment scope block in `backlog.md` now carry this repository's first real Gate
2/Gate 5 artifacts, rating all eight passes against measured evidence rather than a template -
nine tasks stand between here and full alignment, all recorded with an owner role.

`self-verify.mjs` now reports `drift 4 - 96% adopted (88/92), 0 excepted`, every point of it
tracing to `SELF-1`.

### SELF-1 closed: the four file entries are excepted, not failed (2026-09-03)

`SELF-1`'s premise had two halves: four required files this repository ships from `starter/`
rather than its own root, and the `stack-check-all` guard, which a manifest exception cannot
waive by design. `SELF-7` already closed the second half - a missing toolchain now reads as a
skip, not drift - which left only the first half, and the schema already had a mechanism for
it: `biome.json`, `tsconfig.base.json`, `pnpm-workspace.yaml` and `vitest.config.ts` are now
excepted with `kind: "file"`, each naming the `starter/` path where the real copy lives. The
exceptions live in `standard.manifest.json`, not `stack.manifest.json` - the latter is copied
verbatim into every adopter of the node stack during onboarding, so an exception recorded
there would silently waive the requirement for real consumers too; `standard.manifest.json`
is this repo's own compliance copy and is never redistributed. None of the four options
`SELF-1` weighed were needed. `self-verify` reports `drift 0 - 96% adopted (88/92), 4
excepted - compliant with the standard`.
