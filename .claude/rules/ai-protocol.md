# AI protocol - how every session plans, implements and reviews backend code

Loaded in every session, together with `architecture-rules.md` (rule IDs below refer to it). These steps
are not advice: each one has a stop condition, and the last one has a machine check (ENF-1).

## When this applies

Any session that plans, specifies, writes, changes, reviews or explains backend code: a new module, a new
use case, a change to a domain object, a repository, an adapter, an event, an error type, a test. If the
request is only about documents or process, skip to the relevant skill.

## AIP-1 Read before you plan

Before the first line of a plan: read `architecture-rules.md` in full (it is loaded - do not rely on
memory of it), the capability spec of the module, and the module's classification (PRG-1). If any of
them is missing, say so and create it first (`spec-specify`, then `ddd-plan-module`). If the request
conflicts with a rule, **stop**: name the rule ID, show the conflict, propose the ADR that would permit
the deviation, and wait. Never deviate silently, never "just this once", never because it is faster.

## AIP-2 The plan carries an Architecture conformance section

Every plan (spec-plan output, an ad-hoc plan, a pull-request description of a design) MUST contain this
section, filled with the actual names - not a restatement of the rules:

```
## Architecture conformance
- Module: <name in the ubiquitous language> - classification: domain-rich | data-centric (PRG-1) - why
- Slices: <commands/...>, <queries/...> (STR-2)
- Files by layer, each with its suffix and path (STR-6, STR-7): domain / application / infrastructure /
  interface adapters / dtos
- Aggregates, entities, value objects and the invariant each protects (DOM-E3, DOM-V2)
- Domain events raised and who reacts; transaction boundary (DOM-EV1, APP-11)
- Ports introduced and the PRG-3 reason for each; adapters that implement them
- Error codes and the Result sum type per use case (ERR-1..4)
- DTOs: request, response whitelist (ADP-3, ADP-4)
- List queries with a filter: filter spec, read port, relations and the module owning each, enums in contracts (QRY)
- Tests: domain unit, use case with doubles, behavioural from the spec's acceptance criteria (TST-1..2)
- Boundary check: tool, config location, status (ENF-1)
- Rule IDs deliberately not applied and the ADR that permits it: none | <IDs + ADR>
```

A plan without this section is incomplete and MUST NOT be implemented.

## AIP-3 Implementation order

Inside-out, one slice at a time, tests first where they can be:
1. domain: aggregate, value objects, events, errors - with unit tests (no infrastructure);
2. application: ports, command/query, handler - with use-case tests using in-memory port doubles;
3. infrastructure: persistence model, mapper, repository and other adapters;
4. interface adapters: request/response DTOs, driving adapter(s);
5. behavioural tests from the spec's acceptance criteria;
6. run the boundary check and the whole test suite.
Commit per concern. Do not start a slice before the previous layer compiles and its tests are green.

## AIP-4 Stop and ask

Stop and ask the owner (do not improvise) when: a rule would be violated; the design needs a pattern the
rules do not cover; a module would be classified `data-centric` without a recorded reason; the boundary
check does not exist yet (ENF-1); the spec has open `[NEEDS ...]` markers; a rule is ambiguous for this
case. State the options and your recommendation; the owner's answer becomes an ADR when it is a deviation.

## AIP-5 Definition of done

Done means all of: the boundary check and tests pass (run, not assumed); the review checklist below has
been walked on the diff; the capability spec moved in the same pull request (R11); anything noticed and
not fixed is in the backlog. Say what was not verified instead of claiming it.

## AIP-6 Review checklist (the `ddd-review` skill runs it)

1. Placement: every new file is in the canonical layout with the right suffix (STR-6, STR-7); no layered
   top-level folders (STR-3); no module per entity (STR-8).
2. Direction: no import against DEP-2; domain free of frameworks and I/O (DEP-3); modules touch only
   public facades, ports or messages (DEP-5); no cycles, no slice-to-slice imports (DEP-8, DEP-9).
3. Application: only orchestration (APP-1); commands return no business data (APP-7); no command calls a
   command (APP-9); queries change nothing (APP-10); one transaction where events cross aggregates
   (APP-11); every port justified (PRG-3).
4. Domain: invariants enforced in the objects (DOM-E3); no public setters; aggregates referenced by id
   (DOM-A4); value objects immutable and serialised at boundaries (DOM-V1, DOM-V4); events pulled after
   persist (DOM-EV1).
5. Errors: business failures are typed results with stable codes; technical failures throw; no transport
   types below the driving adapter (ERR-1..4).
6. Adapters: no business logic (ADP-1); whitelisted responses (ADP-4); DTOs without domain objects
   (ADP-3); repository maps to a separate persistence model (INF-4, INF-5).
7. Tests: three levels, spec criteria covered, doubles for ports, no weakened assertions (TST-1..5).
8. Enforcement: the boundary check passes and its configuration was not loosened (ENF-1).
9. Query filters: declared with `defineFilter`, read through a port, relations as `EXISTS` with an indexed
   foreign key, another module only through its `public/`, client enums in contracts (QRY rules, `query-filter-rules.md`).
Findings cite rule IDs and are `blocker` (MUST/MUST NOT) or `advice` (SHOULD/AVOID).

## AIP-6a Explaining and answering

When asked what the architecture is or why a rule exists, answer from `architecture-rules.md` and
`docs/standards/domain-driven-hexagon/rationale.md` and name the ID. If the rules are silent, say "no
rule covers this" and offer an ADR; do not invent a rule.
