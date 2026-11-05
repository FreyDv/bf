# ADR-017: Межсервисный RPC - nestjs-trpc, contract-first через @bf/contracts

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | Accepted                                                                               |
| **Date**       | 2026-11-05 (оформлено при внедрении стандарта; решение принято ранее, см. docs/ADR.md) |
| **Author**     | владелец                                                                               |
| **Decided by** | владелец                                                                               |
| **Tags**       | architecture, api-contract                                                             |

## Context

Нужны общие типы без публикации в реестр; у каждой процедуры должны быть явные input и output.

## Options considered

В исходной таблице альтернативы не записаны.

## Decision

RPC между сервисами и от фронтендов - nestjs-trpc (Nest 12 через `peerDependencyRules`), contract-first: zod-схемы пишутся вручную в `@bf/contracts/<svc>/schemas.ts`, тип `AppRouter` генерирует CLI nestjs-trpc в `router.ts`, дрейф проверяется в CI, потребляется через `workspace:*`. Никакого ad-hoc REST и самописных HTTP-клиентов (ответ на развилку `api-contract`).

## Consequences

- Плюс: типы без реестра; генерируемый файл самодостаточен.
- Минус: зависимость от nestjs-trpc.

## Confirmation

`pnpm contracts:check` в `ci ok`; правила в `.claude/rules/contracts.md`.

## Revisit when

nestjs-trpc перестаёт поддерживаться или появляется внешний потребитель, которому нужен не tRPC-протокол.

## Related

ADR-016, ADR-025.
