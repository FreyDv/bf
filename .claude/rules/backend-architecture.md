---
paths:
  - 'apps/api/**'
  - 'apps/auth/**'
  - 'apps/order/**'
  - 'apps/course/**'
  - 'apps/billing/**'
  - 'apps/admin/**'
  - 'apps/ai/**'
  - 'packages/shared/**'
  - 'packages/events/**'
  - 'packages/db/**'
  - 'packages/trpc/**'
---

# Backend architecture - hard rules (Domain-Driven Hexagon, as bound by ADR-025)

Loaded whenever a session touches a NestJS service or a shared backend package. The full
mapping with the reasoning is `docs/standards/domain-driven-hexagon/bf-mapping.md`; the source
rules are `docs/standards/domain-driven-hexagon/rules.md` (DDH-n). `pnpm deps` enforces the
dependency rules; a violation is a failed build, not a style note.

1. **Layout.** A service = one bounded context. `src/modules/<module>/` with
   `commands/<use-case>/`, `queries/<use-case>/`, `domain/`, `application/{ports,event-handlers}`,
   `infrastructure/`, `<module>.module.ts`, `<module>.di-tokens.ts`. New code starts in this
   shape; nothing is added to the legacy flat `identity`, `invoices`, `courses` modules (backlog `ARCH-1`).
2. **Suffixes mark layers**: `.aggregate.ts .entity.ts .value-object.ts .domain-event.ts
.errors.ts .types.ts .domain-service.ts` (domain) / `.service.ts .command.ts .query.ts
.query-handler.ts .port.ts .domain-event-handler.ts .mapper.ts` (application) /
   `.repository.ts .adapter.ts` (infrastructure) / `.router.ts .controller.ts .dto.ts`
   (interface adapters).
3. **Dependencies point inwards.** `domain/` imports only `@bf/shared/ddd`, `@bf/shared/constants`,
   Node built-ins and pure helpers - never `@nestjs/*`, `drizzle-orm`, `pg`, `express`,
   `@trpc/*`, `nestjs-trpc`, `@bf/contracts`, `@bf/db`, `@bf/events`, `@bf/trpc`, `src/db`,
   `src/app`, its own `application/` or `infrastructure/`, or another module. `application/`
   never imports `infrastructure/` or Drizzle. Routers never import repositories. No module
   imports another module's internals: cross-context = tRPC client behind a port, or an
   integration event through the outbox.
4. **Aggregates own their invariants.** `static create()` validates and raises the creation
   event; every state change is an intention-revealing method; no public setters (ESLint forbids
   property setters); `validate()` exists and the repository calls it before every write; child
   entities are reached through the root; other aggregates are referenced by id.
5. **Value objects** (`ValueObject<T>` from `@bf/shared/ddd`) for every concept with a rule
   (money, email, slug, quantity, date range); immutable, getters only, factory validates;
   serialised to primitives before a DTO, an event payload or a Drizzle row.
6. **Errors.** Business failures return `Result` (`ok()`/`err()` from `@bf/shared/ddd`) carrying a
   `DomainException` subclass with a stable code (`ORDER.ALREADY_PAID`); technical failures
   throw; no `HttpException`/`TRPCError` below the router. The router maps `err` to the tRPC
   code and rethrows unknown errors.
7. **CQS.** Commands change state through `@nestjs/cqrs` `CommandBus`; queries read Drizzle
   directly in `query-handler.ts` and return contract output shapes; a command handler never
   executes another command (Command -> Event -> Command).
8. **Transactions and events.** `aggregate.pullDomainEvents()` after persisting; the aggregate
   write and `OutboxEventPublisher.publishAll(events, tx)` share one Drizzle transaction; event
   `type` is `<context>.<aggregate>.<event>`.
9. **Contracts.** Every procedure declares `input` and `output` schemas imported from
   `@bf/contracts/<svc>/schemas.ts`; `router.ts` is generated (`pnpm contracts:generate`) and
   never edited; response shapes are whitelists built by the mapper. REST only for the
   recorded exceptions (auth token endpoints, `/health`); anything else needs an ADR.
10. **Persistence model != domain model.** The Drizzle table in `src/db/schema.register.ts` is
    the persistence model; `<aggregate>.mapper.ts` converts both ways; migrations are generated
    and committed; the repository translates unique violations into `ConflictDomainException`.
11. **Tests at three levels** per slice: domain unit (no Nest, no DB), use case with in-memory
    adapters, behaviour (`test/*.e2e-spec.ts`) from the capability spec's acceptance criteria.
    The spec moves in the same PR as the code (coupling guard).
12. **Before "done"**: `pnpm deps && pnpm lint && pnpm typecheck && pnpm test` for the app,
    `pnpm contracts:check` if a router changed, and the review checklist in
    `bf-mapping.md` section 10 (or run `bf-architecture-review`).
