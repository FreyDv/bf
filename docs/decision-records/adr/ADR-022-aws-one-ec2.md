# ADR-022: AWS на одном EC2 (октябрь 2026)

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | Superseded by ADR-023                                                                  |
| **Date**       | 2026-11-05 (оформлено при внедрении стандарта; решение принято ранее, см. docs/ADR.md) |
| **Author**     | владелец                                                                               |
| **Decided by** | владелец                                                                               |
| **Tags**       | infrastructure, cost                                                                   |

## Context

Бюджет 100-150 USD/мес: вариант Fargate + ALB + NAT + RDS стоил ≈ 180 USD.

## Options considered

- ECS Fargate (ADR-011) - отклонён по цене.

## Decision

`docker compose` + Caddy на `t4g.medium`, Aurora Serverless v2 с минимумом 0 ACU, только публичные подсети (без NAT и ALB), инфраструктура - AWS CDK на TypeScript, все ops/CI-скрипты - TypeScript на AWS SDK v3, запускаются обычным `node`; деплой через SSM Run Command. Принятые минусы: единая точка отказа, нет автоскейлинга, ≈ 15 с на возобновление БД; логическая репликация (Debezium) не даёт кластеру заснуть.

## Consequences

- Плюс: ≈ 40-85 USD/мес.
- Минус: см. выше; заменено ADR-023.

## Confirmation

Не применимо (заменено).

## Revisit when

Не применимо (заменено).

## Related

ADR-011, ADR-023, BDR-002.
