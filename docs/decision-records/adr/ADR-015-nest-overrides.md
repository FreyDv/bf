# ADR-015: pnpm.overrides фиксируют одну копию @nestjs/common и core 12

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | Accepted                                                                               |
| **Date**       | 2026-11-05 (оформлено при внедрении стандарта; решение принято ранее, см. docs/ADR.md) |
| **Author**     | владелец                                                                               |
| **Decided by** | владелец                                                                               |
| **Tags**       | dependencies                                                                           |

## Context

`@nestjs/throttler` всё ещё объявляет peer-зависимости Nest ≤ 11; без override pnpm ставит вторую копию Nest и DI ломается.

## Options considered

В исходной таблице альтернативы не записаны.

## Decision

В корневом `package.json` `pnpm.overrides` фиксируют `@nestjs/common` и `@nestjs/core` на ^12.0.1 и `peerDependencyRules` для nestjs-trpc.

## Consequences

- Плюс: одна копия Nest, DI работает.
- Минус: сопровождение override.

## Confirmation

Сборка и e2e-тесты; `pnpm install` без дублей Nest.

## Revisit when

`@nestjs/throttler` и nestjs-trpc объявляют Nest 12 в peer-зависимостях.

## Related

ADR-030.
