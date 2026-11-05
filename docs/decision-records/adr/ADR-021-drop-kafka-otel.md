# ADR-021: Kafka, prom-client и OpenTelemetry убраны из кода и зависимостей (сентябрь 2026)

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | Accepted                                                                               |
| **Date**       | 2026-11-05 (оформлено при внедрении стандарта; решение принято ранее, см. docs/ADR.md) |
| **Author**     | владелец                                                                               |
| **Decided by** | владелец                                                                               |
| **Tags**       | infrastructure, simplification                                                         |

## Context

Нет потребителя событий, нет `/metrics`, нет трассировки; платформа должна оставаться в бюджете.

## Options considered

В исходной таблице причина не записана; решение следует из бюджета (BDR-002).

## Decision

Kafka, prom-client и OpenTelemetry убраны из кода и зависимостей; compose-файлы redis/debezium/nats/clickhouse/kafka/otel/prometheus остаются в `infra/*` на будущее; таблица outbox и `OutboxEventPublisher` остаются (только БД, без брокера). Решения ADR-005, 007, 008 сняты временно.

## Consequences

- Плюс: меньше зависимостей и расходов.
- Минус: нет метрик и трассировки.

## Confirmation

В `package.json` нет kafkajs, prom-client, OTel.

## Revisit when

Появляется потребитель событий или нужны метрики/трассировка.

## Related

ADR-005, ADR-007, ADR-008, BDR-002.
