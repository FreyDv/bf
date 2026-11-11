# ADR-003: Ветвление: trunk-based, rebase веток, squash-merge в main

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-05 |
| **Author** | владелец |
| **Decided by** | владелец |
| **Tags** | delivery, release-strategy |

## Context

- Развилка «ветвление и способ слияния» требует записи (R23, R7).
- Путь стандарта по умолчанию - rebase-merge с самостоятельными коммитами; squash-merge допустим, если записан.
- Владелец: «хочу squash-merge».

## Options considered

| Вариант | Итог |
|---|---|
| Rebase-merge | отклонён владельцем |
| Squash-merge | выбран |

## Decision

1. Короткоживущие ветки от `main`; PR строится на `main`, не на ветке другого PR.
2. Ветка обновляется rebase-ом; `main` в неё не вливается.
3. В `main` - squash-merge, один коммит на PR.
4. Чужую ветку не переписывать.
5. Релизы режет владелец; поддерживаемых релизных линий нет.
6. Откат: деплой - ADR-019; схема БД - ADR-013.

## Consequences

- Плюс: история `main` - один законченный коммит на PR.
- Минус: отдельные коммиты ветки в `main` не попадают.

## Confirmation

Защита ветки и настройка кнопки слияния (backlog GUARD-2).

## Revisit when

- Появляются соавторы (профиль scale).
- Нужна история `main` для `git bisect` по шагам.

## Related

SPEC.md R23, standard ADR-026, ADR-013, ADR-019.
