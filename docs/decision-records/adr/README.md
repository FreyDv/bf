# ADR index

Architecture Decision Records - технические причины. Тест записи, жизненный цикл и иерархия: стандарт (`docs/standards/vendor/repository-standards-core/docs/tree/docs-decision-records.md`).

| #                                              | Title                                                                                                  | Status                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| [001](ADR-001-pnpm-turborepo-cjs.md)           | pnpm 10 + Turborepo, монорепозиторий, CJS везде                                                        | Accepted                                                                       |
| [002](ADR-002-eslint-prettier-config.md)       | ESLint flat + Prettier + tsconfig-базы в @bf/config                                                    | Accepted                                                                       |
| [003](ADR-003-drizzle-per-app.md)              | Drizzle на каждое приложение: конфиг, schema.register.ts, миграции в репозитории                       | Accepted (в части Drizzle на приложение); изоляция pg-схемами заменена ADR-018 |
| [004](ADR-004-hexagonal-dependency-cruiser.md) | Гексагональная архитектура на bounded context, граница проверяется dependency-cruiser                  | Accepted (уточнено ADR-025)                                                    |
| [005](ADR-005-cqrs-outbox.md)                  | @nestjs/cqrs для команд и запросов; интеграционные события через transactional outbox                  | Accepted (outbox остаётся; релей в брокер отложен ADR-021)                     |
| [006](ADR-006-event-envelope.md)               | Конверт события в zod; топик = <context>.<aggregate>.<event>; DLQ = <topic>.dlq                        | Accepted                                                                       |
| [007](ADR-007-kafkajs.md)                      | kafkajs напрямую, а не @nestjs/microservices                                                           | Superseded by ADR-021 (код потребителя удалён, решение отложено)               |
| [008](ADR-008-observability.md)                | Pino + nestjs-cls; OpenTelemetry; prom-client /metrics; terminus /health                               | Accepted (в части Pino, nestjs-cls и terminus); OTel и /metrics сняты ADR-021  |
| [009](ADR-009-storage-port.md)                 | S3-порт @bf/storage: S3_ENDPOINT задан - MinIO, нет - цепочка учётных данных AWS                       | Accepted                                                                       |
| [010](ADR-010-llm-port.md)                     | @bf/llm: адаптер OpenAI за портом с in-memory дублёром                                                 | Accepted                                                                       |
| [011](ADR-011-aws-ecs-sam.md)                  | AWS: ECS Fargate через SAM/CloudFormation, Kafka/Debezium отложены                                     | Superseded by ADR-022                                                          |
| [012](ADR-012-symbol-for-tokens.md)            | Глобальные DI-токены - Symbol.for("bf.*")                                                              | Accepted                                                                       |
| [013](ADR-013-typescript-6.md)                 | TypeScript 6.0 (не 7)                                                                                  | Accepted                                                                       |
| [014](ADR-014-eslint-10-react.md)              | ESLint 10.10 с @eslint-react/eslint-plugin вместо eslint-plugin-react                                  | Accepted                                                                       |
| [015](ADR-015-nest-overrides.md)               | pnpm.overrides фиксируют одну копию @nestjs/common и core 12                                           | Accepted                                                                       |
| [016](ADR-016-service-split.md)                | Разделение на сервисы (сентябрь 2026): api, auth, order, course, billing, admin, ai, fe-main, fe-admin | Accepted                                                                       |
| [017](ADR-017-trpc-contract-first.md)          | Межсервисный RPC - nestjs-trpc, contract-first через @bf/contracts                                     | Accepted                                                                       |
| [018](ADR-018-database-per-service.md)         | Один Postgres, база на сервис                                                                          | Accepted                                                                       |
| [019](ADR-019-rs256-jwt.md)                    | RS256 JWT: подпись в auth, проверка локально в каждом сервисе                                          | Accepted                                                                       |
| [020](ADR-020-root-compose.md)                 | Один корневой docker-compose.yml для всей платформы                                                    | Accepted                                                                       |
| [021](ADR-021-drop-kafka-otel.md)              | Kafka, prom-client и OpenTelemetry убраны из кода и зависимостей (сентябрь 2026)                       | Accepted                                                                       |
| [022](ADR-022-aws-one-ec2.md)                  | AWS на одном EC2 (октябрь 2026)                                                                        | Superseded by ADR-023                                                          |
| [023](ADR-023-aws-fargate-scale-to-zero.md)    | AWS на ECS Fargate со сном до нуля задач (октябрь 2026)                                                | Accepted                                                                       |
| [024](ADR-024-adopt-repository-standards.md)   | Внедрить Repository Standards (профиль core, стек Node выборочно)                                      | Accepted                                                                       |
| [025](ADR-025-domain-driven-hexagon.md)        | Domain-Driven Hexagon - обязательная архитектура каждого backend-сервиса                               | Accepted                                                                       |
| [026](ADR-026-domain-error-model.md)           | Модель ошибок: Result для бизнес-ошибок, исключения для технических                                    | Proposed                                                                       |
| [027](ADR-027-branching-squash-merge.md)       | Ветвление: trunk-based, rebase веток, squash-merge в main                                              | Accepted                                                                       |
| [028](ADR-028-security-baseline.md)            | Базовая безопасность: ответ на каждую ось стандарта                                                    | Proposed                                                                       |
| [029](ADR-029-testing-strategy.md)             | Стратегия тестирования: уровни и где они выполняются                                                   | Proposed                                                                       |
| [030](ADR-030-dependency-policy.md)            | Политика зависимостей: точные версии, lockfile, кулдаун 7 дней                                         | Accepted                                                                       |
| [031](ADR-031-node-26-pin.md)                  | Node 26 закреплён в .nvmrc и engines (расхождение со стеком Node 24.18.0)                              | Accepted                                                                       |
| [032](ADR-032-working-language.md)             | Рабочий язык: код и коммиты - английский, документы и спеки - русский                                  | Accepted                                                                       |

Первая строка каждой записи - номер-ссылка на файл; остальное - свободный текст. `scripts/decision-records-check.mjs` сверяет таблицу с файлами на диске. Нумерация без пропусков, номера не переиспользуются. Шаблон: [`_template.md`](_template.md).

ADR-001..023 переписаны из сжатой таблицы `docs/ADR.md` (теперь указатель); ADR-024 и далее написаны при внедрении стандарта 2026-11-05.

## Развилки стандарта (R7) и записи, которые на них отвечают

| Развилка                       | Запись             |
| ------------------------------ | ------------------ |
| Топология репозитория          | ADR-001            |
| Границы доменов и модулей      | ADR-016, ADR-025   |
| Хранилище данных               | ADR-018 (ADR-003)  |
| Стиль API и контракта          | ADR-017            |
| Аутентификация и авторизация   | ADR-019            |
| Стратегия тестирования         | ADR-029 (Proposed) |
| Базовая безопасность           | ADR-028 (Proposed) |
| Ветвление и релизы             | ADR-027            |
| Модель ошибок                  | ADR-026 (Proposed) |
| Зависимости и цепочка поставок | ADR-030            |
