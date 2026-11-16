# ADR-076: Обновление digest образов: скрипт `image:pins`, еженедельная проверка и PR (исполняет ADR-027 п. 1)

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-16 |
| **Author** | агент |
| **Decided by** | агент по поручению владельца, ADR-063 п. 2 (техническая развилка) |
| **Tags** | images, supply-chain, ci |

## Context

- ADR-027 п. 1: базовый образ `node` закреплён тегом и digest, digest обновляется PR после кулдауна 7 дней (ADR-005); тег равен `.nvmrc`. ADR-036: hadolint и Trivy тоже закреплены digest. Механизма не было: обновление - вручную, кулдаун и равенство тега `.nvmrc` никто не проверял (IMG-1).
- Пины лежат в трёх файлах: `apps/backend/Dockerfile`, `apps/frontend/Dockerfile` (по два `FROM node`) и `scripts/image-check.ts` (hadolint, Trivy).
- Dependabot владелец не включает (ADR-062); Renovate - приложение GitHub, то есть настройка репозитория владельца и новый инструмент.

## Options considered

| Вариант | Итог | Почему |
|---|---|---|
| Свой скрипт `scripts/image-pins.ts` (без зависимостей) + еженедельная проверка + PR агента | выбран | без новых инструментов и прав; кулдаун считается по дате сборки образа из реестра |
| Renovate | отклонён | приложение GitHub (настройка владельца), новый инструмент и конфиг |
| Dependabot `docker` | отклонён | ADR-062; Dockerfile-ы он обновит, а пины в `scripts/image-check.ts` нет |
| Workflow сам открывает PR | отклонён | нужны `contents: write` и `pull-requests: write`, а PR от `GITHUB_TOKEN` не запускает CI |

## Decision

1. `pnpm image:pins check` (без сети, шаг `Image pins` в `ci`): у каждого Dockerfile есть `FROM node:<.nvmrc>-slim@sha256:...`, все `node` закреплены одним digest.
2. `pnpm image:pins bump`: для каждого пина берёт digest, который реестр (Docker Hub, анонимно) отдаёт для того же тега сейчас, и записывает его, только если образ собран не меньше 7 дней назад (время `created` образа linux/amd64). `--dry-run` ничего не пишет и выходит с кодом 1, когда обновление пора делать.
3. `.github/workflows/image-pins.yml`: по понедельникам `bump --dry-run`, права `contents: read`. Упавший прогон - письмо владельцу «пора обновить»; обновление делает агент: ветка, `pnpm image:pins bump`, PR, CI собирает образы с новым digest, слияние на зелёном (ADR-063).
4. Смена тега (новый `.nvmrc`, новая версия hadolint или Trivy) - ручная правка тега в PR; digest заполняет `bump` с той же проверкой кулдауна; `check` не пропустит тег `node`, не равный `.nvmrc`.

## Consequences

- Плюс: обновление digest - одна команда с проверкой кулдауна; расхождение тега и `.nvmrc` ловит CI.
- Минус: новые версии hadolint и Trivy не ищутся, освежается только digest того же тега; переход на новую версию - решение человека или агента.
- Минус: кулдаун считается от времени сборки образа, а не от публикации тега; для пересобранного тега это одно и то же.
- Минус: «пора обновить» приходит письмом об упавшем workflow, а не PR.

## Confirmation

- `pnpm image:pins:test`: чтение пинов, отказ при теге не из `.nvmrc` и разных digest, запись только после 7 дней, пины этого репозитория проходят `check`.
- 2026-11-16: `node scripts/image-pins.ts bump --dry-run` против Docker Hub - все 6 пинов совпадают с реестром, обновлять нечего.

## Revisit when

- Владелец подключает Renovate или другой бот обновлений: он заменяет `bump` и workflow.
- Пины появятся в других файлах (`compose.yaml`, чарты): расширить `pinFiles`.

## Related

ADR-005, ADR-027, ADR-036, ADR-062, ADR-063, ADR-072; backlog IMG-1 (в архиве).
