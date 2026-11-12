# Runbook: настройки репозитория на GitHub

Serves: владелец и агент, действующий за него. Настройки живут на GitHub, не в git, поэтому записаны здесь (R3). Применены 2026-11-11 (GUARD-2, ADR-003).

## Diagnose

- Слияние и ветка: `gh api repos/FreyDv/bf --jq '[.allow_squash_merge,.allow_merge_commit,.allow_rebase_merge,.delete_branch_on_merge]'` -> `[true,false,false,true]`
- Защита `main`: `gh api repos/FreyDv/bf/branches/main/protection`
- Обязательные проверки: `gh api repos/FreyDv/bf/branches/main/protection/required_status_checks --jq '.contexts'` -> `["ci","image","spec-guard","secret scan"]` (`image` - после ручного добавления ниже)
- Видимость пакета образа: `gh api users/FreyDv/packages/container/bf-backend --jq '.visibility'` -> `public` (то же для `bf-frontend`; пакет появляется после первой публикации)

## Ожидаемое состояние

| Что | Значение | Откуда |
|---|---|---|
| Способ слияния | только squash; ветка удаляется после слияния | ADR-003 |
| Прямой push в `main` | запрещён, нужен PR, 0 одобрений (владелец один) | ADR-003 |
| Защита на админа (`enforce_admins`) | да | решение владельца 2026-11-11: проверки не обходятся |
| Обязательные проверки | `ci`, `image`, `spec-guard`, `secret scan` | `.github/workflows/ci.yml` (jobs `ci` и `image`), `spec-guard.yml`, `gitleaks.yml`; `image` добавляется вручную, см. ниже (ADR-036) |
| Пакеты образов `ghcr.io/freydv/bf-backend`, `bf-frontend` | публичные, без pull-секрета в кластере | ADR-026; видимость задаётся вручную после первой публикации |
| Актуальность ветки (`strict`) | нет | решение владельца 2026-11-11 |
| Force-push и удаление `main` | запрещены | R23 |

Имя проверки - это имя job, а при заданном `name` - оно. Переименовал job в workflow - обнови список в защите, иначе PR зависнет в ожидании проверки, которой нет.

## Добавить `image` в обязательные проверки

Один раз, после того как job `image` отработал хотя бы на одном PR (GitHub предлагает в списке только проверки, запускавшиеся за последнюю неделю):

1. Репозиторий -> Settings -> Branches -> правило для `main` -> Edit.
2. Блок «Require status checks to pass before merging» -> поле поиска «Status checks that are required» -> ввести `image` -> выбрать строку `image` (источник GitHub Actions).
3. Save changes.
4. Проверить командой из раздела Diagnose.

Job `publish` обязательным не делают: на PR его нет, проверка зависла бы. Пока `image` не добавлен, hadolint и сборка образа на PR не защищают `main` (ADR-028, ADR-029).

## Сделать пакеты образов публичными

После первого зелёного `image` и первой публикации в `main` (job `publish`) пакет, по ожиданию владельца, создан приватным (видимость проверяется, не предполагается: ADR-026 п. 2); шаг «Pull ... anonymously» на первом прогоне красный, это ожидаемо (ADR-026 п. 2). Для каждого из `bf-backend` и `bf-frontend`:

1. github.com/FreyDv -> вкладка Packages -> пакет -> Package settings (справа).
2. Danger Zone -> «Change package visibility» -> Public -> ввести имя пакета -> подтвердить.
3. Actions -> красный run workflow `ci` на `main` (job `publish`) -> «Re-run failed jobs»: анонимный pull должен пройти.
4. Проверить командой из раздела Diagnose.

## Common failures

| Symptom | Cause | Fix |
|---|---|---|
| PR вечно ждёт проверку | в защите имя, которого нет в workflow (например, остаток `ci ok` прототипа) | поправить список обязательных проверок |
| `publish` красный на шаге «Pull ... anonymously» | пакет приватный (первая публикация) | раздел «Сделать пакеты образов публичными» |
| `publish` красный на шаге «Scan ... for secrets» | в слоях образа найден секрет; образ не отправлен | убрать секрет из сборки (ADR-020, ADR-026), ротировать, если он настоящий |
| Нужно срочно залить в `main` в обход | защита действует и на админа | временно снять `enforce_admins`, залить, вернуть; записать причину в PR |

## Rollback

Снять защиту целиком: `gh api -X DELETE repos/FreyDv/bf/branches/main/protection`. Вернуть: повторить настройки таблицы выше через `gh api -X PUT repos/FreyDv/bf/branches/main/protection` или в Settings -> Branches.
