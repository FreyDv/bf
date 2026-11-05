# ADR-016: Разделение на сервисы (сентябрь 2026): api, auth, order, course, billing, admin, ai, fe-main, fe-admin

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | Accepted                                                                               |
| **Date**       | 2026-11-05 (оформлено при внедрении стандарта; решение принято ранее, см. docs/ADR.md) |
| **Author**     | владелец                                                                               |
| **Decided by** | владелец                                                                               |
| **Tags**       | architecture, domain-boundaries                                                        |

## Context

Нужна первая аппроксимация целевой топологии, минимальная намеренно, чтобы оценить подход. Воркер удалён.

## Options considered

В исходной таблице альтернативы не записаны.

## Decision

Сервисы: `api` (edge: JWT, роли, rate limit, прокси `/<svc>/*`), `auth` (идентификация), `order`, `course`, `billing`, `admin`, `ai`; Next.js `fe-main` и `fe-admin`. Границы bounded contexts - ответ на развилку `domain-boundaries`.

## Consequences

- Плюс: изоляция по доменам, возможность независимого масштабирования до нуля.
- Минус: сервисы-скелеты без бизнес-логики.

## Confirmation

`apps/*`, `docs/ARCHITECTURE.md`, `pnpm apps` (обнаружение приложений).

## Revisit when

Домен показывает, что два сервиса всегда меняются вместе, либо один сервис разрастается за пределы одного bounded context.

## Related

ADR-017, ADR-018, ADR-025.
