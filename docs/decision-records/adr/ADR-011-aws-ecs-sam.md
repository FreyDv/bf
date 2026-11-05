# ADR-011: AWS: ECS Fargate через SAM/CloudFormation, Kafka/Debezium отложены

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | Superseded by ADR-022                                                                  |
| **Date**       | 2026-11-05 (оформлено при внедрении стандарта; решение принято ранее, см. docs/ADR.md) |
| **Author**     | владелец                                                                               |
| **Decided by** | владелец                                                                               |
| **Tags**       | infrastructure                                                                         |

## Context

Нужны управляемые вычисления без Kubernetes.

## Options considered

В исходной таблице альтернативы не записаны.

## Decision

ECS Fargate через вложенные стеки SAM/CloudFormation; Kafka/Debezium отложены (воркер `DesiredCount=0`); MSK добавляется позже без изменений кода (`KAFKA_ENABLED`).

## Consequences

- Заменено ADR-022: бюджет не позволял (Fargate + ALB + NAT + RDS ≈ 180 USD/мес).

## Confirmation

Не применимо (заменено).

## Revisit when

Не применимо (заменено).

## Related

ADR-022, ADR-023, BDR-002.
