# ADR-008: Pino + nestjs-cls; OpenTelemetry; prom-client /metrics; terminus /health

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | Accepted (в части Pino, nestjs-cls и terminus); OTel и /metrics сняты ADR-021          |
| **Date**       | 2026-11-05 (оформлено при внедрении стандарта; решение принято ранее, см. docs/ADR.md) |
| **Author**     | владелец                                                                               |
| **Decided by** | владелец                                                                               |
| **Tags**       | observability                                                                          |

## Context

Нужна одинаковая поверхность наблюдаемости во всех приложениях через `@bf/server`.

## Options considered

В исходной таблице альтернативы не записаны.

## Decision

Логи Pino с корреляцией через nestjs-cls, `/health` через terminus. OpenTelemetry и `prom-client /metrics` сняты ADR-021 (нет `/metrics`, нет трассировки).

## Consequences

- Плюс: единый логгер и корреляционный id между сервисами.
- Минус: нет метрик и трассировки.

## Confirmation

`packages/shared/src/logger`, `packages/server` (health).

## Revisit when

Нужны метрики/трассировка для диагностики в проде либо появится сервис с SLA.

## Related

ADR-021.
