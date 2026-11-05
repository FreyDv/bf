# Domain-Driven Hexagon applied to this repository

How every rule of [`rules.md`](rules.md) lands in a bf backend service - NestJS 12, nestjs-trpc
(contract-first through `@bf/contracts`), Drizzle on one Postgres database per service,
`@nestjs/cqrs`, the outbox in `@bf/events`, and the building blocks `@bf/shared` already ships.
This is the binding form of the architecture for every app under `apps/` except the two
Next.js front ends; ADR-025 records the decision, `.claude/rules/backend-architecture.md`
carries the hard rules into every session that edits backend code, and `pnpm deps`
(dependency-cruiser) enforces the boundaries. Where this repository deliberately differs from
the reference, the difference is named here and nowhere else.

## 1. What is binding, what is adapted, what is dropped

| Reference rule                                                                | Status here          | How                                                                                                                                                                         |
| ----------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modules, vertical slices, CCP, file suffixes (DDH-5..9, 109..114)             | **binding**          | the canonical layout in section 2                                                                                                                                           |
| Dependencies point inwards; ports and adapters (DDH-19..22, 93..95)           | **binding**          | section 3; `pnpm deps` fails the build                                                                                                                                      |
| Entities, aggregates, value objects, invariants, guards (DDH-24..42, 54..70)  | **binding**          | `@bf/shared/ddd` base classes, section 4                                                                                                                                    |
| Domain events in-process + integration events through the outbox (DDH-43..52) | **binding, adapted** | `AggregateRoot.pullDomainEvents()` + `OutboxEventPublisher` inside the same Drizzle transaction; no in-memory event emitter yet (section 5)                                 |
| Commands/queries, CQS, a bus, Command -> Event -> Command (DDH-13..18)        | **binding**          | `@nestjs/cqrs` `CommandBus`/`QueryBus`; queries read Drizzle directly                                                                                                       |
| Result-typed domain errors, codes, no HTTP in the core (DDH-71..76)           | **binding, adapted** | `Result`/`ok`/`err` and `DomainException` from `@bf/shared/ddd`; mapping to tRPC errors at the router (section 6)                                                           |
| Controllers one per use case, per trigger type (DDH-83..84)                   | **adapted**          | the driving adapter is a tRPC **router** per use case; REST only where a contract with the outside world requires it (today: the auth token endpoints and `/health`)        |
| Request/response DTOs with validation decorators (DDH-85..92)                 | **adapted**          | the DTO contract is the zod schema pair in `@bf/contracts/<svc>/schemas.ts`; class-validator stays only on the few REST controllers                                         |
| Persistence model separate from the domain model + mapper (DDH-100..103)      | **binding**          | the Drizzle table (`schema.register.ts`) is the persistence model; a `<aggregate>.mapper.ts` converts both ways                                                             |
| Repository behind a port; generic base optional (DDH-96..99)                  | **binding, adapted** | a port per aggregate; no generic `RepositoryPort` base until a second aggregate needs the same shape (DDH-22, DDH-98)                                                       |
| Libraries and frameworks kept out of the domain (DDH-77..81)                  | **binding**          | the domain imports only `@bf/shared/ddd`, the standard library and pure helpers                                                                                             |
| Prettier `singleQuote` + `trailingComma: all` (DDH-128)                       | **binding**          | already the `@bf/config` preset (plus `printWidth: 100`, recorded in ADR-002)                                                                                               |
| ESLint: no setters, no labels, no `with` (DDH-128)                            | **binding**          | `@bf/config/eslint/nest.mjs` `no-restricted-syntax`; `explicit-module-boundary-types` stays off for NestJS decorators (backlog `ARCH-3` decides it)                         |
| `final` decorator, inheritance <= 2 levels (DDH-116)                          | **binding**          | composition first; the base-class chain is `Entity -> AggregateRoot -> <Aggregate>` and stops there                                                                         |
| Behavioural e2e tests with Gherkin (DDH-108)                                  | **adapted**          | acceptance criteria live in the capability spec (Given/When/Then) and are implemented as `test/*.e2e-spec.ts`; `jest-cucumber` is optional, not required (backlog `TEST-1`) |
| GraphQL resolvers, CLI controllers, message controllers                       | **dropped**          | no GraphQL, no CLI, no broker consumer exists; a message controller returns when the inbox consumer lands (ADR-005/021)                                                     |
| Slonik raw SQL                                                                | **replaced**         | Drizzle query builder with the typed table as the schema (ADR-003/018)                                                                                                      |
| Primitive obsession: an object for every primitive (DDH-57..62)               | **adapted**          | a value object for every concept **with a rule** (money, email, slug, date range, quantity); plain branded types for ids; no wrapper for a primitive with no rule           |

## 2. The canonical module layout

One NestJS service = one bounded context (`apps/<svc>`). Inside it, one folder per **module**
(an important domain concept), each with vertical slices per use case:

```
apps/<svc>/src/
  main.ts                           bootstrap through @bf/server (never business logic)
  trpc.module.ts                    TRPCModule.forRoot + every <module>.module.ts (the nestjs-trpc CLI reads this file)
  app/app.module.ts, env.schema.ts  composition root, zod env schema
  db/schema.register.ts             the Drizzle tables = the persistence model of the whole service (one database)
  modules/<module>/
    <module>.module.ts              wires routers, handlers, ports -> adapters, mappers
    <module>.di-tokens.ts           Symbol.for('bf.<svc>.<module>.<PORT>') tokens for every port
    commands/<use-case>/
      <use-case>.router.ts          driving adapter: @Router + @Mutation({ input, output }) from @bf/contracts
      <use-case>.command.ts         the command object (intent + metadata)
      <use-case>.service.ts         @CommandHandler: the application service for this use case
    queries/<use-case>/
      <use-case>.router.ts          @Router + @Query({ input, output })
      <use-case>.query.ts           the query object
      <use-case>.query-handler.ts   @QueryHandler: reads Drizzle directly, no domain objects
    domain/
      <aggregate>.aggregate.ts      extends AggregateRoot from @bf/shared/ddd
      <entity>.entity.ts            child entities (local identity)
      value-objects/<name>.value-object.ts
      events/<aggregate>-<event>.domain-event.ts   createDomainEvent(...) factories + payload types
      <aggregate>.errors.ts         DomainException subclasses with stable codes
      <aggregate>.types.ts          props interfaces, enums
      services/<name>.domain-service.ts            only when logic spans several aggregates
    application/
      ports/<name>.port.ts          interfaces the use cases depend on (repository, clock, mailer, llm, storage, other service)
      event-handlers/<when-x>.domain-event-handler.ts
      <aggregate>.mapper.ts         domain <-> persistence row <-> contract output
    infrastructure/
      <aggregate>.drizzle.repository.ts   implements the repository port with the service's Drizzle instance
      <name>.<tech>.adapter.ts            other adapters (tRPC client to another service, S3, OpenAI, clock)
  modules/health/                   health.router.ts (every service exposes health.ping)
test/
  <use-case>.e2e-spec.ts            behaviour tests from the spec's acceptance criteria
  jest-e2e.config.cjs, setup-env.ts
```

Rules of the layout (DDH-5..9, 109..114 made concrete):

- **One concept per module, several aggregates allowed inside it** when their rules are
  related (DDH-32). A module that needs another module's data gets it through that module's
  **public port** (`application/ports` exported from the module) or through a domain event;
  never through its `domain/` or `infrastructure/` imports (DDH-7/8).
- **One slice per use case.** A slice holds everything only it needs: router, command/query,
  handler, slice-local types. What several slices share (the aggregate, the mapper, the ports)
  lives one level up (DDH-111/112).
- **Suffixes are the layer markers** (DDH-114) and dependency-cruiser reads them:
  `*.aggregate.ts | *.entity.ts | *.value-object.ts | *.domain-event.ts | *.errors.ts |
*.types.ts | *.domain-service.ts` = domain; `*.service.ts | *.command.ts | *.query.ts |
*.query-handler.ts | *.port.ts | *.domain-event-handler.ts | *.mapper.ts` = application;
  `*.repository.ts | *.adapter.ts` = infrastructure; `*.router.ts | *.controller.ts |
*.dto.ts` = interface adapters.
- **Flat over nested** (DDH-112): no folder deeper than `modules/<module>/<layer>/<group>/`.
- **New code follows this layout from its first file.** The existing `apps/auth/src/modules/
identity` (a flat `controller + services` module from the skeleton phase) is migrated under
  backlog `ARCH-1`; until then it is the one recorded exception, and nothing new is added to it
  in its current shape.

## 3. Dependency rules (what `pnpm deps` enforces)

```
router/controller ──> command/query ──> service/handler ──> port (interface) <── adapter (infrastructure)
                                             │                                      │
                                             └──> domain (aggregate, VO, events) <──┘ (adapter maps rows to domain)
```

- `domain/` imports: `@bf/shared/ddd`, `@bf/shared/constants`, Node built-ins, pure helpers
  from `@bf/shared`. Never `@nestjs/*`, `drizzle-orm`, `pg`, `express`, `@trpc/*`,
  `nestjs-trpc`, `@bf/contracts`, `@bf/db`, `@bf/events`, `@bf/trpc`, `@bf/storage`,
  `@bf/llm`, `src/db`, `src/app`, another module, or its own `application/` and
  `infrastructure/` (DDH-19, 78, 80).
- `application/` imports: its own `domain/`, its own `ports`, `@bf/shared`, `@nestjs/common`
  (only `Inject`/`Injectable`), `@nestjs/cqrs`, `@bf/contracts/<svc>` **types** (for the
  mapper's output shape). Never `infrastructure/`, `drizzle-orm`, `pg`, `src/db`,
  `nestjs-trpc`, another module's internals.
- `infrastructure/` imports: its own `application/ports` and `domain/`, `@bf/db`,
  `drizzle-orm`, `src/db/schema.register`, `@bf/events`, `@bf/trpc` (clients), `@bf/storage`,
  `@bf/llm`, SDKs. Never a router.
- `*.router.ts` imports: `nestjs-trpc`, `@nestjs/cqrs` buses, `@bf/contracts/<svc>` schemas,
  `@bf/trpc` middlewares, the slice's command/query class, the module's errors (to map them).
  Never a repository, a Drizzle instance or another module.
- **No module imports another module's `domain/`, `application/` (other than its exported
  ports) or `infrastructure/`.** Cross-context communication is a tRPC client (`@bf/trpc`
  `TrpcClientModule`) behind a port, or an integration event (ADR-005/017).
- `src/db/schema.register.ts` is imported only by `infrastructure/` files, `@bf/db` wiring and
  `drizzle.config.ts`.
- No circular dependencies anywhere (`no-circular`).

The per-app `.dependency-cruiser.cjs` files implement exactly these rules; a violation fails
`pnpm deps` locally and the `static` job of the pipeline.

## 4. The domain building blocks, with the `@bf/shared/ddd` classes

| Block                                                                                                                                   | Use                                                                                                                                                                              | Not this                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `Entity<Id>`                                                                                                                            | child entities with a local identity; `equals()` by id and class                                                                                                                 | public mutable fields                                                                             |
| `AggregateRoot<Id>`                                                                                                                     | the root of a consistency boundary; `raise(event)` records a domain event, `pullDomainEvents()` hands them to the application layer; `version` for optimistic concurrency        | an aggregate referencing another aggregate's object (reference by id - DDH-40)                    |
| `ValueObject<T>`                                                                                                                        | immutable props, structural equality; subclass exposes **getters only** and validates in a static `create()`/`of()` factory that returns `Result` or throws `InvariantViolation` | a value object inside a DTO, an event payload or a Drizzle row (serialise to primitives - DDH-60) |
| `createDomainEvent({ type, aggregateType, aggregateId, payload, correlationId })`                                                       | every state change the business cares about; `type` is `<context>.<aggregate>.<event>` (ADR-006) and doubles as the outbox destination                                           | an event without an aggregate id; an event carrying a value object                                |
| `DomainException(code, message, details)` and its subclasses `NotFoundDomainException`, `ConflictDomainException`, `InvariantViolation` | domain errors with stable codes (`ORDER.ALREADY_PAID`); a module's `<aggregate>.errors.ts` declares one subclass per business error with a `static readonly code`                | throwing `HttpException`/`TRPCError` from the domain or the application layer (DDH-71)            |
| `Result<T, E>` = `Ok<T> \| Err<E>`, `ok()`, `err()`                                                                                     | the return type of every use case and of domain methods that can fail for a business reason (DDH-73); `unwrap()` only in tests and at the outermost adapter                      | `Err` for technical failures (connection lost): throw those (DDH-74)                              |

Invariants (DDH-24, 29, 30, 56, 67-69): an aggregate is created through a static
`create(props)` that validates and raises the creation event; every state change is an
intention-revealing method (`order.pay(...)`, never `order.status = 'paid'`); `validate()` runs
the rules that must always hold and is called by the repository before every write; guards
inside the domain check null/empty/length/range and business rules only - full input
validation happens once at the boundary, in the zod schema of the contract.

## 5. Events and transactions

- **Domain events** are raised in the aggregate and **pulled by the application service**
  after the aggregate is persisted: `const events = order.pullDomainEvents()`.
- **Same transaction.** The application service runs `db.transaction(async (tx) => { await
repo.save(order, tx); await publisher.publishAll(events, tx); })` so the aggregate row and
  the outbox rows commit together (ADR-005: no dual write). `OutboxEventPublisher` (`@bf/events`)
  writes the envelope into the service's `outbox` table; the relay to a broker is deferred
  (ADR-021) but the contract - `eventEnvelopeSchema` - is final.
- **In-process reactions** (DDH-44, the wallet-after-user example) are `@nestjs/cqrs`
  `EventsHandler`s or application services subscribed through the module; when such a reaction
  must change a second aggregate, both writes join the same transaction (DDH-46) or the
  reaction is made eventually consistent through the outbox (DDH-49). Command handlers never
  call other command handlers (DDH-16).
- **Integration events** cross service boundaries only through the outbox; consumers are
  idempotent through the `processed_events` inbox table (ADR-005).

## 6. The driving side: tRPC routers as controllers

- Every procedure is `@Query`/`@Mutation({ input, output })` with both schemas imported from
  `@bf/contracts/<svc>/schemas.ts` (the contract is the DTO - DDH-85/86; `pnpm
contracts:check` fails on drift). Router alias = entity plural, procedure = verb
  (`orders.place`, `orders.getById`).
- A router does four things only: validate (done by the schema), build the command/query,
  dispatch it on the bus, and **map the Result to the transport** - `ok` -> output schema shape
  (through the mapper), `err(DomainException)` -> `TRPCError` with the matching code
  (`NOT_FOUND`, `CONFLICT`, `UNPROCESSABLE_CONTENT`, `FORBIDDEN`), unknown error -> rethrow
  (DDH-73). Response shapes are whitelists built by the mapper (DDH-89), never the aggregate.
- Identity comes from the tRPC context (`@bf/trpc` `TrpcContext.user`, set from the trusted
  `X-User-*` headers the edge writes) and `AuthedMiddleware`/`AdminMiddleware` gate the
  procedure; the command carries `userId` in its metadata.
- REST controllers remain only for contracts with the outside world that are not tRPC
  (today: `POST /auth/refresh`, `/auth/logout`, `/auth/dev-token`, `GET /auth/jwks`, `/health`);
  a new REST endpoint needs an ADR (red flag 10).

## 7. The driven side: Drizzle repositories and other adapters

- `infrastructure/<aggregate>.drizzle.repository.ts` implements the port with the service's
  Drizzle instance (`@InjectDrizzle()`); it maps rows to the aggregate and back through the
  mapper, calls `aggregate.validate()` before every write, returns `undefined`/`Result` rather
  than throwing for "not found", and translates a unique-constraint violation into a
  `ConflictDomainException` (DDH-123).
- The table definition in `src/db/schema.register.ts` is the persistence model (DDH-100); its
  shape may differ from the aggregate's (normalised tables, snake_case columns). Migrations are
  generated from it (`pnpm db:generate`) and committed.
- Other ports (clock, id generator, another service, S3, LLM, mail) get an adapter each; the
  in-memory doubles that `@bf/storage` and `@bf/llm` already ship are the test adapters
  (ADR-010).
- Query handlers (`queries/`) read Drizzle directly and return contract output shapes: no
  aggregate, no repository (DDH-17/99).

## 8. Tests

- **Domain unit tests** (`*.spec.ts` beside the file): aggregates and value objects with no
  NestJS and no database - the layering is what makes them possible.
- **Use-case tests** (`*.service.spec.ts`): the handler with in-memory adapters behind the
  ports.
- **Behaviour tests** (`test/<use-case>.e2e-spec.ts`): the acceptance criteria of the
  capability spec, run through the tRPC router against the local database created by the
  pipeline's e2e job.
- A test never edits the code it grades; the acceptance criteria are written in the spec before
  the build (the standard's working-with-AI note "a check the agent can run").

## 9. Worked example (shape only - the identity module's migration is `ARCH-1`)

```ts
// modules/orders/domain/order.aggregate.ts
export class Order extends AggregateRoot<OrderId> {
  private constructor(
    id: OrderId,
    private props: OrderProps,
  ) {
    super(id);
  }
  static create(input: CreateOrderProps): Result<Order, OrderError> {
    const total = Money.sum(input.lines.map((l) => l.price));
    if (total.isErr) return err(total.error);
    const order = new Order(input.id, { ...input, status: 'draft', total: total.value });
    order.raise(
      createDomainEvent({
        type: 'orders.order.created',
        aggregateType: 'order',
        aggregateId: order.id,
        payload: { customerId: input.customerId },
      }),
    );
    return ok(order);
  }
  pay(payment: Payment): Result<void, OrderError> {
    if (this.props.status !== 'draft') return err(new OrderAlreadyPaid(this.id));
    this.props = { ...this.props, status: 'paid' };
    this.raise(
      createDomainEvent({
        type: 'orders.order.paid',
        aggregateType: 'order',
        aggregateId: this.id,
        payload: { amount: payment.amount.toJSON() },
      }),
    );
    return ok(undefined);
  }
  validate(): void {
    if (this.props.total.isNegative()) throw new InvariantViolation('total < 0');
  }
}

// modules/orders/commands/pay-order/pay-order.service.ts
@CommandHandler(PayOrderCommand)
export class PayOrderService implements ICommandHandler<PayOrderCommand, Result<void, OrderError>> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher,
    @InjectDrizzle() private readonly db: Database,
  ) {}
  async execute(cmd: PayOrderCommand) {
    const order = await this.orders.findById(cmd.orderId);
    if (!order) return err(new OrderNotFound(cmd.orderId));
    const paid = order.pay(cmd.payment);
    if (paid.isErr) return paid;
    await this.db.transaction(async (tx) => {
      await this.orders.save(order, tx);
      await this.events.publishAll(order.pullDomainEvents(), tx);
    });
    return ok(undefined);
  }
}

// modules/orders/commands/pay-order/pay-order.router.ts
@Router({ alias: 'orders' })
export class PayOrderRouter {
  constructor(private readonly bus: CommandBus) {}
  @Mutation({ input: ordersPayInputSchema, output: ordersPayOutputSchema })
  @UseMiddlewares(AuthedMiddleware)
  async pay(
    @Input() input: OrdersPayInput,
    @Ctx() ctx: AuthedTrpcContext,
  ): Promise<OrdersPayOutput> {
    const result = await this.bus.execute(new PayOrderCommand({ ...input, userId: ctx.user.id }));
    if (result.isErr) throw toTrpcError(result.error); // NOT_FOUND / CONFLICT / UNPROCESSABLE_CONTENT
    return { ok: true };
  }
}
```

## 10. Checklist a reviewer (human or `bf-architecture-review`) runs on a backend diff

1. Every new file sits in the canonical layout with the right suffix.
2. `pnpm deps` passes; no domain import of a framework, an ORM, a driver or another module.
3. State changes go through aggregate methods; no setters; `create()` validates; `validate()`
   exists and is called by the repository.
4. Business failures are `Result`s with `DomainException` subclasses carrying stable codes;
   technical failures throw; no HTTP or tRPC types below the router.
5. Every procedure has `input` and `output` schemas from `@bf/contracts`; `router.ts` was
   regenerated; `pnpm contracts:check` passes.
6. Writes and their outbox rows share one transaction; events are pulled, not re-created.
7. Query handlers bypass the domain; commands never call commands.
8. Tests exist at the three levels for the slice; acceptance criteria match the capability spec,
   and the spec moved in the same PR (the coupling guard).
9. Value objects are serialised to primitives at every boundary.
10. The module's `README.md` (if present) and the capability spec still describe reality.
