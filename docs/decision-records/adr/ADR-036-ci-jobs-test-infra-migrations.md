# ADR-036: CI: раскладка jobs, тестовая среда из compose, контракт миграций, инструменты образа

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-12 |
| **Author** | агент (по запросу владельца) |
| **Decided by** | владелец: одобрил решения CI-2 в чате 2026-11-12 |
| **Tags** | ci, docker, migrations, security |

## Context

- ADR-018, 026, 027, 028, 029, 030 задают шаги, реестр, устройство образа и проверки. Не заданы:
  - раскладка jobs относительно обязательного чека `ci` и права каждого;
  - как поднять Postgres и NATS (ADR-018 пишет «service containers»);
  - каталог и команда миграций, которых в репозитории нет;
  - способ поставки hadolint и Trivy, порядок «собрать, проверить, отправить», набор образов на `main`.
- `compose.yaml` (ADR-033) уже держит версии и аргументы запуска: Postgres 18.6 с `wal_level=logical`, NATS с `-js`, БД `bf_test` (TST-3).
- SPEC.md R24: полная схема как DDL лежит в `database/schema/` с типизированной парой; миграции - дельта, путь к базе, не читаемое состояние.

## Options considered

| Вопрос | Вариант | Плюсы | Минусы | Итог |
|---|---|---|---|---|
| Jobs | `ci` + `image` + `publish` | имя `ci` не меняется; `packages: write` только в `publish` | `image` не обязателен, пока владелец не добавит | выбран |
| Jobs | всё в `ci` | ничего не менять на GitHub | право записи пакетов на весь job (против ADR-028) | отклонён |
| Jobs | отдельные workflow | изоляция | дубли setup, обязательные чеки сложнее | отклонён |
| Среда e2e | `docker compose` из `compose.yaml` | один источник версий и настроек с локалкой | формально не «service container»; нужно ожидание готовности | выбран |
| Среда e2e | `services:` и `docker run` для NATS | ближе к тексту ADR-018 | версии в двух местах | отклонён |
| Сканер | Trivy для секретов и уязвимостей | один инструмент, один pin | свой код запуска | выбран |
| Сканер | gitleaks для слоёв и Trivy для уязвимостей | gitleaks уже есть | два сканера на образ | отклонён |
| Поставка | Docker-образы по digest | один способ, как для БД и NATS | нужен Docker (есть на runner) | выбран |
| Поставка | бинарь с sha256 (как `gitleaks.yml`) или action | - | образцу `gitleaks.yml` нужен свой скрипт на каждый инструмент; action - чужой код | отклонён |

## Decision

1. **Jobs.** Триггеры: `push` в `main` и `pull_request`; `pull_request_target` не используется. Верхний уровень: `permissions: contents: read`.

| Job | Когда | Что делает | Права |
|---|---|---|---|
| `ci` | PR и `main` | шаги ADR-018: tsc, prettier, eslint, границы, unit, e2e, миграции, чарт | `contents: read` |
| `image` | PR и `main` | hadolint; сборка без push; скан слоёв на секреты (блокирует); уязвимости в summary | `contents: read` |
| `publish` | только push в `main`, `needs: [ci, image]` | сборка из кэша, скан, push, анонимный pull | `contents: read`, `packages: write` |

2. **Имена проверок.** `image` - один job без matrix, имя стабильно. Владелец добавляет `image` в обязательные проверки `main` (путь - `docs/runbooks/github-settings.md`). `publish` не обязателен: на PR его нет.
3. **Порядок образа в `publish`.** Сборка с `load` из кэша, который заполнил `image` -> скан слоёв Trivy (находка останавливает run до push) -> push из того же кэша с SBOM и provenance -> `docker pull` без авторизации (ADR-026).
4. **Тестовая среда.** `pnpm local:up` (`compose.yaml`, без профиля `cdc`, `--wait`) и БД `bf_test`. Шаг поднимается и e2e запускается, только если `turbo run test:e2e --dry=json` показывает хотя бы одну задачу с командой. Задача `test:e2e` в `turbo.json`: без кэша, `dependsOn: ^build`, `passThroughEnv: DATABASE_URL, NATS_URL` (`envMode: strict`). Это уточнение «service containers» в ADR-018.
5. **Миграции.**
   - Каталог `apps/backend/migrations/`; файлы `*.sql` только вперёд (ADR-013), применяются по имени, каждый одной транзакцией: `psql -v ON_ERROR_STOP=1 --single-transaction`. Каталог и команда - константа `CONTRACT` в `scripts/check-migrations.ts`, больше нигде.
   - Проверка идёт только на PR и пропускается, если против merge-base нет изменений в каталоге. Иначе: нет файлов `down`; файл, уже бывший в base, не правится и не удаляется (ADR-013: каждая запись истории - факт); применяются файлы base, затем добавленные PR; любая ошибка - красный.
   - База - свежий контейнер той же версии, что в `compose.yaml` (читается оттуда), без init-скриптов репозитория, без учётных данных.
   - R24 не конфликтует: `database/schema/` и типизированная пара - отдельный артефакт, появляется с первой БД-фичей; этот каталог - дельта. Drizzle Kit, когда придёт (ADR-013), пишет в этот каталог (`out`); механизм применения на проде (Pre-sync Job, ADR-019) выбирает CHART-2.
6. **Инструменты образа.** hadolint 2.15.1 и Trivy 0.76.1 запускаются как Docker-образы по digest из `scripts/image-check.ts` (там же digest'ы). hadolint блокирует на уровне `error`; Trivy: секреты блокируют, HIGH и CRITICAL с исправлением - в summary job, не блокируют (ADR-029). Actions закреплены по 40-символьному SHA; версии вне кулдауна (ADR-005): build-push-action 7.4.0, setup-buildx-action 4.4.1, login-action 4.7.0, metadata-action 6.2.0.
7. **Образы.** `ghcr.io/freydv/bf-backend`, `ghcr.io/freydv/bf-frontend`, тег - SHA коммита, без `latest`. На `main` собираются и публикуются оба. На PR собираются затронутые приложения (`turbo ls --affected`); изменение `.dockerignore`, `scripts/image-check.ts` или `ci.yml` затрагивает оба.
8. **База образа.** `node:26.13.0-slim@sha256:...`: тег совпадает с `.nvmrc`, digest закрепляет (уточняет п. 1 ADR-027, где назван `node:26-slim`). Версии pnpm и turbo в Dockerfile берутся из `package.json`.
9. **Конкуренция.** Отмена идущего run - только для PR; run на `main` не отменяется.
10. **Вне CI-2.** Коммит SHA в `deploy/apps/<app>/image.yaml` (ADR-030) - DEPLOY-1; `publish` без `contents: write`. Политика хранения образов (ADR-026 п. 7) - своя строка backlog.

## Consequences

- Плюс: права разведены буквально по ADR-028; версии БД и NATS одни для локалки и CI.
- Плюс: образ проверяется на PR, до `main`.
- Минус: пока владелец не добавил `image` в обязательные проверки, PR с плохим Dockerfile слить можно.
- Минус: первый run `publish` красный на анонимном pull, пока владелец не сделал пакеты публичными (ADR-026 п. 2).
- Минус: сканируются слои, собранные из того же кэша, а не побайтово образ, ушедший в push; config образа может отличаться временем.
- Минус: новое приложение требует шагов в `image` и `publish` (ревью, ADR-028).
- Минус: Trivy не считает находкой публичные примеры ключей из документации (проверено на `AKIAIOSFODNN7EXAMPLE`).
- Минус: на `main` ожидающий run вытесняется новым (по документации GitHub, не проверено); образ каждого SHA не гарантирован, образ последнего - да.
- Минус: `--single-transaction` исключает `CREATE INDEX CONCURRENTLY`; правила для него нет (backlog).
- Минус: digest базового образа обновляется вручную PR после кулдауна (backlog).
- Дальше: DEPLOY-1 (коммит тега), политика хранения GHCR, правило для `CONCURRENTLY`, процесс бампа digest.

## Confirmation

`pnpm migrations:test` (фикстуры, реальный Postgres, шаг `ci`); шаги `image` и `publish` в `ci.yml`; `grep 'uses:' .github/workflows` - у каждой строки 40-символьный SHA; ревью: права job, имена обязательных проверок в runbook.

## Revisit when

- Drizzle Kit или механизм применения на проде требует другой каталог или команду, чем `CONTRACT`.
- Появляется второй разработчик: Trivy блокирует по уязвимостям, недельный прогон (ADR-029).
- Кэш `gha` вытесняется настолько, что сборки в `publish` идут без кэша.
- Миграция, прошедшая проверку, ломает прод (ADR-018).

## Related

ADR-005, ADR-013, ADR-018 (уточняет «service containers»), ADR-026, ADR-027 (уточняет п. 1), ADR-028, ADR-029, ADR-030, ADR-033; backlog CI-2, DEPLOY-1.
