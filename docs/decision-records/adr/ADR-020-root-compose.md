# ADR-020: Один корневой docker-compose.yml для всей платформы

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | Accepted                                                                               |
| **Date**       | 2026-11-05 (оформлено при внедрении стандарта; решение принято ранее, см. docs/ADR.md) |
| **Author**     | владелец                                                                               |
| **Decided by** | владелец                                                                               |
| **Tags**       | tooling, local-dev                                                                     |

## Context

`pnpm stack:up` должен поднимать всё без конвейера публикации.

## Options considered

В исходной таблице альтернативы не записаны.

## Decision

Корневой `docker-compose.yml` (include `infra`, каждое приложение из `docker/nest.Dockerfile` и `docker/next.Dockerfile`, одноразовый сервис `migrate`); приложения берут `.env.example` + переопределения контейнера.

## Consequences

- Плюс: платформа поднимается одной командой.

## Confirmation

`pnpm stack:up` и задача `docker build` в CI.

## Revisit when

Платформа перестаёт помещаться в одну машину разработчика.

## Related

ADR-018.
