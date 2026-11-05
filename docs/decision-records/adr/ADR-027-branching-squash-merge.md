# ADR-027: Ветвление: trunk-based, rebase веток, squash-merge в main

|                |                            |
| -------------- | -------------------------- |
| **Status**     | Accepted                   |
| **Date**       | 2026-11-05                 |
| **Author**     | владелец                   |
| **Decided by** | владелец                   |
| **Tags**       | delivery, release-strategy |

## Context

Развилка стандарта «ветвление и способ слияния» (R23, R7) требует записанного решения. Путь стандарта по умолчанию - rebase-merge с самостоятельными коммитами; squash-merge допустим, если записан. Репозиторий уже сливает PR squash-ом (`... (#5)` в истории).

## Options considered

- Rebase-merge с самостоятельными коммитами (путь стандарта) - отклонён владельцем: «хочу squash-merge».
- Squash-merge - выбран.

## Decision

Короткоживущие ветки от `main`; каждый PR строится на `main`, не на ветке другого PR; ветка обновляется rebase-ом, `main` в неё не вливается; в `main` - squash-merge, один коммит на PR; чужую ветку не переписывать; релизы режет владелец; поддерживаемых релизных линий нет; откат триггерится circuit breaker деплоя ECS и ручным откатом ревизии task definition (runbook - backlog MATERIAL-1).

## Consequences

- Плюс: история `main` - один законченный коммит на PR независимо от шума внутри ветки.
- Минус: отдельные коммиты ветки не попадают в `main`.

## Confirmation

Защита ветки `main` и обязательный `ci ok` (`scripts/ci/repo-settings.ts`); настройка кнопки слияния - GUARD-2.

## Revisit when

Репозиторий переходит на профиль scale с несколькими авторами, либо история `main` должна быть пригодна для `git bisect` по отдельным шагам.

## Related

SPEC.md R23, standard ADR-026, docs/standards/vendor/repository-standards-core/standard/docs/conventions.md.
