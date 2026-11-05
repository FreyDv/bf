# Domain-Driven Hexagon - the rules, numbered

Every recommendation of the Domain-Driven Hexagon README
([vendored verbatim](../vendor/domain-driven-hexagon/README.md), commit `5c2d15a`), extracted as
a numbered rule with the README's own reasoning, in the README's order. The README states that
everything in it "is provided as a recommendation, not a rule" and must be adjusted to the
project; **which rules bind this repository, and how each one maps to NestJS + nestjs-trpc +
Drizzle, is decided in [`bf-mapping.md`](bf-mapping.md) and ADR-025** - this file never
weakens or strengthens the source. Section names in brackets are the README headings, so a
rule can be checked against its source in one jump.

Modality: **MUST / MUST NOT** where the README says "must", "should always", "never", "cannot";
**SHOULD / AVOID** where it says "should", "try to", "avoid", "prefer"; **MAY** where it offers
an option. The README's own hedges ("when possible", "when it makes sense") are kept.

## Architecture and layering [Architecture, Diagram]

- **DDH-1.** The architecture combines DDD, Hexagonal (Ports and Adapters), Secure by Design,
  Clean Architecture, Onion Architecture, SOLID and classic design patterns. Pros: independent
  of frameworks/databases (pluggable with less effort), easily testable and scalable, more secure
  by design, workable by several teams without collisions, constant and small difficulty of
  adding features as the system grows, convertible into microservices along bounded-context
  lines. Cons: it is sophisticated and needs an expert to drive it and keep it from accumulating
  debt; many practices are not recommended for small or medium applications with little business
  logic (up-front complexity, boilerplate, abstractions, mapping), and it is ill-suited to simple
  CRUD.
- **DDH-2.** Data flows: request/CLI command/event -> controller receives a plain DTO ->
  controller maps the DTO to a Command/Query and passes it to an application service ->
  the service executes business logic through domain services and entities/aggregates and uses
  the infrastructure layer through ports (interfaces) -> infrastructure maps data to its own
  format, persists/retrieves, uses adapters for other I/O (brokers, external APIs), maps back to
  the domain format -> the service returns data/confirmation to the controller -> the controller
  returns it to the user (or presenters/views).
- **DDH-3.** Each layer owns its own logic; its building blocks SHOULD follow the
  single-responsibility principle when possible and sensible (repositories only for database
  access, entities for business logic, and so on).
- **DDH-4.** Projects MAY have more or fewer steps/layers/building blocks than described; add
  what the application requires and skip what would over-complicate it. General rule for any
  project: analyse how big/complex it will be, find a compromise, use as many layers/blocks as
  needed and skip the rest.

## Modules [Modules]

- **DDH-5.** Separate the code by modules (components). A module's name MUST reflect an
  important domain concept; each module has its own folder with a dedicated codebase.
- **DDH-6.** Each business use case inside a module gets its own folder holding most of what
  it needs (vertical slicing): things that change together live close together. A module is a
  "box" grouping related business logic - a way to encapsulate highly cohesive domain rules.
- **DDH-7.** Make every module independent and keep interactions between modules minimal:
  a module is a mini application bounded by a single context; its internals are private.
  AVOID direct imports between modules (`import SomeClass from '../SomeOtherModule'`): that is
  tight coupling that turns code into spaghetti and the application into a big ball of mud.
- **DDH-8.** To avoid coupling: do not create dependencies between modules or between use
  cases - move shared logic into separate files both depend on; let modules cooperate through a
  mediator or a public facade that hides internals and exposes only what is meant to be
  public; or communicate by messages - commands through a command bus, events other modules
  emit. Loose coupling lets a module's internals be refactored because the outside world depends
  only on its public interface, and a well-bounded module can be split into a microservice
  without touching domain logic.
- **DDH-9.** Keep modules small: you should be able to rewrite a module in a relatively short
  time. The same applies to objects, functions, microservices, processes - small and
  composable, because changing small modules is easier than changing a big program when
  requirements change ("The art of destroying software", Greg Young).

## Application core [Application Core]

- **DDH-10.** The core is built from DDD building blocks. Domain layer: entities, aggregates,
  domain services, value objects, domain errors. Application layer: application services,
  commands and queries, ports. Different implementations may have slightly different layer
  structures; more layers and blocks MAY be added.

## Application services [Application Services]

- **DDH-11.** Application services (workflow services, use cases, interactors) orchestrate
  the steps required to fulfil a client's command. They: orchestrate how the outside world
  interacts with the application; contain **no** domain-specific business logic; operate on
  scalar types and transform them into domain types (a scalar is any type unknown to the
  domain model); declare dependencies on infrastructure through ports; fetch entities/aggregates
  through ports with implementations injected by DI; execute domain logic by invoking entity
  methods; use a domain service when several entities/aggregates are involved; execute other
  out-of-process communication through ports (events, mail); can serve as command/query
  handlers; and SHOULD NOT depend on other application services (cyclic dependencies).
- **DDH-12.** One service per use case is considered good practice.

## Commands and queries [Commands and Queries]

- **DDH-13.** Apply Command-Query Separation: when possible, separate methods into commands
  (state-changing) and queries (data retrieval), and represent inputs as `Command`/`Query`
  objects; a DTO is converted into a Command/Query before it reaches the domain.
- **DDH-14.** A command signals user intent (`CreateUserCommand`), describes a single action
  and does not perform it. Commands are for state-changing actions (create/update/delete);
  data retrieval is the queries' responsibility, so command methods SHOULD NOT return business
  data. Purists return nothing; the practical approach returns metadata (the created id, a
  redirect, a confirmation, a status) - or let clients generate a UUID (CQS versus
  server-generated ids). The README's `Command` is similar to but not the same as the GoF
  Command pattern.
- **DDH-15.** Execute commands through a command bus instead of importing a service directly:
  it decouples invoker from receiver, so commands can be sent from anywhere without coupling.
- **DDH-16.** AVOID command handlers executing other commands (Command -> Command). Use events:
  Command -> Event -> Command, executing the next command in an event handler.
- **DDH-17.** A query belongs to the read model, signals intent to find something and
  describes how; it MUST NOT make state changes (database writes, files, third-party APIs).
  Because of that, the read model MAY bypass the domain and repository layers entirely and
  query the database directly from a query handler. Queries MAY use a query bus for the same
  decoupling as commands.
- **DDH-18.** Enforcing command/query separation keeps code simpler to understand (one changes,
  one retrieves) and facilitates splitting write and read models into separate databases later.
  The reference uses NestJS CQRS for its command/query bus.

## Ports [Ports]

- **DDH-19.** Ports are interfaces that define contracts adapters implement; they abstract
  technology details (which database, which broker) the business logic does not care about.
  In the core, **dependencies point inwards**: outer layers may depend on inner layers, inner
  layers never on outer ones. The core MUST NOT depend on frameworks or access external
  resources directly; every external call (out-of-process resources, remote data) goes through a
  port, with the implementation created in infrastructure and injected (dependency injection,
  dependency inversion). This makes the business logic technology-independent, testable, and
  the resources pluggable.
- **DDH-20.** Ports define what has to be done, not how; they MAY abstract side effects (I/O,
  database access), technology details, invasive libraries and legacy code away from the domain;
  they let application logic be unit-tested in isolation with mocks (faster, environment
  independent); they SHOULD be designed to fit the domain's needs, not mimic a tool's API; they
  allow polymorphic implementations; design them with the interface-segregation principle
  (split large interfaces when it makes sense, without overdoing it); they delay decisions -
  the domain can be implemented before the technologies are chosen.
- **DDH-21.** Ports usually live in the application layer, since their implementations are
  injected and executed there; when domain logic depends on an external resource the port MAY
  live in the domain layer.
- **DDH-22.** AVOID abusing ports/interfaces: unnecessary abstraction over-complicates the
  application; depending on a concrete implementation is often fine. Think carefully whether an
  abstraction is really needed before adding it.

## Domain layer [Domain Layer]

- **DDH-23.** The domain layer holds the business rules and operates on domain objects named
  by the ubiquitous language.

### Entities [Entities]

- **DDH-24.** Entities encapsulate enterprise-wide business rules and attributes; they express
  what a model has, what it can do, when and under what conditions. They MUST always protect
  their invariants: an entity object cannot exist without being valid (an order item always has
  a positive quantity, a name and a price); invariant enforcement is the entity's (especially
  the aggregate root's) responsibility.
- **DDH-25.** Entities contain domain business logic. AVOID business logic in services (an
  anemic domain model); domain services are the exception for logic that fits no single entity.
- **DDH-26.** An entity has an identity that distinguishes it and stays consistent over its
  life cycle; equality is by identifier (usually `id`).
- **DDH-27.** Entities may contain other entities and value objects; they collect all
  understanding of state and how it changes in one place; they coordinate operations on the
  objects they own; they know nothing about upper layers (services, controllers).
- **DDH-28.** Entity data is modelled to accommodate business logic, not a database schema.
- **DDH-29.** AVOID public setters: update state through methods and run invariant validation on
  each update when needed (a `validate()` method that checks the rules is enough).
- **DDH-30.** Entities MUST be consistent on creation: validate entities and other domain
  objects at creation and throw on the first failure (fail fast). AVOID no-arg constructors:
  accept and validate all required properties in the constructor or a factory method
  (`create()`); use a fluent interface or a builder for optional properties with complex setup.
- **DDH-31.** Make entities partially immutable: identify what must not change after creation
  (`id`, `createdAt`) and make it `readonly`.
- **DDH-32.** AVOID one module per entity: a module may hold several entities with related
  business logic; do not group unrelated entities in one module.

### Aggregates [Aggregates]

- **DDH-33.** An aggregate is a cluster of domain objects treated as one unit; it encapsulates
  the entities and value objects that conceptually belong together plus the operations on them,
  and simplifies the model by gathering several objects under one abstraction.
- **DDH-34.** Aggregates MUST NOT be influenced by the data model: associations between domain
  objects are not database relationships.
- **DDH-35.** The aggregate root is the entity that holds the other entities/value objects and
  all logic to operate them; it has a global identity (UUID/GUID/primary key), while entities
  inside the boundary have local identities unique only within the aggregate.
- **DDH-36.** The root is the gateway to the whole aggregate: references from outside MUST only
  go to the root.
- **DDH-37.** Any operation on an aggregate MUST be transactional: everything is
  saved/updated/deleted, or nothing.
- **DDH-38.** Only aggregate roots are obtained directly by database queries; everything else
  is reached by traversal.
- **DDH-39.** Aggregates protect their invariants through the whole life cycle: when a change
  inside the boundary is committed, all invariants of the whole aggregate hold (the consistency
  boundary).
- **DDH-40.** Objects inside an aggregate reference other aggregate roots by their globally
  unique id; AVOID holding a direct object reference.
- **DDH-41.** AVOID aggregates that are too big (performance and maintenance problems).
- **DDH-42.** Aggregates MAY publish domain events. Combining related entities and value objects
  inside one root entity makes that root an aggregate root and the cluster an aggregate; the
  rules all follow from drawing that boundary, which forces each relationship to be considered
  carefully.

### Domain events [Domain Events]

- **DDH-43.** A domain event indicates that something happened in the domain that other parts
  of the same domain (in-process) should know; it is a message pushed to an in-memory dispatcher.
- **DDH-44.** When executing a command on one aggregate requires further domain rules on other
  aggregates (update the cart, withdraw from the wallet, create a shipping order), do not put
  all of it in one service (coupling between subdomains): publish a domain event and implement
  the side effects as event handlers, as many as needed - this prevents coupling between
  aggregates.
- **DDH-45.** Domain events MAY feed an audit log by saving each event (and audit logs are a
  reason to avoid soft deletes).
- **DDH-46.** All changes caused by domain events across several aggregates in one process MAY
  be saved in a single database transaction (wrap the flow, or use Unit of Work) for consistency
  and integrity. AVOID abusing transactions: they bottleneck when many users modify one record
  concurrently; use them only when affordable, otherwise go for eventual consistency.
- **DDH-47.** An in-process event bus MAY be built on the Mediator or Observer patterns. In the
  reference, the repository publishes all of an aggregate's domain events when it persists the
  aggregate, and the service wraps the whole flow in a global transaction so every handler's
  change is stored atomically.
- **DDH-48.** Events alone make complex multi-step workflows hard to track (event triggers
  event triggers event); for those, a service/orchestrator/mediator with the workflow in one
  place MAY be preferred - some coupling, easier maintenance. Do not rely on events only; pick
  the right tool.
- **DDH-49.** When changes to several aggregates cannot share one transaction (microservices,
  event sourcing with one stream per aggregate), save them eventually consistently - sagas with
  compensating events, a process manager, or similar.

### Integration events [Integration Events]

- **DDH-50.** Out-of-process communication (other microservices, external APIs) is an
  integration event; when a domain event must reach another process, the domain event handler
  sends an integration event.
- **DDH-51.** Integration events SHOULD usually be published only after all domain events have
  finished executing and all changes are saved.
- **DDH-52.** Across services use an external broker/event bus (RabbitMQ, Kafka) with the
  transactional outbox, change data capture, sagas or a process manager to keep eventual
  consistency.

### Domain services [Domain Services]

- **DDH-53.** A domain service holds "a significant process or transformation in the domain
  that is not a natural responsibility of an entity or value object" (Evans): domain logic that
  relies on two or more entities, or that would break an entity's encapsulation by making it
  know things it should not. Domain services are very granular; application services are a
  facade providing an API. Domain services operate only on domain types and hold concepts from
  the ubiquitous language that fit neither value objects nor entities.

### Value objects [Value objects]

- **DDH-54.** Attributes and behaviour MAY be moved out of an entity into value objects. A
  value object has no identity (equality is structural), is immutable, can be an attribute of
  entities and other value objects, and explicitly defines and enforces invariants.
- **DDH-55.** A value object is not a convenient grouping of attributes: it forms a
  well-defined domain concept, even with a single attribute; modelled as a conceptual whole it
  carries meaning when passed around and upholds its constraints. An address (country, street,
  postal code) is the canonical example; a value object can also encapsulate logic about the
  concept.

### Domain invariants [Domain Invariants]

- **DDH-56.** Invariants are the policies and conditions always met for the domain in a
  context; they decide what is possible and what is prohibited. Enforcement is the domain
  objects' responsibility (especially entities and aggregate roots). A domain object MUST NOT
  be able to exist in violation of them (amount positive and receiver card in a valid format;
  no purchase of an out-of-stock product; no negative wallet balance).

#### Replacing primitives with value objects [Replacing primitives with Value Objects]

- **DDH-57.** Primitives (`string`, `number`) are often too low an abstraction for the domain
  model; express significant business concepts as specific types/classes (value objects) to
  avoid primitive obsession - `Email` instead of `string`, so the only way to make an email is
  to construct a valid `Email`, and a wrong value cannot reach an entity.
- **DDH-58.** Value objects for primitives are domain primitives (Secure by Design). Benefits:
  code reads in the ubiquitous language; invariants of every property improve security;
  business rules about a value live in one place; forcing the developer to study the domain
  instead of throwing a primitive at it. If every argument and return value is valid by
  definition, every method has input and output validation for free, protecting against a
  whole class of bugs and vulnerabilities from invalid input. Domain primitives also keep
  entities from growing overly complex with validation, formatting and comparison chores.
- **DDH-59.** A type alias (ideally a nominal type) MAY give a primitive semantic meaning as a
  lighter alternative to an object.
- **DDH-60.** MUST NOT include value objects in objects sent to other processes (DTOs, events,
  database models): serialise them to primitives first.
- **DDH-61.** In TypeScript, value objects for single values add boilerplate (`email.value`)
  and object-creation cost; the technique works best in languages with value classes (Scala).
  Runtypes is an alternative to hand-written primitives in Node.
- **DDH-62.** Primitive obsession is contested: for small projects an object per primitive is
  overkill; for bigger ones opinions differ. If an object per primitive gives little benefit,
  create classes only for the primitives with specific rules or behaviour, or validate only
  outside the domain with a validation framework.

#### Make illegal states unrepresentable [Make illegal states unrepresentable]

- **DDH-63.** Use value objects/domain primitives and types (algebraic data types) to make
  illegal states impossible to represent (De Goes: statically proving every runtime value
  corresponds to a valid business object).
- **DDH-64.** Validation at compile time: types give semantic information and catch errors in
  the IDE; prefer enums over string constants as input types; model "email or phone or both"
  as a union type (`Email | Phone | [Email, Phone]`) rather than two optionals, moving the rule
  from runtime to compile time (the typestate pattern: an object's run-time state encoded in its
  compile-time type).
- **DDH-65.** Validation at runtime: data MUST NOT be trusted (external APIs, the database,
  programmer error). What cannot be validated at compile time (user input) is validated at
  runtime: the first line of defence is user-input DTO validation; the second is the domain
  objects protecting their invariants - design by contract with preconditions in constructors
  and postconditions/invariant checks before saving. Self-validating domain objects report
  corrupted data immediately; unvalidated ones end in incorrect states.
- **DDH-66.** Combining compile- and runtime validation, objects over primitives,
  self-validation, design by contract, ADTs and typestates makes illegal states hard or
  impossible, at the cost of extra boilerplate.

#### Guarding vs validating [Guarding vs validating]

- **DDH-67.** Validation happens twice on purpose: at the boundary (DTO decorators) and inside
  domain objects. The second is guarding. Guarding is a failsafe mechanism - the domain sees it
  as invariants of an always-valid model; validation is a filtration mechanism - the outer
  layers see it as input rules. An invariant violation in the domain is exceptional and throws;
  incorrect external input is not exceptional and is denied with error messages at the boundary.
- **DDH-68.** Once filtered input enters the always-valid boundary it is assumed valid; a
  violation there is a bug, and guards reveal it (fail fast, runtime exceptions). Domain classes
  MUST always guard themselves against becoming invalid. A small guard library (null/undefined,
  empty objects and arrays, length ranges) MAY be created for it.
- **DDH-69.** Not all validation belongs in a single domain object: it validates only the rules
  shared by all contexts; context-dependent, cross-field and cross-entity rules are handled
  where they belong.
- **DDH-70.** AVOID tying the domain to general-purpose validation libraries; an exception is a
  very specific library validating one thing (a bitcoin address) used by one or a few value
  objects. Full sanity checks with a validation framework belong outside the domain (DTO
  decorators); inside the domain do basic guarding (null, length, simple regexp) plus business
  rules. Be careful with custom regexps (email): use them only for simple always-true rules
  (an email contains `@`) and leave hard validation to the library, to avoid conflicts between
  the boundary's rules and the domain's. Passing a validation schema into a value object is
  possible but adds complexity; for smaller projects a validation framework alone may be more
  appropriate - it is a trade-off.

### Domain errors [Domain Errors]

- **DDH-71.** The core and the domain MUST NOT throw HTTP exceptions or statuses: they do not
  know whether they run under an HTTP controller, a message handler or a CLI. Create custom
  error classes with error codes instead.
- **DDH-72.** Exceptions are for exceptional situations; many domain errors are part of the
  business logic ("seat already booked, choose another") and deserve explicit handling. For
  those, returning explicit error types is better than throwing: it documents each error a
  method can return in its signature, makes handling and tracing easier.
- **DDH-73.** Model errors as algebraic data types and return a Result (Success/Failure, an
  `Either`-like monad): a sum type per use case (`type CreateUserError = UserAlreadyExistsError |
IncorrectUserAddressError`), `Result<UserEntity, CreateUserError>` as the return type, `Err(...)`
  returned instead of thrown, and a `match` at the boundary that maps each error to its
  transport meaning (409, 400, rethrow unknown as 500). Throwing makes errors invisible to the
  consumer until runtime; returning adds boilerplate but makes errors explicit and lets each
  caller propagate, transform, enrich or recover (retry).
- **DDH-74.** Non-recoverable technical errors (connection failed, out of memory) MUST be
  thrown, not returned: returning them continues execution in an incorrect state, against
  fail-fast, and can cause security issues. Decide per error: likely recoverable -> Result;
  likely unrecoverable -> throw.
- **DDH-75.** Libraries: `oxide.ts` (Result/Option, `match`, `unwrap`) or `@badrap/result`. A
  CLI controller MAY simply `.unwrap()` a Result (throwing on error) since it needs no status
  code; the HTTP controller matches and maps.
- **DDH-76.** Every exception carries a `code` string (`USER.ALREADY_EXISTS`,
  `GENERIC.NOT_FOUND`): `instanceof` cannot cross a process boundary, and shared code constants
  let a receiving side recognise the error. Exceptions MAY carry non-sensitive `metadata` for
  debugging and a `correlationId`; they serialise through `toJSON()` (never return the stack
  trace to the user in production). Generic application exceptions (argument invalid / not
  provided / out of range, not found, conflict, internal) live in a shared library, domain
  errors with the module.

### Libraries inside the core [Using libraries inside Application's core]

- **DDH-77.** Injecting every library instead of importing it is not always practical;
  single-responsibility libraries that help implement domain logic (working with numbers) MAY be
  imported directly.
- **DDH-78.** A library imported into the core MUST NOT expose: access to out-of-process
  resources (HTTP, database); functionality irrelevant to the domain (frameworks, ORMs,
  loggers); randomness (random ids, timestamps - they make tests unpredictable, though in
  TypeScript mocking without DI mitigates it). A library that changes often or has many
  dependencies of its own most likely does not belong in the domain.
- **DDH-79.** Wrap such libraries in an anti-corruption layer (adapter or facade). Tolerate a
  library in the centre only when it is tied to one or a few domain objects; AVOID general-purpose
  libraries scattered across many domain objects, which become impossible to replace.
- **DDH-80.** Frameworks want control and are hard to replace once the application is glued to
  them: use them in the outer layers (infrastructure) and keep the domain clean of them when
  possible - the domain layer should be extractable with a new infrastructure built around it
  without breaking business logic. NestJS decorators (`@Inject()`) are not very intrusive and
  are acceptable; keep frameworks in boundaries.
- **DDH-81.** Offload irrelevant responsibilities from the core and minimise dependencies in
  general (fewer dependencies, fewer errors and security holes), without removing all of them
  (replicating battle-tested libraries is worse); the balance requires experience.

## Interface adapters [Interface Adapters]

- **DDH-82.** Interface (driving/primary) adapters take input from the user, repackage it for
  the use cases and entities, and repackage the output for the user (a person or another
  server). They contain controllers, request/response DTOs and, if needed, views.

### Controllers [Controllers]

- **DDH-83.** A controller is the user-facing API that parses requests, triggers business
  logic and presents the result. One controller per use case is considered good practice; in
  NestJS, controllers are a good place for OpenAPI/Swagger decorators.
- **DDH-84.** One controller per trigger type MAY give clearer separation: an HTTP controller,
  a CLI controller, a message controller (microservice messages) for the same use case; with
  GraphQL, a resolver takes the controller's place. Only the user-facing layer changes; the
  whole core stays the same regardless of REST or GraphQL.

### DTOs [DTOs]

- **DDH-85.** Data from external applications is represented by DTOs - the contract between
  the API and its clients. A request DTO gives clients a contract for a correct request; a
  response DTO ensures clients receive only the described data, not everything the entity owns
  (prevents leaks).
- **DDH-86.** DTO contracts protect clients from internal data-structure changes: when internal
  models change (renamed fields, split tables) they are still mapped to the DTO. Breaking DTO
  changes ship as a new API version (`v2/users`) so slow clients keep working.
- **DDH-87.** Commands and DTOs stay separate even when their properties coincide: commands
  are serialisable method calls of the domain model; DTOs are data contracts whose purpose is
  backward compatibility for API clients (Khorikov, "Commands vs DTOs").
- **DDH-88.** DTOs SHOULD be data-oriented, not object-oriented - mostly primitives, flat data,
  no modelling.
- **DDH-89.** When returning a response, prefer whitelisting properties over blacklisting, so a
  newly added sensitive property cannot leak by omission.
- **DDH-90.** DTOs shared by several apps (front and back end, several services) MAY live in a
  shared directory, a git submodule or a separate package.
- **DDH-91.** Request/response DTO classes are a good place for validation and sanitisation
  decorators (class-validator, class-sanitizer; gather all validation errors before returning
  them - the Notification pattern, class-validator's default) and for Swagger/OpenAPI
  decorators. Without decorators a DTO MAY be a plain interface. Data MAY be transformed into a
  DTO by a separate mapper or in the DTO's constructor.
- **DDH-92.** Local DTOs (never letting domain objects leave the domain, returning a plain DTO
  from the service) are not used in the reference, to avoid extra mapping and boilerplate
  (Fowler on local DTOs). They MAY be justified to decouple modules properly - when one module
  queries another, do not leak entities between them.

## Infrastructure layer [Infrastructure layer]

- **DDH-93.** Infrastructure encapsulates technology: repositories, message brokers, I/O
  services, framework code, every replaceable detail. It is the most volatile layer, kept as far
  as possible from the stable domain so components can be changed or swapped.

### Adapters [Adapters]

- **DDH-94.** Infrastructure (driven/secondary) adapters let the system interact with external
  systems (persistence, brokers, mail, third-party APIs); they MAY also mediate between domains
  in one process to avoid coupling; they implement ports and MUST NOT be called directly - only
  through ports; they MAY serve as an anti-corruption layer for legacy code.
- **DDH-95.** An adapter SHOULD have: a port in the application/domain layer it implements; a
  mapper from and to the domain (if needed); a DTO/interface for received data; a validator
  ensuring incoming data is not corrupted (DTO decorators or value objects).

### Repositories [Repositories]

- **DDH-96.** A repository is an abstraction over a collection of entities living in a
  database: it centralises data access and hides where data lives (database, file, other
  source). It decouples the persistence technology from the domain model (Fowler: an
  intermediary between the domain and data mapping, acting like an in-memory set of domain
  objects; clients build queries declaratively).
- **DDH-97.** Flow: the repository receives a domain entity from the service, maps it to the
  database/ORM format, performs the operation, maps back to the entity and returns it. The core
  depends on repository ports, not implementations - data retrieval stays technology-agnostic.
- **DDH-98.** Abstracting the database behind interfaces is recommended by most publications
  but not always useful in practice: most projects never change database technology, and an
  abstraction keeps you from using the database's full potential (Khorikov, "Should you abstract
  the database?"). The reference abstracts repositories with a generic port as an example; think
  before copying that.
- **DDH-99.** A generic base repository (CRUD: insert, findOneById, findAll, findAllPaginated,
  delete, transaction) is extended by a specific repository that implements the entity's own
  operations. In the read model / query handlers a repository is not required (CodeOpinion).

### Persistence models [Persistence models]

- **DDH-100.** One entity for both domain logic and database concerns leads to a
  database-centric architecture; in DDD the domain model and the persistence model are
  separated. Entities are shaped for domain logic and may not suit the database; persistence
  models (ORM entities, schemas, read/write models) are shaped for the database; the domain MUST
  NOT know about persistence models.
- **DDH-101.** Several models MAY coexist: the domain's (entities, aggregates, value objects)
  and the persistence layer's (ORM, schemas, read/write models under CQRS). Separation lets the
  database be normalised/denormalised or changed without refactoring the domain.
- **DDH-102.** Separating the two models MAY be overkill for smaller applications (mappers and
  abstractions to maintain); weigh it. A persistence model has a corresponding mapper
  (domain -> persistence and back; the reference's mapper also builds the response DTO).
- **DDH-103.** For smaller projects an ORM (TypeORM) MAY do; for more complex ones ORMs are not
  flexible or performant enough, so the reference uses raw queries through Slonik with runtime
  validation of rows by zod schemas.

### Other infrastructure [Other things that can be a part of Infrastructure layer]

- **DDH-104.** Also infrastructure: framework files, the application logger implementation,
  infrastructure events, periodic cron jobs/task launchers, other technology files.

## Other recommendations [Other recommendations]

- **DDH-105.** Different projects have different requirements: implement some principles in
  simplified form, skip others; follow YAGNI, do not over-engineer. SOLID and complex
  architecture can conflict with YAGNI and KISS; a pragmatic programmer combines principles with
  common sense. Principles are hint signs that need experience to apply; they do not say when
  you went too far.
- **DDH-106.** Before implementing any pattern, analyse whether its benefit is worth the extra
  complexity ("we need to know the price of a pattern is worth paying"). Do not follow
  practices because books say so; sometimes rewriting from scratch beats fitting patterns in.
  Patterns are tools, not dogmas. Still: it is easier to refactor over-design than no design.
- **DDH-107.** For smaller APIs: separating code into modules/layers/use cases, controllers/
  services/entities, respecting boundaries and DI is a good idea for any project; an object for
  every primitive, value objects, separated domain and persistence models can over-complicate
  data-centric projects with little business logic. DDD is for complex business logic; for
  glue-between-database-and-client applications consider MVC, better suited to CRUD.

### Behavioural testing [Behavioral Testing]

- **DDH-108.** Behavioural testing (BDD, black box) tests external behaviour; DDD's ubiquitous
  language plays nicely with it. Cucumber with Gherkin gives tests structure and meaning so
  non-developers can define steps; in Node use `@cucumber/cucumber` or `jest-cucumber`. The
  reference pairs a `.feature` file with an `*.e2e-spec.ts` implementing its steps (shared step
  definitions, a test context carrying the latest request and response, an API client, an
  Artillery load-test file per use case), and refuses to run e2e tests against a database whose
  name does not contain `test`.

### Folder and file structure [Folder and File Structure]

- **DDH-109.** AVOID the layered folder structure (`controllers/`, `services/`, `repositories/`
  at the top): it makes navigation harder and leads to tight coupling and spaghetti.
- **DDH-110.** Dividing by module (each with its controller, service, repository) is better but
  files grow to hundreds of lines and merge conflicts grow with them.
- **DDH-111.** Divide each module further by sub-components (use cases): `User/CreateUser/
{Controller, Service, DTO}`, `User/UpdateUser/...`, with `UserRepository` and `UserEntity`
  shared at the module level - the project reveals its features from the directory names,
  related files are close together, each feature is encapsulated and can take localised
  decisions. Shared files (entities, repositories, shared DTOs, interfaces) sit outside the
  feature directory because several sub-components use them.
- **DDH-112.** This is the Common Closure Principle: place classes that experience says change
  together into the same component. The main recommendations: separate the application into
  modules; keep files that change together close together (CCP and vertical slicing); group
  files by behaviour that changes together, not by the type of functionality; keep files reused
  by several components apart; respect boundaries - keeping files together does not let inner
  layers import outer ones; AVOID many nested folders; move files around until it feels right.
  The structure is an example; choose what suits the project.
- **DDH-113.** Reference layout per module: `commands/<use-case>/` (controller(s), service =
  command handler, request DTO, command object), `queries/<use-case>/` (controller, query +
  query handler, request DTO), `domain/` (entity, errors, types, `events/`, `value-objects/`),
  `database/` (repository port, repository + persistence schema), `dtos/` (response DTOs),
  `application/event-handlers/` (domain event handlers), `<module>.module.ts`,
  `<module>.di-tokens.ts`, `<module>.mapper.ts`. Shared: `src/libs/` (`ddd/` base classes,
  `db/` base repository, `api/` response bases, `exceptions/`, `guard.ts`, `ports/`,
  `decorators/`, `types/`, `utils/`, `application/context` request context), `src/configs/`.

### File names [File names]

- **DDH-114.** Give files a descriptive type suffix after a dot - `*.service.ts`,
  `*.entity.ts`, `*.command.ts`, `*.query-handler.ts`, `*.repository.port.ts`,
  `*.value-object.ts`, `*.domain-event.ts`, `*.request.dto.ts`, `*.response.dto.ts`,
  `*.http.controller.ts`, `*.errors.ts`, `*.mapper.ts`, `*.di-tokens.ts` - so what a file does
  is visible and fuzzy search finds it (Angular style guide). Alternatively use class names as
  file names with descriptive suffixes.

### Enforcing architecture [Enforcing architecture]

- **DDH-115.** Use tools that analyse and validate dependencies between files and layers so
  the team adheres to the architecture: dependency-cruiser (JavaScript/TypeScript), ArchUnit
  (Java). The reference config forbids: domain -> api layer, domain -> application layer (except
  the request context), domain -> infrastructure (except ports), infrastructure -> api layer,
  commands/queries/services -> api layer; plus the preset rules: no orphans, no deprecated core
  modules, no deprecated npm packages, no dependency outside `package.json`, nothing
  unresolvable, no duplicate dependency types, no dependency on test folders or spec files from
  production code, no dev dependency from `src`, peer and optional dependencies flagged. Layers
  are identified by folder names (`controller`, `dtos`, `request`, `response`, `application`,
  `infrastructure`, `infra`, `database`, `repository`, `domain`) and by file suffixes
  (`.dto.ts`, `.controller.ts`, `.resolver.ts`, `.service.ts`, `.entity.ts`, `.aggregate.ts`,
  `.domain-event.ts`, `.value-object.ts`, `.port.ts`). A dependency graph can be generated.

### Inheritance [Prevent massive inheritance chains]

- **DDH-116.** Classes meant to be extended are designed for it and usually `abstract`; a class
  not designed for extension is made `final` (TypeScript has no `final`; the reference uses a
  decorator that throws when a subclass is instantiated). AVOID inheritance deeper than 1-2
  levels (refactoring harder, bad design); use composition instead.

## The base classes, as the reference implements them [src/libs]

These are what the README's rules look like in code; the vendored sources are the authority.

- **DDH-117.** `Entity<Props>`: constructed from `{ id, props, createdAt?, updatedAt? }`;
  validates props (non-empty, an object, at most 50 keys), sets timestamps, calls the abstract
  `validate()` at construction; `id` is set by the concrete entity (`protected abstract _id`)
  so the id type can differ per entity; `equals()` compares ids; `getProps()` returns a frozen
  copy including id and timestamps; `toObject()` converts nested entities/value objects to
  plain data; `validate()` is abstract and is also called by the repository before every write.
- **DDH-118.** `AggregateRoot<Props>` extends `Entity`: keeps a private list of domain events,
  `addEvent()` (protected), `clearEvents()`, `publishEvents(logger, eventEmitter)` which emits
  each event by its class name and clears the list.
- **DDH-119.** `ValueObject<T>`: props are either a domain primitive `{ value }` or an object;
  the constructor refuses empty props, calls the abstract `validate(props)`; `equals()` is
  structural (JSON); `unpack()` returns the raw value or a frozen plain copy.
- **DDH-120.** `DomainEvent`: `id` (random UUID), `aggregateId`, `metadata` (`timestamp`,
  `correlationId` from the request context, optional `causationId`, `userId`); refuses empty
  props.
- **DDH-121.** `Command`: `id` (random UUID unless given), `metadata` (`correlationId` from the
  request context, optional `causationId`, `timestamp`, `userId`); `CommandProps<T>` omits id and
  metadata; refuses empty props. `QueryBase` is empty; `PaginatedQueryBase` carries `limit`
  (default 20), `page` (default 0), `offset` (page x limit), `orderBy` (default `desc`).
- **DDH-122.** `RepositoryPort<Entity>`: `insert`, `findOneById` (returns an `Option`),
  `findAll`, `findAllPaginated`, `delete`, `transaction(handler)`. `Paginated<T>` carries
  `count`, `limit`, `page`, `data`. `Mapper<Entity, DbRecord, Response>`: `toPersistence`,
  `toDomain`, `toResponse`.
- **DDH-123.** `SqlRepositoryBase<Aggregate, DbModel>`: abstract `tableName` and zod `schema`;
  reads through `sql.type(schema)` with runtime row validation; `writeQuery()` validates every
  entity, logs the write with the request id, runs the statement and publishes the entities'
  domain events; `insert()` generates the INSERT from the persistence record and maps a
  unique-constraint violation to `ConflictException`; `transaction()` opens a pool transaction,
  stores the connection in the request context so nested repository calls join it, and clears
  it in `finally`; the `pool` getter returns the request's transaction connection when one is
  open.
- **DDH-124.** Request context (`nestjs-request-context`): a per-request `requestId`
  (correlation id, from the body or a 6-char nanoid, set by an interceptor) and the current
  transaction connection; the exception interceptor attaches the correlation id to every error
  and reshapes class-validator errors into the API error response (`statusCode`, `message`,
  `error`, `correlationId`, `subErrors`).
- **DDH-125.** `ExceptionBase extends Error`: abstract `code`, `correlationId` from the
  context, optional `cause` and non-sensitive `metadata`, `toJSON()`; generic codes
  `GENERIC.ARGUMENT_INVALID`, `GENERIC.ARGUMENT_OUT_OF_RANGE`, `GENERIC.ARGUMENT_NOT_PROVIDED`,
  `GENERIC.NOT_FOUND`, `GENERIC.CONFLICT`, `GENERIC.INTERNAL_SERVER_ERROR`; domain errors such
  as `USER.ALREADY_EXISTS`, `WALLET.NOT_ENOUGH_BALANCE` extend it with a static message.
- **DDH-126.** `Guard`: `isEmpty(value)` (numbers and booleans never empty; undefined/null,
  empty objects, empty or all-empty arrays, empty string are empty) and `lengthIsBetween(value,
min, max)` for numbers, strings and arrays.
- **DDH-127.** The example `user` module: `UserEntity.create()` assigns a UUID, defaults the
  role, adds `UserCreatedDomainEvent`; state changes go through intention-revealing methods
  (`makeAdmin`, `updateAddress`, `delete`) that each add a domain event; `Address` is a value
  object with length guards; `CreateUserService` (a `@CommandHandler`) builds the entity, runs
  `repo.transaction(() => repo.insert(user))`, returns `Ok(id)` or `Err(UserAlreadyExistsError)`
  on a conflict; the HTTP controller matches the Result to 409/400/500; the query handler reads
  rows straight from the pool and returns a `Paginated` result; `UserMapper` whitelists the
  response fields; the module wires controllers per trigger type, handlers, mappers and
  repositories (`{ provide: USER_REPOSITORY, useClass: UserRepository }`). The `wallet` module
  reacts to `UserCreatedDomainEvent` with an `@OnEvent` handler that creates the wallet; the
  wallet entity's `withdraw()` returns a Result and `validate()` throws on a negative balance.
- **DDH-128.** Tooling in the reference: `.prettierrc` = `{ singleQuote: true, trailingComma:
"all" }`; ESLint on `@typescript-eslint/recommended` + prettier with `explicit-module-boundary-types`,
  `no-non-null-assertion`, `no-unused-vars`, `no-misused-new` as errors, `no-explicit-any` off,
  and `no-restricted-syntax` forbidding labels ("a form of GOTO"), `with`, and property setters
  ("Property setters are not allowed"); strict TypeScript with path aliases (`@src`, `@modules`,
  `@config`, `@libs`, `@tests`); Jest unit tests `*.spec.ts`, e2e `*.e2e-spec.ts` with a global
  setup; dependency-cruiser as in DDH-115.
