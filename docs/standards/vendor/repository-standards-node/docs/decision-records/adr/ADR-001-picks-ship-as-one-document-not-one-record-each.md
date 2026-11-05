# ADR-001: The technology picks ship as one document, not one decision record each

| | |
| --- | --- |
| **Status** | Accepted (2026-08-06, recorded retroactively - the shape was chosen when `DECISIONS.md` was written) |
| **Date** | 2026-08-06 |
| **Author** | Łukasz Bodurka |
| **Tags** | structure, layer-2, documentation |

## Context

This repository holds two kinds of decision and they are easy to confuse. The **picks** -
pnpm, Turborepo, Biome, Fastify, Next.js, the cooldown, the test tiers, and the axes left
open - are the product. The decisions about **this repository** - how it verifies itself, how
it publishes the stack - are ordinary engineering choices of the kind the core standard says
belong in a decision record.

The picks are recorded as seventeen numbered sections in a single
[`DECISIONS.md`](../../../DECISIONS.md), each naming what it was chosen against and its
escape hatch, behind one summary table. That is not the shape the core standard's decision-log
convention would suggest, and the difference had never been recorded, so it read as an
oversight rather than a choice - which is precisely the condition under which somebody
"corrects" it.

This record was written during the repository's alignment to Layer 1, when the two streams
had to be told apart to author `docs/decision-records/` at all.

## Options considered

- **A - One ADR per pick (seventeen records).** Consistent with the core's convention and
  with how this repository's own decisions are now recorded. Each pick gets a lifecycle, a
  status and supersession machinery. Rejected: the audience for the picks reads to **compare
  against their own conventions**, and comparison needs everything on one surface. Seventeen
  files with a status field each optimises for auditing a decision's history, which is not
  what anybody does with this document. It also makes the summary table - the thing that lets
  a reader triage in a minute and read only where they disagree - a generated artifact of
  seventeen files rather than the document's spine.
- **B - One document, no records at all.** What existed until this alignment. Rejected: it
  leaves this repository's own choices - like this one - with nowhere to live, and it is why
  the distinction was invisible.
- **C - One document for the picks, a decision log for the repository (chosen).**

## Decision

Option **C**. The two streams are separate and the split is by subject, not by importance:

1. **A technology pick is a section of `DECISIONS.md`.** It carries the choice, what it was
   chosen against, and the escape hatch. It has no status field, because a pick is either the
   current pick or it is not in the document.
2. **A decision about this repository is a record under `docs/decision-records/`**, with the
   core's lifecycle and its supersession rules.
3. **The boundary is stated where an agent will hit it** - in
   [`AGENTS.md`](../../../AGENTS.md), as the distinction that trips people: a change to
   Fastify's role goes in the first, a change to how this repository verifies itself goes in
   the second.

## Consequences

- Positive: a reader compares the whole paved road on one page; the picks keep the summary
  table as their spine; this repository's own decisions stop being homeless.
- Negative: two conventions in one repository, which has to be explained rather than
  inferred - hence the explicit paragraph in `AGENTS.md`. A pick that is genuinely contested
  over time has no supersession trail beyond the git history.
- Neutral: the provisional picks already sit in their own trailing section, which is the
  nearest thing to a status field the document has.

## Confirmation

`AGENTS.md` states the boundary, and `specs/stack-decisions/spec.md` scopes the picks to
`DECISIONS.md` while `docs/decision-records/` holds the rest. A pick appearing as an ADR, or
a repository decision appearing as a numbered section of `DECISIONS.md`, contradicts this
record.

## Revisit when

A pick is reversed and the reasoning for the reversal matters more than the current state -
at that point a supersession trail is worth more than the single readable surface, and this
record should be reconsidered rather than worked around.
