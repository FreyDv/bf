# Domain-Driven Hexagon - why the rules exist

The reasoning of the README behind each rule group of
[`.claude/rules/architecture-rules.md`](../../../.claude/rules/architecture-rules.md), in plain terms and
without a technology. Read it when a rule feels heavy, or before proposing a deviation: an ADR that
permits one must answer the reason given here.

## What the architecture is

A combination of Domain-Driven Design, Hexagonal (ports and adapters), Secure by Design, Clean and Onion
architecture, SOLID and classic design patterns. The business rules sit in the centre; everything that
can change (database, framework, broker, vendor) sits outside and plugs in through interfaces.

Data flows left to right: a request, CLI call or event reaches a **driving adapter** as a plain DTO; the
adapter turns it into a **command or query** and hands it to an **application service**; the service
loads aggregates through **ports**, calls their methods (domain logic), and saves through ports; the
**infrastructure** maps data to its own format, stores or retrieves, and maps back to domain objects;
the service returns data or confirmation; the adapter presents it. Each layer owns its own logic and its
building blocks follow the single-responsibility principle.

**Pros.** Independent of frameworks, technologies and databases, which can be plugged and unplugged with
little effort; easily testable and scalable; more secure because some security principles are baked into
the design; several teams can work without stepping on each other; the cost of adding features stays
small and constant as the system grows; split along bounded contexts, pieces are easy to turn into
microservices.

**Cons.** Sophisticated: it needs a firm grasp of SOLID, Clean/Hexagonal and DDD and, in practice, an
expert to keep it from drifting and collecting debt. Up-front complexity (boilerplate, abstractions,
mapping) makes it ill-suited to simple CRUD. This is why PRG-1/PRG-2 force a classification of every
module instead of applying everything blindly, and why PRG-3/PRG-4 forbid speculative abstraction.

## STR - structure

Modules are boxes of related business logic: they encapsulate cohesive rules, and independent modules
are replaceable. Small modules can be deleted and rewritten in days (the "art of destroying software"):
when requirements change, changing small modules is easier than changing a big program. Putting each use
case in its own folder (vertical slice) keeps what changes together close together; layered top-level
folders force you to hop between directories for every feature and lead to tight coupling and spaghetti
code. A module-per-entity split is rejected because related entities belong together and unrelated ones
do not. Dotted suffixes make the role of a file visible, searchable by fuzzy search, and machine-checkable.

## DEP - dependency direction

Dependencies point inwards so that business logic never knows about technology. That is what makes it
testable with zero infrastructure and lets resources be swapped. Direct imports between modules create
tight coupling and turn the application into a big ball of mud; a facade, a mediator, or messages keep
them loose. Frameworks want control and are hard to replace once the code is glued to them; libraries
that expose I/O, randomness or frequently-changing APIs make the core unpredictable and hard to test. An
anti-corruption layer (adapter or facade) keeps a foreign model from leaking in. Fewer dependencies
means fewer defects and security holes, but re-implementing a battle-tested library is worse.

## APP - application layer

An application service is the use case: it orchestrates, it does not decide. Putting rules in services
makes entities anemic and scatters business knowledge. CQS makes code simpler to read (one thing changes,
another retrieves) and prepares for separate read and write models. A command signals intent; a command
returning business data blurs the separation, but returning an id or status is the practical compromise
(client-generated ids avoid even that). Commands that call commands create hidden chains; events make
the chain explicit. A query bypassing the domain is fine because reading has no invariants to protect.
Ports let use cases be tested with doubles, quicker and independent of the environment, and let
technology decisions wait; but a port without a reason is a "false abstraction" that only adds code.

## DOM - domain

Entities protect their invariants: an entity that can exist in an invalid state moves validation into
every caller. Aggregates draw a consistency boundary: referencing by id and keeping aggregates small
avoids locking and performance problems, and the boundary forces each relationship to be considered
carefully. Value objects remove primitive obsession, concentrate rules about a value in one place, give
code the vocabulary of the business, and make every argument valid by definition, which protects against
a whole class of bugs and vulnerabilities - at the cost of boilerplate, which is why DOM-V3 limits them
to values with rules. Domain events decouple aggregates: a side effect becomes a handler instead of more
code in the original service; used alone for long workflows they become impossible to follow, so a
mediator or process manager holds those. Transactions across aggregates keep data consistent but cause
contention; eventual consistency is the alternative. Illegal states made unrepresentable move rules from
runtime to compile time, which is faster feedback and safer.

## VAL - validation

Input validation is filtration: wrong external input is normal, not exceptional, and is rejected with all
errors listed. Domain guarding is a failsafe: once data is inside the always-valid boundary, a violation
means a bug, so it fails fast. Tying the domain to a general-purpose validation library spreads it
everywhere and makes a replacement painful. Custom regular expressions that try to fully validate things
like emails conflict with the boundary library, so only always-true rules belong in the domain.

## ERR - errors

The core does not know whether it is called from HTTP, a message handler or a CLI, so it cannot speak in
transport terms. Throwing hides errors from the caller until runtime; returning a typed result documents
every failure in the signature and lets callers decide to propagate, transform or retry. Returning
technical failures is dangerous because execution continues in an incorrect state. Error codes survive
serialisation across processes where class checks do not. Metadata ends up in logs, so it is never
sensitive.

## ADP / INF - adapters and infrastructure

Driving adapters are thin so that REST, GraphQL, CLI and messaging can all trigger the same core.
DTOs are contracts that shield clients from internal changes and enable versioning; whitelisting stops
data leaks when someone adds a field. Commands are not DTOs: commands are domain calls, DTOs are
compatibility contracts. Infrastructure is the most volatile layer, which is why it is kept farthest
from the stable domain. A separate persistence model means normalising or changing the database never
forces a domain rewrite; mapping costs code, so PRG-2 allows skipping it only for data-centric modules.
Whether to abstract the database at all is debated: most projects never change database technology, and
an abstraction can hide its power - hence INF-6 keeps repository ports for domain-rich aggregates and
PRG-3 governs everything else.

## ENF - enforcement

Rules that are not checked drift. A dependency-boundary tool turns the architecture into a build failure.
Deep inheritance makes refactoring hard; classes not designed for extension are sealed, and composition
replaces inheritance. The shared kernel stays small and free of domain concepts, otherwise it becomes the
new big ball of mud.

## TST - tests

Domain-Driven Design's ubiquitous language reads naturally as behaviour tests: black-box tests of what the
system does, defined from acceptance criteria, optionally in Given/When/Then so non-developers contribute.
Unit tests of the domain are possible only because it has no infrastructure; use-case tests need port
doubles; behavioural tests prove the wiring. A guard against running them on a non-test database prevents
destroying real data.

## Language-neutral worked example (the reference's "create user" slice)

```
user/                                   module (a domain concept)
  commands/create-user/
    create-user.http.controller         parse request DTO -> CreateUserCommand -> bus -> map Result to status
    create-user.cli.controller          same use case, other trigger (one adapter per trigger)
    create-user.request.dto             contract + boundary validation
    create-user.command                 intent (metadata: id, correlationId, ...)
    create-user.service                 handler: build aggregate, repo.transaction(insert) -> Ok(id) | Err(UserAlreadyExists)
  queries/find-users/
    find-users.query-handler            reads storage directly, returns paginated read data (no aggregate)
  domain/
    user.entity (aggregate root)        static create() validates + raises UserCreated; methods raise events; validate()
    value-objects/address               immutable, validates country/street/postal code
    events/user-created.domain-event    aggregateId + payload primitives
    user.errors                         UserAlreadyExists { code: 'USER.ALREADY_EXISTS' }
  database/
    user.repository.port                findOneById, insert, transaction, findOneByEmail
    user.repository                     maps aggregate <-> persistence row, validates rows, publishes events after insert
  dtos/user.response.dto                whitelist of fields
  user.mapper                           toPersistence / toDomain / toResponse
wallet/application/event-handlers/
  create-wallet-when-user-is-created    reacts to UserCreated in the same process, same transaction
```
