---
name: ddd-plan-module
description: Use when backend work needs a new module or a new domain concept - "add X to the backend", "we need to model X", "plan the X feature", "design the X service" - or whenever you are about to plan any backend code. Produces the module classification and the Architecture conformance section of the plan from the binding rules (.claude/rules/architecture-rules.md, ai-protocol.md), refusing to plan against a spec with open markers or a rule conflict. Run it before spec-plan for backend work.
---

# ddd-plan-module

Binding source: `.claude/rules/architecture-rules.md` (rule IDs) and `.claude/rules/ai-protocol.md`
(AIP-1..6). Both are already loaded; re-read the groups you use. Rationale for any rule:
`docs/standards/domain-driven-hexagon/rationale.md`.

1. **Gate.** The capability spec exists and has no open `[NEEDS ...]` markers (R12). The stack ADR
   exists and the boundary-check tool is wired in CI (ENF-1). If either is missing, stop (AIP-4) and say
   which; the backlog row is `STACK-1` / `ENF-1`.
2. **Name and classify.** Name the module after a concept the business uses (STR-1, STR-9). Classify it
   `domain-rich` or `data-centric` with a reason (PRG-1); write the classification into the spec. If it
   is data-centric, list which rules PRG-2 lets it skip and confirm the spec says so.
3. **Slice.** List the use cases as slices: commands and queries (STR-2, APP-5). One handler and one
   driving adapter per use case and trigger.
4. **Model.** Identify aggregates and their roots, entities, value objects (only where they carry a rule -
   DOM-V2/V3), the invariant each protects, the domain events and their reactions, domain services only
   where logic spans aggregates (DOM-S1), the transaction boundary (APP-11).
5. **Ports.** List only ports with a PRG-3 reason: repository per aggregate root, clock/id source, other
   modules' facades, external systems. Note the adapter that implements each.
6. **Errors.** Per use case, the Result sum type and stable error codes (ERR-1..3).
7. **Contracts.** Request DTO, response whitelist, versioning impact (ADP-3..5). A list query with a filter
   follows `.claude/rules/query-filter-rules.md`.
8. **Tests.** Three levels per slice and the spec criteria each covers (TST-1..2).
9. **Write the plan** with the `## Architecture conformance` block from AIP-2, filled with real names.
   Hand over to `spec-plan` / `spec-tasks`; implementation follows AIP-3.
