# Stack decisions

**Spec tier:** behavioral
**Serves:** `Adopting repo owner`, `Reader deciding`, `Adoption agent`
**Status:** in-refinement
**Success metric:** a reader who disagrees with a pick can find, in that pick alone, what it
was chosen against and the condition under which deviating is correct - without reading any
other section.

<!-- Tier justification (R9): the deliverable is argued prose, not behaviour. There is no
     input to hold fixed and no output to assert, so the buildable sections (data contracts,
     rules, acceptance criteria as tests) would be filled with fiction. What can be checked
     mechanically about this capability is checked in stack-contract, which owns the manifest
     the picks are published through. -->

## Purpose

Make the recurring Node/TypeScript choices once, in public, with the reasoning attached - so
that a repository adopting this stack inherits decisions rather than defaults, and a
repository declining a pick does so knowingly.

## Scope

The picks in [`DECISIONS.md`](../../DECISIONS.md), grouped as the ground floor (package
manager, task runner, lint/format, TypeScript, supply chain), the application (Next.js,
Fastify, the app shell, env config, request validation, logging), proving it works (testing
tiers, CI, dependency updates), and what is deliberately left open (datastore, containers,
monorepo layout).

The document holds **17 numbered sections** and its summary table holds **18 rows**, and the
two are not the same set: section 10 covers three table rows at once (proxy, auth, styling),
and section 17 (monorepo layout) has no row at all. Neither count is wrong, which is exactly
why an unqualified "N picks" anywhere in this repository is a claim that cannot be checked -
see the backlog.

Each pick carries three things and is incomplete without them: the choice, what it was chosen
against, and the escape hatch - the condition that would make a reader right to deviate.

## Out of scope

- **The picks running.** A pick is only shown to work by
  [reference-implementation](../reference-implementation/spec.md); this capability is the
  argument, not the evidence.
- **Getting from an existing repository to these picks.** That path is
  [adoption-path](../adoption-path/spec.md), which is where a pick meets a repository that
  already chose differently.
- **Anything Layer 1 decides.** Method, cadence and repository shape belong to the core
  standard, adopted here by reference.
- **The three axes named as per-repository** - datastore and query layer, deploy target,
  and the parts of monorepo layout below `apps/` and `packages/`. Those are the least
  portable decisions a repository makes; deciding them here would be wrong for most readers
  while sounding authoritative. They ship as a shape and a decision record the adopter writes.

## Core concepts

- **A pick** - one axis, decided, with its alternative and its escape hatch. An axis with no
  named alternative is a preference wearing a decision's clothes.
- **The escape hatch** - the stated condition under which deviating is the correct call. It
  is part of the pick rather than an afterthought: a paved road nobody may leave is a cage.
- **Provisional** - a pick recorded under `Open questions - decided, provisionally`, where
  the choice is made but the confidence is lower and the revisit condition is named.

## Behaviour

- Every pick names what it was chosen against. A pick with no alternative recorded is
  incomplete, not merely terse.
- Every pick names its escape hatch.
- The summary table precedes the detail, so the whole set is readable before any one pick is.
- A pick that changes is a change to this document and to whatever in
  [`starter/`](../../starter) embodies it, in the same change. The two disagreeing is the
  failure this coupling exists to prevent.
- An axis this repository declines to decide is recorded as declined, with the reason, rather
  than omitted. Silence reads as an oversight; a recorded refusal reads as a decision.

## Open questions

- Whether the provisional picks want a distinct status in the summary table rather than only
  in the trailing section, so a reader scanning the table sees the confidence difference.

## Not doing

- Splitting the picks into one decision record per axis. They were deliberately written as a
  single readable document with a summary table, because the audience reads to compare
  against their own conventions rather than to audit a decision history.
