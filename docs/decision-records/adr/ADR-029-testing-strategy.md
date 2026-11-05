# ADR-029: Стратегия тестирования: уровни и где они выполняются

> [NEEDS REVIEW] drafted by the adoption run on 2026-11-05 from the CI pipeline and the existing test files. Backlog: REC-3.

|                |                                 |
| -------------- | ------------------------------- |
| **Status**     | Proposed                        |
| **Date**       | 2026-11-05                      |
| **Author**     | владелец                        |
| **Decided by** | ожидает подтверждения владельца |
| **Tags**       | quality, testing-strategy       |

## Context

Развилка `testing-strategy` (R7) требует названных уровней и места выполнения. Фактически в репозитории: Jest юнит-тесты `*.spec.ts` рядом с кодом, e2e `test/*.e2e-spec.ts` на локальном Postgres (в CI - отдельное задание `e2e`), проверки дрейфа контрактов, миграций и env. Стек Layer 2 предлагает Vitest и Playwright - сознательно не берётся.

## Options considered

- Vitest + Playwright по стеку Layer 2 - отклонено: в репозитории Jest и SWC, переход не окупается (STACK-1).
- Оставить Jest и e2e на Postgres - предлагается.

## Decision

Уровни: **юнит** (`*.spec.ts`, без ввода-вывода: домен, use case с in-memory адаптерами), **e2e** (`test/*.e2e-spec.ts` через роутер tRPC против локального Postgres; критерии приёмки - из спеки), **дрейф** (`contracts:check`, `db:check`, `env:check`). Пути денег, безопасности и внешних контрактов обязательны на уровне e2e и выше. Тест меняется в том же PR, что и спека; тест не правит код, который он проверяет.

## Consequences

- Плюс: уровни названы и привязаны к CI.
- Минус: нет браузерных e2e для фронтендов.

## Confirmation

Задания `unit`, `e2e`, `migrations`, `contracts-drift` в `pipeline.yml`.

## Revisit when

Появляется платёжная логика или сложный пользовательский сценарий во фронтенде, требующий браузерных тестов.

## Related

ADR-025, specs/, docs/standards/vendor/repository-standards-node/DECISIONS.md.
