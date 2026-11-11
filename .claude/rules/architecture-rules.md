# Architecture rules - Domain-Driven Hexagon (binding, stack-agnostic)

Loaded in every session. Source: the Domain-Driven Hexagon reference (vendored under
`docs/standards/vendor/domain-driven-hexagon/`), every recommendation of its README turned into a
numbered rule, grouped by topic. `docs/standards/domain-driven-hexagon/traceability.md` maps each
README section to the rule IDs below and lists what was deliberately not turned into a rule.
`docs/standards/domain-driven-hexagon/rationale.md` explains why each group exists.
The planning and implementation protocol is in `ai-protocol.md` (also always loaded).

**Binding level.** The reference calls its content recommendations; in this repository the owner made
them mandatory (ADR-002). Every rule below applies to all backend code. A deviation is legal only as a
recorded ADR that names the rule ID, the module it covers and the reason - never silently, never "just
this once". If a request conflicts with a rule: stop, say which rule, propose the ADR (AIP-1).

Keywords: MUST / MUST NOT = no exceptions without an ADR. SHOULD / AVOID = default; a departure is
named in the plan. MAY = optional.

## PRG - Applicability and pragmatism

- **PRG-1** Every module MUST be classified when it is created as `domain-rich` (business rules or
  invariants beyond storing and returning data) or `data-centric` (glue between a database and a
  client). The classification and its reason are recorded in the module's spec.
- **PRG-2** `domain-rich` modules MUST follow every rule in this file. `data-centric` modules MUST
  follow STR, DEP, ADP, ERR, ENF and TST; they MAY skip DOM-V2 (value object per primitive), INF-5
  (separate persistence model) and INF-4's repository port, but only if the module's spec says so. A
  module with no business rules at all is a candidate for a simpler design, decided by ADR.
- **PRG-3** MUST NOT add an abstraction speculatively. A port (interface) is introduced only when it
  isolates I/O, technology or a side effect from the core, or is a test seam, or has two real
  implementations. Otherwise depend on the concrete type.
- **PRG-4** Before adding any pattern (domain event, saga, command bus, value object, domain service,
  read model), the plan MUST state the problem it solves and its cost. Patterns are tools, not dogmas;
  YAGNI and KISS apply. When unsure, keep the boundaries (layers, ports to I/O) and skip the optional
  pattern: it is easier to refactor over-design than no design.
- **PRG-5** Modules, objects, functions and processes MUST stay small and composable: a module should be
  rewritable in days, so that a changed requirement means replacing a module, not bending a program.
- **PRG-6** Skipping an optional building block (domain service, integration event, builder) is allowed
  when nothing needs it. Skipping a boundary rule (DEP) never is.

## STR - Structure

- **STR-1** Code MUST be organised into modules (components); a module's name MUST be an important
  concept of the domain, in the ubiquitous language; each module has its own folder and codebase.
- **STR-2** Inside a module, every business use case MUST get its own slice folder (vertical slicing)
  that holds what only that use case needs: its driving adapter(s), command or query, handler,
  request DTO(s).
- **STR-3** Files that change together MUST live together (common closure principle). Group by
  behaviour, not by technical type. MUST NOT use top-level layered folders (`controllers/`,
  `services/`, `repositories/` at the root of an application).
- **STR-4** What several slices of one module share (aggregate, entities, value objects, domain events,
  domain errors, repository port and implementation, mapper, response DTOs) lives at module level,
  outside the slices. What several modules share lives in the shared kernel (ENF-4) and contains no
  domain concept.
- **STR-5** Folder nesting SHOULD stay shallow (module / layer or group / slice). Moving files until the
  structure feels right is encouraged; breaking a boundary to shorten a path is not.
- **STR-6** Canonical module layout (names adapt to the language; the roles do not):

```
<module>/
  commands/<use-case>/     driving adapter(s) . command . handler (application service) . request DTO
  queries/<use-case>/      driving adapter(s) . query . query handler . request DTO
  domain/                  aggregate / entities . value-objects/ . events/ . errors . types . domain services
  application/             ports/ (interfaces) . event-handlers/
  infrastructure/          repository implementation . persistence model (schema) . other adapters
  dtos/                    response DTOs
  <module> mapper . dependency-wiring registration . injection tokens
```

- **STR-7** File names MUST carry the role as a dotted suffix (or the language's equivalent class-name
  suffix), consistently: `.aggregate .entity .value-object .domain-event .errors .types .domain-service`
  (domain); `.service .command .query .query-handler .port .domain-event-handler .mapper`
  (application); `.repository .adapter .persistence-model` (infrastructure); `.controller .resolver
  .cli-controller .message-controller .request.dto .response.dto` (interface adapters). Tools and
  reviewers recognise layers by folder and suffix.
- **STR-8** MUST NOT create one module per entity. A module may hold several entities with related
  business logic; MUST NOT group unrelated entities in one module.
- **STR-9** The structure is derived from the domain, so a new module is named after a concept the
  business uses, not after a table, a screen or a ticket.

## DEP - Dependency direction and isolation

- **DEP-1** Dependencies point inwards. Allowed: interface adapters -> application -> domain;
  infrastructure -> application ports and domain (it implements them). Inner layers MUST NOT depend on
  outer layers.
- **DEP-2** The dependency matrix (a row may import the columns marked `yes`):

| from \ to | domain | application | infrastructure | interface adapters | shared kernel |
|---|---|---|---|---|---|
| domain | yes (same module) | NO | NO | NO | yes |
| application | yes | yes (ports, own slice) | NO | NO | yes |
| infrastructure | yes | yes (ports) | yes | NO | yes |
| interface adapters | no (see ADP-3) | yes (commands, queries, bus) | NO | yes | yes |

  Exception named in the source: a port the domain itself needs may live in the domain layer (APP-12).
- **DEP-3** The domain MUST import only domain code, the shared kernel, the language's standard library
  and libraries allowed by DEP-6. It MUST NOT import a framework, ORM, database driver, HTTP library,
  logger or SDK.
- **DEP-4** Application code MUST reach the outside world only through ports; the concrete adapters are
  bound by dependency injection at the composition root. MUST NOT instantiate an adapter inside a use
  case.
- **DEP-5** A module MUST NOT import another module's internals (domain, application, infrastructure).
  Modules cooperate through (a) a public facade or ports the module deliberately exposes, or (b)
  messages: commands sent on a command bus, events the other module publishes. This keeps coupling loose
  and lets a module become a separate service without touching domain logic.
- **DEP-6** Libraries inside the core: MUST NOT import one that exposes out-of-process access (HTTP,
  database), functionality irrelevant to the domain (frameworks, ORMs, loggers), randomness (random ids,
  clocks: take them as inputs or isolate them so tests are deterministic), or that changes often or
  drags many dependencies. A single-responsibility library tied to one or a few domain objects is
  tolerated; a general-purpose library that would spread across many domain objects MUST be wrapped in an
  anti-corruption adapter or facade.
- **DEP-7** Frameworks live in the outer layers. The domain layer MUST be extractable with a new
  infrastructure built around it without breaking business logic. Non-intrusive framework annotations
  (dependency-injection markers) are tolerated; anything that shapes domain behaviour is not.
- **DEP-8** MUST NOT create dependencies between use cases (slices) or between application services:
  shared logic moves to a separate file both depend on. An application service MUST NOT depend on
  another application service.
- **DEP-9** Cyclic dependencies are forbidden at every level (files, slices, modules).
- **DEP-10** Minimise dependencies in general (fewer dependencies, fewer defects and attack surface)
  without re-implementing battle-tested libraries; adding a dependency is recorded (AGENTS.md red flag).

## APP - Application layer

- **APP-1** Application services (use cases, handlers, interactors) MUST only orchestrate: fetch
  entities/aggregates through ports, execute domain logic by invoking their methods, persist through
  ports, run out-of-process communication (events, mail) through ports. They MUST NOT contain
  domain-specific business logic.
- **APP-2** Application services receive scalar types (anything unknown to the domain model) and
  transform them into domain types. They never expose domain objects to the outside by returning them
  across the driving adapter (ADP-3).
- **APP-3** One application service per use case. A service MAY be the command or query handler.
- **APP-4** When a use case spans several entities or aggregates and the logic fits none of them, use a
  domain service (DOM-S1); the application service still only orchestrates.
- **APP-5** Command-query separation: commands change state, queries read it. Input to a use case MUST
  be a `Command` or `Query` object; a request DTO is converted into one before it reaches the domain.
- **APP-6** A command signals intent (`CreateUser`), is immutable, describes a single action and does
  not perform it. It carries metadata (id, correlation id, causation id, user id, timestamp) set by the
  shared command base.
- **APP-7** Commands MUST NOT return business data. Returning the created id, a status or other metadata
  is allowed; prefer ids generated by the client (UUID) where possible so a command needs to return
  nothing.
- **APP-8** Commands and queries SHOULD be dispatched through a bus so the invoker is decoupled from the
  handler and use cases can be triggered from anywhere without coupling.
- **APP-9** A command handler MUST NOT execute another command (Command -> Command). Chain through an
  event: Command -> Event -> Command, with the next command run by an event handler.
- **APP-10** A query MUST NOT change state (no writes to databases, files or third-party APIs). The read
  model MAY bypass the domain and the repositories and query storage directly from the query handler,
  returning read-shaped data.
- **APP-11** When domain event handlers change several aggregates in one process, the use case MUST wrap
  the whole flow in one transaction (or a unit of work). MUST NOT abuse transactions: under contention
  prefer eventual consistency.
- **APP-12** Ports are interfaces that say what must be done, not how. They MUST be shaped by the
  domain's needs, not by a tool's API; split large interfaces (interface segregation) without
  over-splitting; they live in the application layer, or in the domain layer when domain logic itself
  depends on an external resource. A port can be mocked, so use-case logic is tested in isolation
  without the environment. Ports let technology decisions be deferred.
- **APP-13** Domain event handlers that react to events of the same process live in the application
  layer of the reacting module and change other aggregates only through their repositories' ports.

## DOM - Domain layer

- **DOM-1** The domain operates on domain objects named by the ubiquitous language; names in code match
  the words the business uses.

### Entities

- **DOM-E1** Business logic MUST live in entities (and aggregates, value objects). MUST NOT move it into
  services (anemic domain model); domain services (DOM-S1) are the only exception.
- **DOM-E2** An entity has an identity that stays constant over its life cycle; equality is by identity
  (usually its id), never by field values.
- **DOM-E3** An entity MUST always be valid. It validates all required properties on creation and fails
  fast on the first violation; it MUST NOT have public setters or a no-argument constructor; it is
  created through its constructor or a factory (`create()`) that takes and validates everything
  required; state changes go through intention-revealing methods that validate invariants after the
  change. A `validate()` check of the invariants runs before every save.
- **DOM-E4** Entities MUST be partially immutable: properties that must not change after creation (id,
  creation time) are read-only.
- **DOM-E5** Entity data is shaped for business logic, not for a database schema.
- **DOM-E6** An entity knows nothing about upper layers (services, controllers, DTOs, persistence).
- **DOM-E7** An entity collects all understanding of its state and of how the state changes in one place
  and coordinates the operations on the objects it owns. A fluent interface or builder MAY be used for
  optional properties with complex set-up.

### Aggregates

- **DOM-A1** An aggregate is a cluster of entities and value objects treated as a unit, with one
  aggregate root. The root has a global identity; entities inside have identities unique only within
  the aggregate. References from outside MUST go only to the root.
- **DOM-A2** Only aggregate roots are obtained directly from storage; everything else is reached by
  traversal from the root.
- **DOM-A3** Every operation on an aggregate MUST be transactional: everything saved, updated or deleted,
  or nothing. When a change is committed all invariants of the whole aggregate hold (consistency
  boundary).
- **DOM-A4** An aggregate MUST reference other aggregates by their global id, never by a direct object
  reference.
- **DOM-A5** Aggregates MUST be kept small; large ones cause performance and maintenance problems.
- **DOM-A6** The aggregate is shaped by domain consistency needs, not by the data model: associations
  between domain objects are not database relationships.
- **DOM-A7** Aggregates MAY publish domain events (DOM-EV1).

### Value objects

- **DOM-V1** A value object has no identity (equality by structure), is immutable, enforces its
  invariants at construction, MAY carry behaviour, and MAY be an attribute of entities and other value
  objects. It is a well-defined domain concept even when it has one attribute, not merely a convenient
  grouping.
- **DOM-V2** A primitive that carries business meaning and rules (email, money, quantity, slug, date
  range) MUST be modelled as a value object (domain primitive) so that invalid values cannot enter
  entities and its rules live in one place. A primitive without a rule MAY stay a primitive or a
  nominal (branded) type.
- **DOM-V3** MUST NOT create a class for every primitive for its own sake: if it carries no rule or
  behaviour, do not (complexity gate; PRG-4).
- **DOM-V4** Value objects MUST NOT cross process or layer boundaries as objects: DTOs, events and
  persistence models carry their primitives (serialised form).
- **DOM-V5** Make illegal states unrepresentable. Prefer enums to string constants; model "A, or B, or
  both" as a sum type, not two optional fields; encode state in types where the language allows
  (typestate). Validate at compile time first and at runtime second.

### Domain events

- **DOM-EV1** A domain event is an immutable, past-tense message that something happened in the domain
  and that other parts of the same domain, in the same process, should know. It carries the aggregate
  id and metadata (event id, timestamp, correlation id, causation id, user id). The aggregate records
  it; the repository (or unit of work) publishes it after the change is persisted.
- **DOM-EV2** Side effects on other aggregates MUST be triggered by event handlers, not coded into the
  service that handled the original command; this prevents coupling between aggregates and
  subdomains.
- **DOM-EV3** For long, multi-step workflows, events alone are hard to follow: use an orchestrator,
  mediator or process manager that holds the whole workflow in one place. Do not rely on events only.
- **DOM-EV4** Domain events MAY feed an audit log (and are the reason to avoid soft deletes).
- **DOM-EV5** Consistency: in one process, all changes caused by the events of one use case commit in one
  transaction (APP-11). Across services, or with a stream per aggregate, changes are eventually
  consistent (saga with compensating events, or process manager).

### Integration events

- **DOM-IE1** Out-of-process communication (other services, external APIs) is done with integration
  events, sent by a domain event handler through a port. They are published only after all domain events
  finished and all changes are saved. Reliable delivery uses the transactional outbox, change data
  capture, sagas or a process manager, and a broker when services are separate processes.

### Domain services

- **DOM-S1** A domain service holds a significant process or transformation that is not the natural
  responsibility of one entity or value object: logic across two or more entities, or logic that would
  force an entity to know things it should not. It is granular, uses only domain types and ubiquitous
  language, and is distinct from the application service (a facade that provides an API).

## VAL - Invariants and validation

- **VAL-1** Validate in two places with two purposes: at the boundary (filtration: reject bad input with
  all errors collected and reported together) and inside the domain (guarding: a failsafe that treats a
  violated invariant as a bug and fails fast). Input validation never replaces domain guarding, and the
  reverse.
- **VAL-2** Full sanity validation uses a validation framework at the boundary (request DTO). Inside the
  domain, only basic guards (null/undefined, empty, length and range, simple always-true patterns) and
  business rules. The domain MUST NOT depend on a general-purpose validation library; a very specific
  single-purpose library MAY serve one or a few value objects.
- **VAL-3** Custom regular expressions in the domain MUST be limited to simple rules that are always
  true (an email contains `@`); leave hard validation to the boundary library so the two never
  conflict.
- **VAL-4** Data MUST NOT be trusted: external APIs, database rows and programmer error can all deliver
  invalid data. Rows are validated when mapped into the domain.
- **VAL-5** Use design by contract: preconditions in constructors, postconditions and invariants checked
  before saving. A small guard library (empty, length-between, and similar) lives in the shared kernel.
- **VAL-6** The domain validates only rules shared by all contexts; context-dependent rules, rules
  involving another field or entity, are handled where that context lives.

## ERR - Errors

- **ERR-1** The domain and application layers MUST NOT throw or return transport errors (HTTP statuses
  and exceptions, RPC codes). They use custom error classes with a stable machine-readable `code`
  (`MODULE.REASON`), a message, optional non-sensitive metadata and the correlation id, serialisable
  across processes (because type checks do not cross process boundaries; the code does).
- **ERR-2** Exceptions are for exceptional situations. A business outcome that is not exceptional
  ("seat already booked") MUST be returned as a typed result (`Result`/`Either`: success or failure)
  whose error is a sum type listing the use case's possible errors, so the type shows what can happen.
- **ERR-3** Technical, unrecoverable errors (connection lost, out of memory) MUST be thrown, not
  returned: returning them lets execution continue in an incorrect state. Decide by asking whether the
  error is likely recoverable (Result) or likely unrecoverable (throw).
- **ERR-4** A driving adapter maps each known error code or type to its transport meaning (conflict,
  bad request, not found) and rethrows unknown errors as internal errors. A CLI or internal caller MAY
  unwrap a result and let a failure throw.
- **ERR-5** Generic application errors (argument invalid, out of range, not provided, not found,
  conflict, internal) live in the shared kernel; domain errors live in their module.
- **ERR-6** Error metadata MUST NOT contain sensitive data (it ends up in logs); stack traces MUST NOT
  be returned to users in production.

## ADP - Interface adapters (driving side)

- **ADP-1** A driving adapter (controller, resolver, CLI command, message handler) only parses the
  request, builds a command or query, dispatches it and presents the result. It MUST NOT contain
  business logic.
- **ADP-2** One adapter per use case; when a use case has several triggers (HTTP, GraphQL, CLI, message)
  one adapter per trigger. Only this layer changes when the transport changes.
- **ADP-3** Data from outside is represented by DTOs. A request DTO is the contract clients must follow;
  a response DTO is a whitelist of what clients may receive. DTOs are data-oriented (flat, mostly
  primitives), contain no domain objects or value objects, and are separate from commands (a command
  is a serialisable domain call; a DTO is a backward-compatible contract).
- **ADP-4** Responses MUST be built by whitelisting properties (a mapper from entity to response DTO),
  never by blacklisting, so a newly added sensitive field cannot leak.
- **ADP-5** Breaking changes to a DTO contract ship as a new API version; DTOs shield clients from
  internal model changes.
- **ADP-6** DTOs shared by several applications MAY live in a shared package. Documentation annotations
  (API description) belong to this layer. Without validation or documentation annotations a DTO MAY be a
  plain interface.
- **ADP-7** A local DTO (never letting an entity leave its module) is justified when decoupling modules:
  when one module queries another, entities MUST NOT leak between them.
- **ADP-8** All validation errors of a request are gathered first and returned together (notification
  pattern).

## INF - Infrastructure layer (driven side)

- **INF-1** Infrastructure encapsulates technology: repositories, brokers, I/O services, external APIs,
  framework glue. It is the most volatile layer and stays as far as possible from the domain. Adapters
  implement ports and MUST NOT be called directly - only through ports.
- **INF-2** An adapter SHOULD have: the port it implements, a mapper from and to the domain, a DTO or
  interface for the data it receives, and a validator ensuring that incoming data is not corrupted.
- **INF-3** An adapter MAY act as an anti-corruption layer in front of legacy code or a third-party API
  so that the foreign model never leaks inwards.
- **INF-4** A repository is an abstraction over a collection of aggregates: it receives an aggregate from
  the application service, maps it to the persistence model, performs the operation, maps back and
  returns an aggregate. The application depends on the repository port, not the implementation. It
  validates the entity before every write, publishes the aggregate's domain events after persisting,
  takes part in the use-case transaction, and translates storage constraint errors into domain or
  application errors (conflict, not found). Read-model queries do not need a repository.
- **INF-5** The persistence model MUST be separate from the domain model: tables, ORM entities and
  schemas are shaped for the database; entities for the domain; a mapper converts both ways. The
  domain MUST NOT know the persistence model, so normalising or changing the database never forces a
  domain refactor. Several models for different purposes MAY coexist (write model, read model).
- **INF-6** Abstracting the database is not always useful (most projects never change database
  technology and an abstraction can hide its power): keep the repository port for domain-rich
  aggregates (INF-4); apply PRG-3 elsewhere.
- **INF-7** The choice between ORM, query builder and raw queries is a stack decision recorded in an ADR;
  rows are validated at runtime when read (VAL-4).
- **INF-8** Other infrastructure: the application logger implementation, schedulers and cron launchers,
  infrastructure-level events, framework files.

## ENF - Enforcement, shared kernel, inheritance

- **ENF-1** The architecture MUST be machine-enforced. A dependency-boundary tool encoding DEP-2 (by
  folder and by file suffix, STR-7) MUST run in CI and fail the build on a violation; the tool is chosen
  in the stack ADR (examples: dependency-cruiser for JavaScript/TypeScript, ArchUnit for Java). No
  module is merged before the check exists. Violations are fixed, never suppressed in the tool's
  configuration without an ADR.
- **ENF-2** The dependency graph SHOULD be generated from the same tool to keep the picture current.
- **ENF-3** A class designed for extension is abstract; a class not designed for extension MUST be
  sealed (final) where the language allows, or guarded where it does not. Inheritance MUST NOT go deeper
  than two levels; prefer composition.
- **ENF-4** The shared kernel is small and domain-free: base `Entity`, `AggregateRoot`, `ValueObject`,
  `DomainEvent`, `Command`, `Query`, repository and mapper contracts, `Result`, application and generic
  exceptions, `Guard`, request-context (correlation id) and a logger port. Anything domain-specific
  does not belong in it.
- **ENF-5** Request context (correlation id and, when used, the current transaction) is carried through a
  per-request context, never through globals.

## TST - Tests

- **TST-1** Every use case has behavioural (black-box) tests derived from the acceptance criteria of its
  capability spec, written in the ubiquitous language; a Given/When/Then format (Gherkin) is encouraged
  because it lets non-developers define steps.
- **TST-2** Three levels per slice: domain unit tests with no infrastructure at all; use-case tests with
  test doubles behind the ports; behavioural tests through the driving adapter against a real test
  database. A test never edits the code it grades.
- **TST-3** Behavioural tests MUST refuse to run against a database whose name does not mark it as a test
  database. Tests clean up what they create.
- **TST-4** Test files mirror the slices they cover and share step definitions and context helpers
  instead of duplicating them. Load tests per use case are optional.
- **TST-5** Test doubles for ports are part of the code base (in-memory implementations), not ad-hoc
  mocks scattered through tests.
