---
name: bf-new-module
description: Use when a backend service needs a new domain module (a new aggregate or bounded concept such as orders, enrolments, invoices) in apps/auth, order, course, billing, admin or ai - the user says "add a module for X", "we need to model X in <service>", "create the X aggregate". Scaffolds the Domain-Driven Hexagon shape this repository binds (domain, application ports, infrastructure, module wiring, DI tokens, tests) and says what each file must contain. Not for a single new procedure on an existing module (that is bf-new-use-case).
---

# bf-new-module

Scaffold a module in the canonical layout of
[`docs/standards/domain-driven-hexagon/bf-mapping.md`](../../../docs/standards/domain-driven-hexagon/bf-mapping.md)
(section 2) and the hard rules of `.claude/rules/backend-architecture.md`. Read both before
the first file. The reference implementation to imitate is the vendored `user` module under
`docs/standards/vendor/domain-driven-hexagon/src/modules/user/`, translated to this stack.

## Before writing

1. **Which capability spec owns this?** A module exists to implement a capability in
   `specs/<capability>/spec.md`. No spec, or a spec with open `[NEEDS ...]` markers -> stop,
   run `/spec-specify` / `/spec-clarify` first (R8, R12). Add the module's globs to
   `specs/capability-map.json` in the same PR (R11).
2. **Which service?** One bounded context per service; a module never spans two services. If
   the concept needs data another service owns, that is a tRPC client behind a port or an
   integration event, not a shared table.
3. **Name it in the ubiquitous language** of the spec (DDH-5, DDH-23); folder and aggregate
   share the name (`orders/` -> `Order`).

## Files to create (replace `<svc>`, `<module>`, `<Aggregate>`)

```
apps/<svc>/src/modules/<module>/
  <module>.module.ts                         imports CqrsModule; providers: handlers, mappers,
                                             { provide: <AGGREGATE>_REPOSITORY, useClass: Drizzle<Aggregate>Repository }
  <module>.di-tokens.ts                      export const <AGGREGATE>_REPOSITORY = Symbol.for('bf.<svc>.<module>.<AGGREGATE>_REPOSITORY')
  domain/<aggregate>.aggregate.ts            class <Aggregate> extends AggregateRoot<<Aggregate>Id>: private constructor, static create(): Result,
                                             intention-revealing methods returning Result, validate(), raise() per change
  domain/<aggregate>.types.ts                props interfaces, enums, the branded id type
  domain/<aggregate>.errors.ts               class <Aggregate><Failure> extends DomainException with a static readonly code '<MODULE>.<FAILURE>'
  domain/value-objects/<name>.value-object.ts  one per concept with a rule (getters only, static of()/create() validates)
  domain/events/<aggregate>-<event>.domain-event.ts  payload type + createDomainEvent factory, type '<svc>.<aggregate>.<event>'
  application/ports/<aggregate>.repository.port.ts   interface: findById, save(aggregate, tx), ... - only what the use cases need
  application/<aggregate>.mapper.ts          toDomain(row), toPersistence(aggregate), toOutput(aggregate) (whitelist)
  infrastructure/<aggregate>.drizzle.repository.ts   @Injectable, @InjectDrizzle(), implements the port, calls aggregate.validate() before writes,
                                             maps unique violations to ConflictDomainException
apps/<svc>/src/db/schema.register.ts         add the table(s) - the persistence model; then pnpm --filter <svc> db:generate
packages/contracts/src/<svc>/schemas.ts      the zod input/output schemas the first use cases will need (see bf-new-use-case)
apps/<svc>/src/modules/<module>/domain/<aggregate>.aggregate.spec.ts   unit tests: create(), each method, validate()
```

Then register the module in `apps/<svc>/src/trpc.module.ts` (the nestjs-trpc CLI reads it)
and in `app.module.ts` if it is not imported transitively.

## Rules that bite

- `domain/` imports only `@bf/shared/ddd`, `@bf/shared/constants`, Node built-ins
  (`node:crypto` for ids is fine) and pure helpers - never NestJS, Drizzle, `@bf/contracts`,
  another module (`pnpm deps` fails otherwise).
- No public setters; no no-arg constructors; `create()` validates and raises the creation
  event; `validate()` throws `InvariantViolation` only for rules that must always hold.
- Value objects never leave the domain unserialised (DTOs, events, rows carry primitives).
- A business failure is `err(new <Aggregate><Failure>())`; a technical failure throws.
- The repository port is shaped by the use cases, not by the table (DDH-20); no generic base
  repository until two aggregates need the same shape (DDH-22).

## Done when

- `pnpm --filter <svc> deps lint typecheck test` pass; `pnpm db:check` and `pnpm
  contracts:check` pass if you touched the schema or contracts.
- The capability spec names the module's data contract verbatim (table, columns, enums) and
  moved in the same PR; `node scripts/spec-guard.mjs --audit --block` passes.
- `docs/ARCHITECTURE.md` lists the new component if it changed a boundary or a data owner.
- Run `bf-architecture-review` on the diff before `pre-pr-review`.
