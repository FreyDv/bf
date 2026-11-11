# Query filter rules (binding, loaded in every session)

Every list query with a filter follows this file. Decision and rejected options: `docs/decision-records/adr/ADR-024-query-filter-contract.md`.
Same binding level as `architecture-rules.md`: a deviation is legal only as a recorded ADR that names the rule ID (AIP-1).

## Contract

### Operators

| Operator | `value` | Meaning |
|---|---|---|
| `eq`, `neq` | one value | equal, not equal |
| `gt`, `gte`, `lt`, `lte` | one value | comparison |
| `in`, `nin` | list | in, not in |
| `between` | tuple `[v1, v2]`, `v1 <= v2` | inside the range, both bounds included |
| `nbetween` | tuple `[v1, v2]`, `v1 <= v2` | outside the range, both bounds excluded from the result |
| `isnull`, `nisnull` | none, `value` is forbidden | NULL, not NULL |

`gt`, `gte`, `lt`, `lte`, `between`, `nbetween` do not compile on `bool`, `uuid` and `oneOf` fields.

Code always writes an operator as `Op.<name>` (`in` is a reserved word in JavaScript). The request carries the string: `operator: 'in'`.

### Declaring a filter

A filter spec is plain data with no Zod and no Drizzle.

```ts
Op.eq, Op.neq, Op.gt, Op.gte, Op.lt, Op.lte, Op.in, Op.nin,
Op.between, Op.nbetween, Op.isnull, Op.nisnull

Op.String = [eq, neq]
Op.Number = [eq, neq, gt, gte, lt, lte, between, nbetween, in, nin]
Op.Date   = [eq, neq, gt, gte, lt, lte, between, nbetween]
Op.Id     = [eq, neq, in, nin]
Op.Enum   = [eq, neq, in, nin]
Op.Bool   = [eq]
Op.Null   = [isnull, nisnull]

export const userFilter = defineFilter({
  name:       str(Op.eq, Op.neq),
  sname:      str(Op.String),
  middleName: str(Op.String, Op.isnull, Op.nisnull), // sets and operators mix
  age:        int(Op.Number),
  status:     oneOf(UserStatus, Op.Enum),
  group:      relation.one(cycleGroupFilter),
  orders:     relation.many(orderFilter),
});
```

Value builders: `str`, `int`, `decimal` (a string, never a float), `bool`, `date`, `datetime`, `uuid`, `oneOf`. On the wire only JSON primitives; a date is an ISO 8601 string.

`oneOf` takes a string TS enum or a non-empty array:

- `oneOf(OrderStatus, Op.Enum)` - every value; `value` is typed `OrderStatus`;
- `oneOf([OrderStatus.New, OrderStatus.Paid], Op.Enum)` - only these reach the API; `value` is typed as these members;
- `oneOf(['new', 'paid'] as const, Op.Enum)` - only when no enum exists; `value` is typed as literals.

A numeric enum does not compile (its runtime object has reverse keys). `oneOf(Enum)` publishes each new enum value at once; use an array where that is unwanted.

A relation takes an already declared spec, never a lazy reference, so the relation graph is acyclic and finite. A two-way relation uses a base spec holding only scalar fields.

### Request shape

```ts
{
  filter: {
    status: { operator: 'in', value: ['active'] },
    group:  { legalEntityId: { operator: 'eq', value: 123 } },
    orders: { some: { paid: { operator: 'eq', value: true } } },
    OR:  [ { age: { operator: 'between', value: [0, 5] } },
           { middleName: { operator: 'isnull' } } ],
    NOT: { name: { operator: 'eq', value: 'x' } },
  },
}
```

- The keys of one node combine with AND.
- `AND` and `OR` are non-empty arrays of nodes; `NOT` is one node. Upper case keeps them apart from field names.
- A condition is a sum type on `operator`, holding only the operators the field allows.
- A one-to-many relation takes exactly one of `some`, `none`, `every`.

### What a spec produces

| Output | Entry point | Used by |
|---|---|---|
| `FilterOf<S>` - TS type | `core` | query, port, adapter |
| `toZod(S)` - Zod schema | `zod` | request DTO only |
| `compile(binding, filter)` - SQL | `drizzle` | infrastructure only |

### Layout of one query

```
<module>/
  queries/find-cycles/
    find-cycles.filter-spec.ts       the fields (used by this slice only)
    find-cycles.request.dto.ts       export const ... = z.object({ filter: toZod(S).optional() }).strict()
    find-cycles.router.ts            @Router({ alias: '<module>' }); parse, build the query, dispatch
    find-cycles.query.ts             filter?: FilterOf<S>
    find-cycles.query-handler.ts     calls the port
  application/ports/cycle-read.port.ts
  infrastructure/
    cycle-read.adapter.ts            Drizzle, compile(...), row validation (VAL-4)
    find-cycles.filter-binding.ts    field -> column
  public/                            only what the module gives to others
    cycle.filter-spec.ts             importable by every layer except domain
    cycle.filter-compiler.ts         importable only by another module's infrastructure
```

Client call: `trpc.<module>.findCycles.query({ filter })`.

A spec used by several slices of a module moves to module level; a spec used by another module moves to `public/`.

## Rules

### Shape

- **QRY-1** Every list query with a filter MUST be declared with `defineFilter`. Hand-written filter schemas MUST NOT exist.
- **QRY-2** Operators MUST come from the contract table. A new operator is a change to ADR-024.
- **QRY-3** A field absent from the spec MUST NOT be filterable (allowlist). Every field declares its operators explicitly. The schema is strict: unknown keys are rejected.
- **QRY-4** An `Op.*` set is a plain list. A module MAY declare its own set; the shared `Op.*` sets MUST NOT change for one module's sake.
- **QRY-5** An empty node, an empty `AND` or `OR`, a `value` on `isnull` or `nisnull`, and `v1 > v2` are validation errors, returned together (ADP-8).

### Layers

- **QRY-6** The toolkit is a separate internal package with three entry points: `core`, `zod`, `drizzle`. It MUST NOT live in the shared kernel: the domain imports the kernel and Zod is forbidden there (VAL-2, DEP-3).
- **QRY-7** Imports: `core` from application, interface adapters and infrastructure; `zod` from interface adapters only; `drizzle` from infrastructure only. The domain imports none of them (DEP-2).
- **QRY-8** A query carries the parsed filter as primitives, with no Zod and no SQL (APP-5, DOM-V4). The handler calls a read port (DEP-4, APP-10, PRG-3). This settles APP-10 against DEP-4 for every query.
- **QRY-9** One router class per slice, in `<use-case>.router.ts`, all slices of a module under one alias (ADP-2, STR-2). `.router` is an interface-adapter suffix, like `.controller` in STR-7. A single router file for a whole module MUST NOT exist.
- **QRY-10** A procedure's input MUST be an exported constant from `.request.dto.ts`, not an expression inside the decorator.

### Relations

- **QRY-11** A relation filter MUST compile to `EXISTS` / `NOT EXISTS` for both cardinalities, so a nested filter can only remove root rows, never multiply them, and `LIMIT` and `COUNT` stay correct. `JOIN` is allowed only in a read adapter, for response columns, over a one-to-one relation inside its own module. The foreign key a relation filter uses MUST be indexed: Postgres does not create that index, and `EXISTS` inside `OR` stays a per-row subquery.
- **QRY-12** Another module is reachable only through its `public/`: the spec and a compiler taking the foreign key. Its tables MUST NOT be imported (DEP-5). Relations between modules point one way only (DEP-9).
- **QRY-13** `every` is true on an empty relation. A row with NULL in an `every` condition counts as a violation: `NOT EXISTS (... AND (cond) IS NOT TRUE)`.

### SQL and safety

- **QRY-14** NULL follows plain SQL: `neq`, `nin`, `nbetween` and `NOT` do not return rows with NULL in that field; a caller who wants them adds `OR isnull`. `NOT` over a relation is `NOT EXISTS`, so rows with no related record match.
- **QRY-15** A binding is exhaustive by type: a field without a column does not compile. Column names come only from the binding, values only as parameters; `sql.raw` MUST NOT be used.
- **QRY-16** Default limits, which a query MAY only tighten: `AND`/`OR`/`NOT` nesting 5, relation levels 2, nodes 50, `in` and `nin` list 1000.
- **QRY-17** Access scoping is applied outside the caller's filter: `WHERE scope AND (filter)`. A filter never replaces authorization.

### Verification

- **QRY-18** Toolkit tests: type-level (a forbidden operator does not compile, `z.infer` of `toZod(S)` equals `FilterOf<S>`), NULL and quantifiers on a real Postgres (TST-2, TST-3). Every query has behavioural tests for the filters in its spec (TST-1).
- **QRY-19** dependency-cruiser enforces QRY-7, QRY-12 and the ban on importing contracts from `domain/` (QRY-20, ENF-1).

### Enums

- **QRY-20** An enum the client sees lives in the contracts package, `packages/contracts/<module>/` (`.enum.ts`, ADP-6), imported by the frontend, the filter spec and the response DTO. The domain keeps its own enum and MUST NOT import the contract (DEP-3, ADP-3). A type-level test proves the values match. `value` on the client is typed as the enum itself.
