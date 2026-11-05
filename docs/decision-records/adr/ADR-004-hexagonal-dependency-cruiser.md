# ADR-004: Гексагональная архитектура на bounded context, граница проверяется dependency-cruiser

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | Accepted (уточнено ADR-025)                                                            |
| **Date**       | 2026-11-05 (оформлено при внедрении стандарта; решение принято ранее, см. docs/ADR.md) |
| **Author**     | владелец                                                                               |
| **Decided by** | владелец                                                                               |
| **Tags**       | architecture                                                                           |

## Context

Домен должен оставаться свободным от фреймворка и тестироваться без инфраструктуры.

## Options considered

В исходной таблице альтернативы не записаны.

## Decision

Каждый bounded context делится на `domain / application / infrastructure / presentation`; границы проверяет dependency-cruiser. Детальные правила и раскладка - ADR-025 и `docs/standards/domain-driven-hexagon/bf-mapping.md`.

## Consequences

- Плюс: домен тестируется с нулём инфраструктуры.
- Минус: больше файлов и маппинга; правило «не плодить абстракции» (DDH-22) обязательно к соблюдению.

## Confirmation

`pnpm deps` падает на нарушении (`apps/*/.dependency-cruiser.cjs`).

## Revisit when

Сервис оказывается чистым CRUD без бизнес-правил - тогда для него записывается исключение отдельным ADR (DDH-107).

## Related

ADR-025.
