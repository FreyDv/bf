# Runbook: настройки репозитория на GitHub

Serves: владелец и агент, действующий за него. Настройки живут на GitHub, не в git, поэтому записаны здесь (R3). Применены 2026-11-11 (GUARD-2, ADR-003).

## Diagnose

- Слияние и ветка: `gh api repos/FreyDv/bf --jq '[.allow_squash_merge,.allow_merge_commit,.allow_rebase_merge,.delete_branch_on_merge]'` -> `[true,false,false,true]`
- Защита `main`: `gh api repos/FreyDv/bf/branches/main/protection`

## Ожидаемое состояние

| Что | Значение | Откуда |
|---|---|---|
| Способ слияния | только squash; ветка удаляется после слияния | ADR-003 |
| Прямой push в `main` | запрещён, нужен PR, 0 одобрений (владелец один) | ADR-003 |
| Защита на админа (`enforce_admins`) | да | решение владельца 2026-11-11: проверки не обходятся |
| Обязательные проверки | `ci`, `spec-guard`, `secret scan` | `.github/workflows/ci.yml`, `spec-guard.yml`, `gitleaks.yml` |
| Актуальность ветки (`strict`) | нет | решение владельца 2026-11-11 |
| Force-push и удаление `main` | запрещены | R23 |

Имя проверки - это имя job, а при заданном `name` - оно. Переименовал job в workflow - обнови список в защите, иначе PR зависнет в ожидании проверки, которой нет.

## Common failures

| Symptom | Cause | Fix |
|---|---|---|
| PR вечно ждёт проверку | в защите имя, которого нет в workflow (например, остаток `ci ok` прототипа) | поправить список обязательных проверок |
| Нужно срочно залить в `main` в обход | защита действует и на админа | временно снять `enforce_admins`, залить, вернуть; записать причину в PR |

## Rollback

Снять защиту целиком: `gh api -X DELETE repos/FreyDv/bf/branches/main/protection`. Вернуть: повторить настройки таблицы выше через `gh api -X PUT repos/FreyDv/bf/branches/main/protection` или в Settings -> Branches.
