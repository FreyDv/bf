# Domain-Driven Hexagon - traceability

Every section of the README (vendored verbatim: [`../vendor/domain-driven-hexagon/README.md`](../vendor/domain-driven-hexagon/README.md),
commit `5c2d15a`) mapped to the rules in [`.claude/rules/architecture-rules.md`](../../../.claude/rules/architecture-rules.md),
so nothing the source recommends is lost. "Not a rule" entries are stack-specific content, deliberately
left to the stack ADR, or evidence the source itself marks as an example.

| README section | Rule IDs | Notes |
|---|---|---|
| Intro, "Everything below is a recommendation" | PRG-1..6, binding-level paragraph | the owner made the recommendations mandatory; the source's own complexity caveats became the PRG gates |
| Architecture, Pros and Cons | PRG-1, PRG-2, PRG-4 | pros (independence, testability, security, team independence, constant cost of change, microservice-ready) in `rationale.md`; cons (needs an expert, overkill for small CRUD) became the classification gate |
| Diagram (data flow) | STR-6, DEP-1, DEP-2, APP-1, ADP-1, INF-4 | flow reproduced in `rationale.md` |
| Modules | STR-1..5, STR-8, DEP-5, DEP-8, PRG-5 | vertical slicing, module independence, facade/mediator/messages, keep modules small |
| Application Core | STR-6, PRG-6 | building blocks of each layer |
| Application Services | APP-1..4, DEP-8 | one service per use case; no dependency between services |
| Commands and Queries (CQS) | APP-5..10 | client-generated ids, command bus, Command -> Event -> Command, query bypassing the domain |
| Ports | APP-12, PRG-3, DEP-1, DEP-4 | false-abstraction warning became PRG-3 |
| Domain Layer, Entities | DOM-1, DOM-E1..E7, STR-8 | fail fast, no setters, no no-arg constructors, partial immutability |
| Aggregates | DOM-A1..A7 | global/local identity, consistency boundary, reference by id, keep small |
| Domain Events | DOM-EV1..EV5, APP-11, APP-13 | audit log, transaction vs eventual consistency, orchestrator for long workflows |
| Integration Events | DOM-IE1 | outbox, CDC, saga, process manager |
| Domain Services | DOM-S1, APP-4 | |
| Value Objects | DOM-V1..V4 | |
| Domain Invariants, Replacing primitives | DOM-V2, DOM-V3, DOM-V4, VAL-5 | domain primitives; the source's TypeScript value-object boilerplate warning became DOM-V3 |
| Make illegal states unrepresentable | DOM-V5, VAL-4 | compile time vs runtime; typestate |
| Guarding vs validating | VAL-1..6, ADP-8 | |
| Domain Errors | ERR-1..6 | Result/Either, recoverable vs unrecoverable, codes |
| Using libraries inside the core | DEP-3, DEP-6, DEP-7, DEP-10, INF-3 | anti-corruption layer |
| Interface Adapters, Controllers, Resolvers | ADP-1, ADP-2 | one controller per use case and per trigger |
| DTOs (request, response, additional, local) | ADP-3..8 | whitelisting, versioning, shared DTOs, local DTOs |
| Infrastructure layer, Adapters | INF-1..3, INF-8 | |
| Repositories | INF-4, INF-6, APP-10 | "should you abstract the database" caveat became INF-6 |
| Persistence models | INF-5, INF-7 | ORM vs query builder is a stack decision |
| General recommendations (YAGNI, KISS, pragmatism) | PRG-3, PRG-4 | |
| Recommendations for smaller APIs | PRG-1, PRG-2 | MVC for CRUD-like modules became the data-centric branch |
| Behavioral Testing | TST-1..5 | Gherkin/Cucumber encouraged; load tests optional |
| Folder and File Structure, File names | STR-3..7 | CCP, layered vs modular vs sliced structure, dotted suffixes |
| Enforcing architecture | ENF-1, ENF-2, DEP-2 | the source's cruiser rules are the DEP-2 matrix |
| Prevent massive inheritance chains | ENF-3 | final/sealed, depth <= 2 |
| src/libs (base classes: Entity, AggregateRoot, ValueObject, DomainEvent, Command, Query, repository port, mapper, exceptions, Guard, request context, logger port) | ENF-4, ENF-5, ERR-5, VAL-5 | the vendored code is the reference implementation |
| Additional resources (articles, videos, books) | not a rule | each cited page is digested under `../digests/D5..D8-ddh-links-*.md` |

## Deliberately not turned into rules (stack-specific, decided in the stack ADR)

- The reference's choice of NestJS, its decorators and modules, `@nestjs/cqrs`, GraphQL/Apollo, `nestjs-console`.
- The reference's choice of Slonik raw SQL with zod row schemas, the migrator, and PostgreSQL specifics.
- `oxide.ts` / `@badrap/result` as Result libraries; `class-validator` / `class-sanitizer` as validation
  libraries; `Runtypes`; `jest-cucumber` / Cucumber as test tooling; Artillery as load-test tool; the `final`
  decorator implementation.
- `dependency-cruiser` rule syntax and the `.eslintrc`/`.prettierrc` values (the principle - ENF-1,
  no property setters (DOM-E3), consistent formatting - is a rule; the tools are stack choices). Values are
  kept in the vendored files for reference when the stack is chosen.
- Sample domain (users, wallets, address) and its tests: reference implementation, not requirements.
