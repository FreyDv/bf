# Бэклог

> Единый упорядоченный список работы, которую репозиторий ещё должен сам себе. Markdown и agent-first; совместим с [Backlog.md](https://github.com/MrLesk/Backlog.md). Работа ведётся здесь, внешнего трекера нет.

## Alignment scope (выравнивание по стандарту)

Артефакт Gate 5: число, по которому владелец решает go/no-go. Считается только работа выравнивания (спеки, решения, гарды); каркас и инфраструктура - продуктовая работа и в число не входят.

```
Alignment scope for this repo -> standard@1.0.19
  specs to write / raise to buildable .........  1
  decisions to record or confirm (ADR/BDR) ....  9
  drift to reconcile ..........................  0
  guards / structure to install ...............  0
  ---------------------------------------------
  10 tasks to full alignment
```

Из чего число: спека - SPEC-1; решения - BUDGET-1, SEC-1, TEST-1, CI-1, AUTH-1, STACK-2, STACK-3, OBS-1, DBSEC-2; гардов нет. Роль-владелец - в строке каждого id ниже.

`drift 0` и ненулевое число не противоречат друг другу: дрейф измеряет то, что стандарт проверяет механически, а число - то, что механически не проверить.

## Order

Вверху - следующее. Владелец 2026-11-12: сначала инфраструктура до прода, чтобы фичи ложились на готовое; продуктовые вопросы - после. Эпики идут в порядке: открытые решения -> гарды -> каркас -> кластер -> продукт -> события. Внутри эпика строка опирается только на строки выше; `blocked:<id>` называет, чего ждёт строка. Формат строки - в [стандарте](standards/vendor/repository-standards-core/standard/docs/backlog.md).

## Epic: Открытые решения

| id | title | cap | persona | owner | assignee | size | why | source | DoD | status |
|----|-------|-----|---------|-------|----------|------|-----|--------|-----|--------|
| SEC-1 | Базовая безопасность: ответ на каждую ось `security-baseline.md` | - | Maintainer (internal) | architect |  | M | R7, R19; слот Debezium и закрытый ключ Sealed Secrets уже критичные точки (ADR-021, ADR-020) | decision | каждая ось отвечена или «не применимо» | todo |
| TEST-1 | Стратегия тестирования: уровни и где они выполняются | - | Maintainer (internal) | architect |  | S | R7; TST-1..5 задают форму, но не место выполнения | decision | ADR Accepted | todo |
| CI-1 | Окружения, TLS и ingress, исключение бота для коммита тега (ADR-030: проверить, подходит ли GITHUB_TOKEN) | - | Maintainer (internal) | architect |  | M | без них не собрать и не выкатить первый образ (ADR-018, ADR-019) | decision | ADR Accepted на каждый пункт | todo |
| AUTH-1 | Аутентификация и авторизация | - | `Владелец-оператор` | architect |  | M | развилка R7 без записи; нужна до первой спеки с доступом; владелец решил 2026-11-11: отдельные аккаунты и авторизация у Дани и Валерии, права раздаёт Даня позже (`docs/discovery/product-vision/`) | decision | ADR Accepted | todo |
| STACK-2 | Объектное хранилище (DO Spaces создан, решения нет) | - | Maintainer (internal) | architect |  | S | ресурс существует, решение не записано (ADR-017) | decision | ADR Accepted или «не нужно» одной строкой | todo |
| STACK-3 | AI-провайдер (OpenAI) | - | `Владелец-оператор` | architect |  | S | ключ OpenAI уже назван в ADR-020; владелец выбрал OpenAI 2026-11-11 (разбор видео и аудио курсов, подсказки при готовке; `docs/discovery/product-vision/`), ADR не записан | decision | ADR Accepted | todo |
| OBS-1 | Логи: срок хранения, потолок цены, сборщик, размеры, доступ к Grafana, схема полей | - | Maintainer (internal) | architect |  | S | ADR-032 выбрал pino и Loki, но срок хранения владелец отложил (2026-11-11) | decision | срок и потолок цены записаны в ADR-032 или новом ADR | todo |
| DBSEC-2 | Надёжность записи `bfdb`: `synchronous_commit=off` на DO - принять или включить `on` для команд (outbox, ADR-025) | - | Maintainer (internal) | architect |  | S | после сбоя узла подтверждённая команда может потерять последние транзакции; DO задаёт параметр на кластере (снимок 2026-11-11, `docs/runbooks/bfdb-postgres.md`) | decision: анализ bfdb 2026-11-11 | ADR Accepted: принято как есть или `SET LOCAL synchronous_commit=on` для критичных команд; решение внесено в ADR-025 или новый ADR | todo |

## Epic: Гарды репозитория

| id | title | cap | persona | owner | assignee | size | why | source | DoD | status |
|----|-------|-----|---------|-------|----------|------|-----|--------|-----|--------|

## Epic: Каркас монорепо

| id | title | cap | persona | owner | assignee | size | why | source | DoD | status |
|----|-------|-----|---------|-------|----------|------|-----|--------|-----|--------|
| CI-2 | Workflow CI на PR и при merge в `main` | - | Maintainer (internal) | dev |  | M | гарантия вместо обходимого хука (ADR-018) | decision: ADR-018, ADR-036 | первый зелёный run `publish` на `main`: образы `ghcr.io/freydv/bf-backend` и `bf-frontend` с тегом SHA в GHCR, анонимный pull проходит; `image` добавлен в обязательные проверки (сделано в коде и ADR-036: шаги ADR-018 в `ci.yml`, e2e и миграции ждут первого `test:e2e` и первой миграции, jobs `image` и `publish`, Dockerfile обоих приложений, `scripts/check-migrations.ts` и `scripts/image-check.ts` с тестами; осталось руками владельца: `image` в обязательные проверки и публичные пакеты GHCR, пути в `docs/runbooks/github-settings.md`) | doing |
| CONTRACT-2 | Образ frontend: `next build` после `turbo prune` не видит `.request.dto.ts` backend, на которые ссылается сгенерированный `server.ts` | - | Maintainer (internal) | dev |  | S | `packages/contracts` импортирует DTO backend относительным путём, а не через `package.json`; `turbo prune @bf/frontend` их не возьмёт, и проверка типов в образе упадёт, как только появится первый роутер (ADR-035, ADR-027 предупреждает о таком случае) | drift: проба CONTRACT-1 2026-11-11 | в Dockerfile frontend решение записано (зависимость для prune или копирование DTO) и сборка образа с роутером проходит; выбор вписан в ADR-027 или новый ADR | todo |
| QUERY-1 | Пакет фильтров query (`core`, `zod`, `drizzle`), пакет контрактов, правила границ | - | Maintainer (internal) | dev |  | M | ADR-024 и QRY-правила записаны, инструмента нет; первый list-query нечем писать | decision: ADR-024 | сначала проверка в ESM и по HTTP и через `pnpm contracts:generate` (схема из настоящей `toZod(S)` доходит до типа `RouterInputs` во frontend; на фабрике той же формы проверено 2026-11-11): схема из фабрики принимает и отклоняет то же, что обещает тип, иначе supersede ADR-012; затем пакеты с тестами QRY-18 и правила dependency-cruiser QRY-19 в CI | todo |
| QUERY-2 | Сортировка, пагинация и текстовый поиск в query | - | Maintainer (internal) | architect |  |  | ADR-024 описывает только фильтр; `ilike` нет в контракте, без него нет поиска по подстроке | decision: ADR-024 | решение записано и дополняет QRY-правила; вход query расширен без поломки клиентов | blocked:QUERY-1 |
| BOUND-1 | Проверка границ: место для shared kernel (ENF-4) и `Result` в домене (ADR-015 против `dep-3-domain-no-libraries`) | - | Maintainer (internal) | architect |  | M | `dep-5` требует `public/` у каждой папки в `src/`, а `dep-3` запрещает npm-импорты в `domain/`; первый модуль упрётся в конфиг, а ослаблять его без ADR нельзя (ADR-014) | review: pre-push 2026-11-11 | в конфиге явное исключение для shared kernel с фикстурой в `scripts/boundaries.test.ts`; ADR записывает, может ли домен импортировать `Result`; `pnpm deps:test` зелёный | todo |
| CI-3 | `ci.yml`: проверка целостности pnpm при установке | - | Maintainer (internal) | dev |  | S | `npm install -g pnpm` без проверки (отмена только для PR и `.dockerignore` без `dist` и `.next` сделаны в CI-2, ADR-036) | review: pre-push 2026-11-11 | установка pnpm в `ci.yml` закреплена и проверяется | todo |
| GHCR-1 | Политика хранения образов GHCR: последние N по SHA плюс тот, что в `image.yaml` | - | Maintainer (internal) | dev |  | S | ADR-026 п. 7 ждёт значения N; без чистки пакеты растут с каждым merge | decision: ADR-026 | N выбрано и записано в ADR-026 или новом ADR; чистка настроена на GitHub или job; проверено, что образ из `image.yaml` не удаляется | blocked:CI-2 |
| MIGR-1 | Правило для `CREATE INDEX CONCURRENTLY` при транзакционном применении миграций | - | Maintainer (internal) | architect |  | S | проверка применяет файл одной транзакцией (`--single-transaction`, ADR-036), а `CONCURRENTLY` в транзакции невозможен; ADR-018 назвал это последствием без правила | decision: ADR-018 | правило записано (ADR-036 дополнен или новый ADR): как помечается файл без транзакции и как его применяют проверка в CI и деплой; `scripts/check-migrations.ts` и фикстуры его понимают; нужно до первого такого индекса | todo |
| IMG-1 | Обновление digest базового образа `node` и инструментов в `scripts/image-check.ts` | - | Maintainer (internal) | dev |  | S | ADR-027 п. 1: digest обновляется PR с кулдауном 7 дней, механизма нет; тег в Dockerfile должен совпадать с `.nvmrc`; digest hadolint и Trivy тоже вручную (ADR-036) | decision: ADR-027 | процесс записан и работает (какой PR, кто и чем его открывает, как проверяется кулдаун, как тег остаётся равен `.nvmrc`); новый инструмент ушёл через ADR | todo |
| IMG-2 | Образ backend несёт `next` и `typescript` через peer-зависимости `@trpc/server` и `nestjs-trpc` | - | Maintainer (internal) | dev |  | S | в `node_modules` образа 434 МБ, из них `next` (около 210 МБ) и бинарники SWC; `pnpm why next --filter @bf/backend --prod` и то же для `typescript` показывают путь через `@trpc/server` и `nestjs-trpc`; не проверено, нужны ли они рантайму | drift: сборка образа CI-2 2026-11-12 | выяснено, нужны ли `next` и `typescript` рантайму backend; лишнее исключено (`pnpm.overrides` или `peerDependencyRules`, с ADR, если это ложится на ADR-005) или причина оставить записана | todo |
| DEPS-1 | Обновить actions до новых мажорных версий | - | Maintainer (internal) | dev |  | S | `ci.yml` на `actions/checkout` v5.0.1, `setup-node` v5.0.0, `cache` v5.1.0, на 2026-11-12 последние v7.0.1, v7.1.0, v6.1.0; все по 40-символьному SHA, версия вне кулдауна | drift: сверка релизов 2026-11-12 | версии подняты с SHA и комментариями во всех workflow; `node scripts/self-verify.mjs` зелёный | todo |
| SCHEMA-1 | `database/schema/` и типизированная пара схемы (R24) к первой БД-фиче | - | Maintainer (internal) | architect |  | S | R24: репозиторий с базой несёт DDL в `database/schema/` и типизированное описание 1:1; сейчас их нет, а `scripts/schema-pair.mjs` пропускает; каталог миграций CI-2 (`apps/backend/migrations/`) - дельта, не замена (ADR-036) | decision: SPEC.md R24 | решено, где лежит пара для Drizzle (ADR-013), и что делает `schema-pair.mjs` в репозитории; нужно до первой БД-фичи | todo |
| HOOKS-2 | Установка lefthook при `pnpm install` на свежем клоне | - | Maintainer (internal) | dev |  | S | в `package.json` нет `prepare`: на новом клоне pre-commit не стоит, а AGENTS.md и ADR-018 считают его стоящим | review: pre-push 2026-11-11 | свежий клон после `pnpm install` имеет работающий pre-commit | todo |
| LOCAL-2 | Локальная среда: переопределения `.env` и размеры WAL | - | Maintainer (internal) | dev |  | S | `POSTGRES_DB` из `.env` ломает init-SQL и Debezium (имя `bf_dev` и пароль вписаны в файлы); init идёт только на пустом томе; `wal_keep_size=2920MB` тяжёл для Docker с 2 ГБ (ADR-033) | review: pre-push 2026-11-11 | файлы читают имя базы и пароль из одного места или ADR-033 запрещает переопределение; ограничение init и размеры WAL описаны | todo |

## Epic: Кластер и деплой

| id | title | cap | persona | owner | assignee | size | why | source | DoD | status |
|----|-------|-----|---------|-------|----------|------|-----|--------|-----|--------|
| RUNBOOK-1 | Runbook облачного слоя DO: `malinina`, `bfdb`, Load Balancer, firewall, Spaces, bootstrap ArgoCD, порядок восстановления | - | Maintainer (internal) | dev |  | M | слой создан руками и нигде не записан (R3); без runbook кластер не восстановить (ADR-017); снимок `bfdb` и `malinina` сделан 2026-11-11 (`docs/runbooks/bfdb-postgres.md`, `malinina-kubernetes.md`), осталось: Spaces, порядок восстановления, самоуправление ArgoCD из `deploy/argocd/` (сам ArgoCD поставлен 2026-11-11, команды bootstrap - в `malinina-kubernetes.md`), доступ к UI и смена начального пароля | decision: ADR-017 | в `docs/runbooks/` точные имена, регион, размеры, правила и порядок восстановления; сверено с консолью DO | todo |
| SEALED-1 | Установка контроллера Sealed Secrets | - | Maintainer (internal) | dev |  | S | без контроллера секреты не расшифровать (ADR-020) | decision: ADR-020 | ArgoCD-приложение синхронизировано; версия закреплена; флаги `kubeseal`, ротация и происхождение пары ключей сверены с документацией; закрытый ключ в менеджере паролей | todo |
| CHART-2 | Первый выкат приложения с секретом и миграцией: SealedSecret против Pre-sync Job | - | Maintainer (internal) | architect |  | S | миграция идёт хуком Pre-sync до основной синхронизации, а SealedSecret и Secret создаются в ней же: на первом выкате Job не найдёт секрет БД; нужен порядок или предварительное применение секрета (ADR-019, CHART-1; не проверено на кластере) | decision: CHART-1 | порядок проверен на кластере (dry-run или тестовое приложение) и записан в ADR-019 или новом ADR и в runbook; чарт соответствует | todo |
| SECRETS-1 | Скрипт `scripts/seal-secret.ts` и `secrets:seal` в каждом приложении | - | Maintainer (internal) | dev |  | S | ручной `kubeseal` в shell противоречит предпочтению TS-скриптов (ADR-020) | decision: ADR-020 | `pnpm secrets:seal` перезаписывает `secrets.yaml` из `.env.production`; открытых значений нигде нет | blocked:SEALED-1 |
| NATS-1 | Установка NATS JetStream: Helm-чарт в `deploy/argocd/`, одна реплика, PVC, стрим для событий | - | Maintainer (internal) | dev |  | M | очередь для событий и задач; Debezium пишет в стрим, который должен существовать (ADR-022) | decision: ADR-022 | ArgoCD-приложение синхронизировано, PVC привязан, публикация и чтение в стриме проходят, версия чарта с кулдауном | todo |
| OBS-2 | Установка Loki и Grafana: ArgoCD-приложения в `deploy/argocd/`, чанки в Spaces, версии закреплены | - | Maintainer (internal) | dev |  | M | поиск по логам (ADR-032) | asked: owner 2026-11-11 | приложения синхронизированы; логи подов backend видны и ищутся в Grafana | blocked:RUNBOOK-1 |
| DEPLOY-1 | Первый выкат backend и frontend в кластер: образы из CI в GHCR, коммит тега в `deploy/apps/<app>/image.yaml`, ArgoCD-приложения, ingress | - | Maintainer (internal) | dev |  | L | без выката в кластере нечего проверять (ADR-018, ADR-019, ADR-026); образы с тегом SHA публикует CI-2, коммит тега ботом перенесён сюда (ADR-030) | asked: owner 2026-11-11 | job CI после публикации пишет SHA в `image.yaml` и коммитит в `main` под `concurrency`, с `pull --rebase` и повтором, `helm template` до коммита, шаг проверяет, что diff содержит только `image.yaml`; право `contents: write` только у этого job; оба приложения в состоянии Synced и Healthy; frontend отвечает по адресу из CI-1 | blocked:CI-1 |

## Epic: Продукт

| id | title | cap | persona | owner | assignee | size | why | source | DoD | status |
|----|-------|-----|---------|-------|----------|------|-----|--------|-----|--------|
| BUDGET-1 | BDR: бюджет облака | - | `Владелец-оператор` | product |  | S | ADR-022 опирается на бюджет $100-150 в месяц, `PRODUCT.md` ссылается на BDR о бюджете, а записи нет | decision: реорганизация ADR 2026-11-07 | BDR с потолком затрат и правилом выбора (дёшево простаивает) Accepted | todo |
| METRICS-1 | North Star и метрики успеха - после первых фич | - | `Владелец-оператор` | product |  | S | владелец 2026-11-12: успех - движение по цепочке «курс -> ингредиенты -> заготовка -> готовое -> продано», мерить только деньгами или заказами не хочет, числа отложил: «мы только начинаем» | decision: PRODUCT-1, владелец 2026-11-12 | владелец выбрал числа по опыту первых фич, раздел «Success metrics» в `PRODUCT.md` их называет, порог ставки записан; кандидаты - досье `product-vision` 2026-11-12 | blocked:SPEC-1 |
| SPEC-1 | Первая спека возможности | - | `Владелец-оператор` | product |  | M | без спеки нет работы по циклу стандарта | asked: owner 2026-11-05 | спека проходит clarify-гейт и записана в `capability-map.json` | todo |

## Epic: События (CDC)

| id | title | cap | persona | owner | assignee | size | why | source | DoD | status |
|----|-------|-----|---------|-------|----------|------|-----|--------|-----|--------|
| CDC-1 | SQL-файл репликации Postgres и его шаг в миграционном Job | - | Maintainer (internal) | dev |  | M | единый источник правды репликации (ADR-023) | decision: ADR-023 | функции слота и таблицы и их вызовы в репозитории; шаг после миграций идемпотентен; применение на кластере - человек (красный флаг 1) | todo |
| CDC-2 | Файл настроек Debezium Server и Deployment (1 реплика, `Recreate`, хеш файла в аннотации) | - | Maintainer (internal) | dev |  | M | единый источник правды Debezium; правка файла перезапускает под (ADR-023) | decision: ADR-023 | файл и манифест в `deploy/`; `helm template` меняет хеш при правке; секреты через Sealed Secrets; версия образа с кулдауном | blocked:NATS-1 |
| CDC-3 | Роль Debezium с REPLICATION, мониторинг слота и удерживаемого WAL, проба здоровья | - | Maintainer (internal) | dev |  | M | слот держит WAL без предела; остановленный коннектор заполнит диск `bfdb` (ADR-021) | decision: ADR-021 | отдельная роль вместо `doadmin`; алерт на размер удерживаемого WAL; проба здоровья пода; всё описано в RUNBOOK-1 | blocked:CDC-2 |

## Statuses

`todo` / `doing` / `blocked:<id>` / `done`. Закрытая строка уходит в [`backlog-archive.md`](backlog-archive.md) с указателем на то, во что превратилось её содержимое.
