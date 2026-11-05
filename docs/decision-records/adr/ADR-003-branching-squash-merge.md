# ADR-003: Ветвление: trunk-based, rebase веток, squash-merge в main

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-05 |
| **Author** | владелец |
| **Decided by** | владелец |
| **Tags** | delivery, release-strategy |

## Context

Развилка «ветвление и способ слияния» (R23, R7) требует записи. Путь стандарта по умолчанию - rebase-merge с самостоятельными коммитами; squash-merge допустим, если записан. Владелец: «хочу squash-merge».

## Options considered

- Rebase-merge - отклонён владельцем.
- Squash-merge - выбран.

## Decision

Короткоживущие ветки от `main`; PR строится на `main`, не на ветке другого PR; ветка обновляется rebase-ом, `main` в неё не вливается; в `main` - squash-merge, один коммит на PR; чужую ветку не переписывать; релизы режет владелец; поддерживаемых релизных линий нет; стратегия отката решается вместе со стеком (backlog CI-1).

## Consequences

- Плюс: история `main` - один законченный коммит на PR.
- Минус: отдельные коммиты ветки в `main` не попадают.

## Confirmation

Защита ветки и настройка кнопки слияния (backlog GUARD-2).

## Revisit when

Появляются соавторы (профиль scale) или нужна история `main` для `git bisect` по шагам.

## Related

SPEC.md R23, standard ADR-026.
