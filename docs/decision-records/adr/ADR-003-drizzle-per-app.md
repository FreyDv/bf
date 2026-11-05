# ADR-003: Drizzle на каждое приложение: конфиг, schema.register.ts, миграции в репозитории

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | Accepted (в части Drizzle на приложение); изоляция pg-схемами заменена ADR-018         |
| **Date**       | 2026-11-05 (оформлено при внедрении стандарта; решение принято ранее, см. docs/ADR.md) |
| **Author**     | владелец                                                                               |
| **Decided by** | владелец                                                                               |
| **Tags**       | data, persistence                                                                      |

## Context

Каждому сервису нужны свои таблицы и миграции. В первой версии все приложения делили один Postgres, каждое со своей pg-схемой.

## Options considered

В исходной таблице альтернативы не записаны.

## Decision

Per-app Drizzle: `drizzle.config.ts` + `src/db/schema.register.ts` + миграции в `apps/<svc>/drizzle`. `@bf/db` жёстко задаёт `casing: snake_case` и для drizzle-kit, и для рантайма. Часть про «pg-схема на приложение» заменена ADR-018.

## Consequences

- Плюс: изоляция схем; типизированная модель таблиц рядом с кодом сервиса.
- Минус: схема описывается Drizzle-кодом, а не отдельным DDL (backlog DB-SCHEMA-1).

## Confirmation

`pnpm db:check` и задача `migrations drift` в `pipeline.yml`.

## Revisit when

Drizzle перестаёт покрывать нужные возможности Postgres или появляется сервис, которому нужна не реляционная база.

## Related

ADR-018, ADR-025 (таблица Drizzle - модель персистентности).
