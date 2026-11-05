# Adoption path

**Spec tier:** behavioral
**Serves:** `Adopting repo owner`, `Adoption agent`, `Greenfield starter`
**Success metric:** a repository can follow the path entry by entry without the build going
red between entries.
**Status:** in-refinement

<!-- Tier justification (R9): the deliverable is instructions executed by an agent against a
     repository this repository has never seen. There is no fixed input to hold and no output
     to assert - the same instruction is correct on one repository and wrong on the next. What
     can be asserted is the ordering property, and that is stated under Behaviour. -->

## Purpose

Carry a repository that already exists, and already made different picks, to this stack -
without a big-bang rewrite and without leaving the build broken between steps. This is the
half most standards skip, and skipping it is why most standards describe a destination
nobody reaches.

## Scope

[`ADAPTING.md`](../../ADAPTING.md) - per-entry migration notes, what the agent reads to
classify a repository, the `pnpm import` routes by source package manager, and the app-shell
picks. [`QUICKSTART.md`](../../QUICKSTART.md) - the two entry sentences, greenfield and
brownfield, and what happens after each.

## Out of scope

- **The mechanics of classification and the wave order.** Those are Layer 1's align machinery,
  adopted by reference; this capability supplies the technology-specific notes it consumes.
- **Arguing the picks.** [stack-decisions](../stack-decisions/spec.md) owns the reasoning; a
  reader who does not accept a pick is not helped by a smoother migration to it.

## Core concepts

- **Per-entry, not per-repository** - the path is written against each manifest entry, so a
  repository adopting four entries reads four notes rather than a plan written for somebody
  else's repository.
- **Green between entries** - the ordering constraint. Every entry lands in a state where the
  build still passes, which is what makes the path stoppable partway.
- **Adapt, do not hand over a tree** - the agent reconciles the picks against what the
  repository already runs. Handing over a folder to reconcile is the failure this replaces.

## Behaviour

- Each entry names what the repository probably has now, what this stack ships, and the
  ordered move between them.
- The order never requires a red build as an intermediate state. An entry that cannot be
  landed green says so and names what it must be landed with.
- A pick the repository already satisfies differently is recognised rather than re-imposed;
  the decision to keep it is recorded, not silently accepted.
- The two entry sentences produce the same end state by different routes: greenfield scaffolds
  and brownfield walks.
- Package-manager migration covers the routes a real repository arrives on, and says plainly
  where a route does not exist rather than implying one does.
- The run ends by recording where the copy came from: this repository's commit, written into
  the adopting repository's copy of the stack manifest. A path that is walked but not recorded
  cannot be walked again from where it stopped.
- An entry the repository is part-way to is recorded as an exception naming the step, and the
  note says when the exception comes out. A migration with two steps has a state between them,
  and that state is the exception rather than a silent absence.

## Open questions

- Whether a partial adoption - a repository that takes four entries and declines the rest -
  has a recorded resting state, or whether it reads as an unfinished adoption forever. The
  drift number counts what was taken, but nothing here says a low number can be a finished
  answer.

## Not doing

- A migration codemod. The picks are configuration and conventions rather than API surface;
  a codemod would encode assumptions about a repository this stack cannot see.
