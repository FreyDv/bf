---
name: ddd-new-use-case
description: Use when an existing backend module needs one more use case - "add an endpoint", "users should be able to Y", "add a command / query / handler / event reaction". Implements one vertical slice in the binding architecture (domain first, then application, infrastructure, driving adapter, tests) and refuses to start if the module has no classification, the spec has open markers, or a rule would be broken. For a new module run ddd-plan-module first.
---

# ddd-new-use-case

Follow `.claude/rules/architecture-rules.md` and `ai-protocol.md` (already loaded). One slice = one use
case (STR-2, APP-3).

1. **Preconditions.** The use case is in the module's capability spec with acceptance criteria, no open
   markers; the module is classified (PRG-1); the boundary check exists (ENF-1). Otherwise stop (AIP-4).
2. **Command or query?** State-changing -> `commands/<use-case>/`; read-only -> `queries/<use-case>/`
   (APP-5). A query that needs a write is a command.
3. **Domain first.** Add or change the aggregate method / value object / event / error the use case
   needs; keep the invariants inside the objects (DOM-E3); write domain unit tests with no
   infrastructure (TST-2).
4. **Application.** Command or query object (APP-6), handler with orchestration only (APP-1), ports it
   needs (PRG-3), result type with error codes (ERR-2). A reaction on another aggregate is an event
   handler, in the same transaction (APP-11, DOM-EV2); a command never calls a command (APP-9). Test with
   in-memory port doubles.
5. **Infrastructure.** Repository/adapter changes through the existing port; map through the persistence
   model (INF-4, INF-5).
6. **Driving adapter and DTOs.** Request DTO validated at the boundary, response whitelist, error-code to
   transport mapping (ADP-1..4, ERR-4). No business logic.
7. **Behavioural test** from the spec's acceptance criteria through the adapter against a test database
   (TST-1, TST-3).
8. **Finish.** Run the boundary check and the tests; update the spec in the same PR; run `ddd-review`.
