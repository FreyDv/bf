---
name: bf-new-use-case
description: Use when a backend service needs a new command or query - a new tRPC procedure, "add an endpoint to X", "users should be able to Y", "expose Z to the admin UI" - on an existing module in apps/auth, order, course, billing, admin or ai. Adds one vertical slice (contract schemas, router, command or query object, handler, tests) in the Domain-Driven Hexagon shape this repository binds. If the module does not exist yet, run bf-new-module first.
---

# bf-new-use-case

One use case = one vertical slice (DDH-6, DDH-12, DDH-111). Read
[`docs/standards/domain-driven-hexagon/bf-mapping.md`](../../../docs/standards/domain-driven-hexagon/bf-mapping.md)
sections 2, 6 and 9 and `.claude/rules/backend-architecture.md` first.

## Before writing

1. The behaviour is in the capability spec (`specs/<capability>/spec.md`): the interface
   contract names the procedure, its input/output, its error table, and the acceptance
   criteria. Missing or open markers -> `/spec-specify` / `/spec-clarify` first; the spec
   moves in the same PR as the code (coupling guard).
2. **Command or query?** It changes state -> command (`commands/<use-case>/`); it only reads ->
   query (`queries/<use-case>/`, reads Drizzle directly, no aggregate, no repository).
3. Name: router alias = entity plural, procedure = verb (`orders.place`, `orders.getById`);
   folder = `<verb>-<entity>` (`place-order`).

## Files to create

```
packages/contracts/src/<svc>/schemas.ts      <use-case>InputSchema, <use-case>OutputSchema (zod; nothing from apps/*)
apps/<svc>/src/modules/<module>/commands/<use-case>/
  <use-case>.command.ts                      class <UseCase>Command { readonly ...; readonly userId }
  <use-case>.service.ts                      @CommandHandler(<UseCase>Command) implements ICommandHandler<..., Result<Out, <Aggregate>Error>>
                                             loads through the port, calls the aggregate method, runs db.transaction: repo.save + events.publishAll(aggregate.pullDomainEvents(), tx)
  <use-case>.router.ts                       @Router({ alias }) + @Mutation({ input, output }) + @UseMiddlewares(AuthedMiddleware | AdminMiddleware);
                                             builds the command from @Input() and @Ctx().user, bus.execute, maps err -> TRPCError (NOT_FOUND / CONFLICT / UNPROCESSABLE_CONTENT / FORBIDDEN), returns the output shape via the mapper
  <use-case>.service.spec.ts                 the handler with in-memory adapters behind the ports
apps/<svc>/test/<use-case>.e2e-spec.ts       the spec's acceptance criteria, through the router
```

For a query replace `command` + `service` with `<use-case>.query.ts` + `<use-case>.query-handler.ts`
(`@QueryHandler`, `@InjectDrizzle()`, returns the output schema's shape; pagination through
`limit`/`page` from the contract).

Then: register the router and handler in `<module>.module.ts`; run `pnpm --filter <svc>
contracts:generate` (never edit `router.ts` by hand); `pnpm contracts:check`.

## Rules that bite

- Both `input` and `output` schemas on every procedure; the output is a whitelist built by
  the mapper, never the aggregate or the row.
- A command handler never executes another command (Command -> Event -> Command); a reaction
  on another aggregate is an event handler, in the same transaction or through the outbox.
- No `TRPCError`, `HttpException` or transport type below the router; the handler returns
  `Result`.
- Identity comes from `ctx.user` (set by the edge's trusted headers) and travels in the command;
  the handler never reads headers.
- Tests at three levels; the e2e test asserts the spec's Given/When/Then, including every row
  of the error table.

## Done when

`pnpm --filter <svc> deps lint typecheck test`, `pnpm contracts:check`, `node
scripts/spec-guard.mjs --audit --block` pass; the spec's interface contract quotes the final
procedure, input, output and error codes verbatim; `bf-architecture-review` then
`pre-pr-review`.
