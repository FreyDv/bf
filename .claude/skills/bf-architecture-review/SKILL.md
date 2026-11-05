---
name: bf-architecture-review
description: Use before a pull request that touches a backend service or a shared backend package, or when the user asks "does this follow our architecture", "review the structure", "is this hexagonal enough". Reads the diff against the Domain-Driven Hexagon rules this repository binds (layout, dependency direction, aggregates and invariants, Result-typed errors, contracts, transactions and events, tests) and reports violations with the rule id and the fix. Complements pre-pr-review (which reviews correctness and hygiene); run this one first.
---

# bf-architecture-review

A fresh-context read of the branch's backend diff against
[`docs/standards/domain-driven-hexagon/bf-mapping.md`](../../../docs/standards/domain-driven-hexagon/bf-mapping.md)
section 10 and `.claude/rules/backend-architecture.md`. Do not fix while reading; list, then
fix, then re-run the mechanical checks.

## Procedure

1. `git diff --name-only main...HEAD -- apps packages` - the files in scope. Group by
   service and module.
2. Run the mechanical gates first and report their output verbatim:
   `pnpm --filter <svc> deps`, `pnpm --filter <svc> lint`, `pnpm --filter <svc> typecheck`,
   `pnpm contracts:check`, `node scripts/spec-guard.mjs --audit --block`.
3. For every changed or added file, check in this order and cite the rule:
   - **Placement and suffix** (bf-mapping section 2; DDH-109..114): right folder, right
     suffix, one slice per use case, nothing new in the legacy `identity` module.
   - **Dependency direction** (section 3; DDH-19..22): domain imports; application never
     touches infrastructure or Drizzle; routers never touch persistence; no cross-module
     internals.
   - **Aggregate discipline** (section 4; DDH-24..42, 56, 67..69): `create()` validates and
     raises; intention-revealing methods; no setters; `validate()` present and called by the
     repository; references by id; value objects immutable and serialised at boundaries.
   - **Errors** (section 6; DDH-71..76): `Result` for business failures with coded
     `DomainException` subclasses; throws only for technical failures; the router maps codes.
   - **CQS and events** (sections 5-7; DDH-13..18, 43..52): queries bypass the domain;
     commands do not call commands; events pulled after persistence and published in the same
     transaction; event `type` well-formed.
   - **Contracts** (`.claude/rules/contracts.md`): input + output schemas, generated
     `router.ts` untouched, whitelisted outputs.
   - **Tests** (section 8): the three levels exist for the slice; acceptance criteria match the
     spec; no test edits that weaken an assertion to make a diff pass.
   - **Spec coupling**: the capability spec changed with the code; contracts quoted verbatim.
4. Report: a table `file | rule | finding | fix`, severity `blocker` (a rule in
   `.claude/rules/backend-architecture.md` or a failed gate) or `advice` (a SHOULD in
   `rules.md`). A diff with zero blockers and green gates passes.
5. Fix the blockers, re-run step 2, then hand over to `pre-pr-review`.

## What this is not

Not a correctness or security review (that is `pre-pr-review` and the CI gates); not a style
pass (prettier and ESLint own that); not a place to re-argue a rule - a rule that keeps being
re-litigated gets a superseding ADR, never a silent exception.
