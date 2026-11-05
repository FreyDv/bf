# ADR-013: TypeScript 6.0 (не 7)

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | Accepted                                                                               |
| **Date**       | 2026-11-05 (оформлено при внедрении стандарта; решение принято ранее, см. docs/ADR.md) |
| **Author**     | владелец                                                                               |
| **Decided by** | владелец                                                                               |
| **Tags**       | tooling                                                                                |

## Context

`@nestjs/schematics@12` требует TS ≥ 6, а typescript-eslint поддерживает версии < 6.1.

## Options considered

В исходной таблице альтернативы не записаны (отклонена TypeScript 7).

## Decision

TypeScript 6.0: из tsconfig убран `baseUrl`, `rootDir` задан явно, `ignoreDeprecations: 6.0` только там, где tsup вставляет `baseUrl`.

## Consequences

- Минус: TS 7 откладывается до поддержки typescript-eslint и Nest schematics.

## Confirmation

`pnpm typecheck` в `ci ok`.

## Revisit when

typescript-eslint и `@nestjs/schematics` поддерживают TypeScript 7.

## Related

ADR-002.
