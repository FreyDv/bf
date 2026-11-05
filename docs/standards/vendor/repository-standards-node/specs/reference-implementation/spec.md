# Reference implementation

**Spec tier:** behavioral
**Serves:** `Greenfield starter`, `Reader deciding`, `Stack maintainer`
**Success metric:** the weekly boot run is green, and its last green run is recent enough
that "it works" is a result rather than a claim.
**Status:** in-refinement

<!-- Tier justification (R9): the deliverable is a whole application, and its own three test
     tiers plus the boot workflow are the acceptance criteria a buildable spec would restate.
     Restating them here would create a second source of truth that rots against the first.
     What this spec owns is why the tree exists and what it must keep proving. -->

## Purpose

Turn the picks from an argument into a running thing, so that every claim in
[stack-decisions](../stack-decisions/spec.md) has a working demonstration a reader can boot
rather than a description they must believe.

## Scope

[`starter/`](../../starter) - a pnpm workspace holding `apps/web` (Next.js), `apps/api`
(Fastify) and `packages/auth`, behind one proxy, with sign-up reaching a dashboard; three
test tiers (unit and integration under Vitest, end to end under Playwright); real
dependencies in Docker rather than mocks; and a local Lighthouse perf budget.

The boot workflow [`.github/workflows/starter-boot.yml`](../../.github/workflows/starter-boot.yml)
is in scope because it is what makes the tree evidence: a weekly heartbeat plus a run on
every change, exercising the supply-chain policy, the integration tier against the real test
stack, and the marquee journey end to end.

## Out of scope

- **Being a template to copy.** Copying the tree is how a repository ends up carrying
  decisions nobody made for it. Reading it is invited; adopting it goes through
  [adoption-path](../adoption-path/spec.md).
- **A Dockerfile or a deploy target.** Deliberately absent: a starter that faked one would
  boot on nothing. The shape ships - standalone output, plain node process, stdout logging,
  env-only config - and the target is a decision the adopter records.
- **A datastore or query layer.** Same reasoning, recorded in the picks.

## Core concepts

- **The marquee journey** - sign-up through to a dashboard. It is the one path that must work
  end to end for the tree to count as booting.
- **The heartbeat** - the scheduled weekly run. A reference implementation that only builds
  when someone touches it is a claim with no pulse, and the core's stack policy makes a live
  boot CI a condition of staying listed.
- **Real dependencies** - the integration tier runs against a Docker test stack rather than
  mocks, because a mock proves the mock.

## Behaviour

- The marquee journey passes on every change and on the weekly schedule. A red heartbeat is a
  claim this repository can no longer make, not a flaky test to re-run.
- A pick that changes in [`DECISIONS.md`](../../DECISIONS.md) changes here in the same change,
  or the two disagree and the argument stops being evidence.
- The supply-chain policy is exercised rather than declared - the run checks that the cooldown
  and the exact-save survived, not merely that the file exists.
- The tree stays small enough that a framework major is a contained change. Growth that makes
  the reference implementation expensive to keep green is the failure mode, not a milestone.

## Open questions

- What the repository does when the heartbeat is red for a sustained period. The core's stack
  policy names delisting as the consequence, but the threshold and who acts on it are not
  written down anywhere in this repository.

## Not doing

- Multiple reference implementations per adoption mode. Backend-only and friends are
  subtractive adoption modes over this one tree, never sibling trees.
