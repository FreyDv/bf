# Бэклог

> Единый упорядоченный список работы, которую репозиторий ещё должен сам себе. Markdown и agent-first; совместим с [Backlog.md](https://github.com/MrLesk/Backlog.md). Работа ведётся здесь, внешнего трекера нет.

## Alignment scope (выравнивание по стандарту)

Артефакт Gate 5: число, по которому владелец решает go/no-go. Считается только работа выравнивания (спеки, решения, гарды); каркас и инфраструктура - продуктовая работа и в число не входят.

```
Alignment scope for this repo -> standard@1.0.19
  specs to write / raise to buildable .........  1
  decisions to record or confirm (ADR/BDR) .... 11
  drift to reconcile ..........................  0
  guards / structure to install ...............  0
  ---------------------------------------------
  12 tasks to full alignment
```

Из чего число: спека - SPEC-1; решения - PERSONAS-1, PRODUCT-1, BUDGET-1, SEC-1, TEST-1, CI-1, AUTH-1, STACK-2, STACK-3, OBS-1, DBSEC-2; гардов нет. Роль-владелец - в строке каждого id ниже.

`drift 0` и ненулевое число не противоречат друг другу: дрейф измеряет то, что стандарт проверяет механически, а число - то, что механически не проверить.

## Order

Вверху - следующее. Эпики идут в порядке зависимостей: продукт -> открытые решения -> гарды -> каркас -> кластер -> события. Внутри эпика строка опирается только на строки выше; `blocked:<id>` называет, чего ждёт строка. Формат строки - в [стандарте](standards/vendor/repository-standards-core/standard/docs/backlog.md).

## Epic: Продукт

| id | title | cap | persona | owner | assignee | size | why | source | DoD | status |
|----|-------|-----|---------|-------|----------|------|-----|--------|-----|--------|
| PERSONAS-1 | Подтвердить BDR-001 и персоны | - | `Владелец-оператор` | product |  | S | персоны - ворота валидации для каждой спеки; поля недоверия, целей и признаков успеха владелец отложил до первой спеки (2026-11-05), `[NEEDS DECISION]` о полномочиях MCP - до первой спеки про MCP | onboarding | маркеры `[NEEDS INPUT]` и `[NEEDS REVIEW]` сняты, BDR-001 Accepted | todo |
| PRODUCT-1 | North Star и метрики успеха в `PRODUCT.md` | - | `Владелец-оператор` | product |  | S | без них спеки пишут `Success metric: n/a` без причины | onboarding | раздел «Success metrics» заполнен | todo |
| BUDGET-1 | BDR: бюджет облака | - | `Владелец-оператор` | product |  | S | ADR-022 опирается на бюджет $100-150 в месяц, `PRODUCT.md` ссылается на BDR о бюджете, а записи нет | decision: реорганизация ADR 2026-11-07 | BDR с потолком затрат и правилом выбора (дёшево простаивает) Accepted | todo |
| SPEC-1 | Первая спека возможности | - | `Владелец-оператор` | product |  | M | без спеки нет работы по циклу стандарта | asked: owner 2026-11-05 | спека проходит clarify-гейт и записана в `capability-map.json` | todo |

## Epic: Открытые решения

| id | title | cap | persona | owner | assignee | size | why | source | DoD | status |
|----|-------|-----|---------|-------|----------|------|-----|--------|-----|--------|
| SEC-1 | Базовая безопасность: ответ на каждую ось `security-baseline.md` | - | Maintainer (internal) | architect |  | M | R7, R19; слот Debezium и закрытый ключ Sealed Secrets уже критичные точки (ADR-021, ADR-020) | decision | каждая ось отвечена или «не применимо» | todo |
| TEST-1 | Стратегия тестирования: уровни и где они выполняются | - | Maintainer (internal) | architect |  | S | R7; TST-1..5 задают форму, но не место выполнения | decision | ADR Accepted | todo |
| CI-1 | Окружения, TLS и ingress, исключение бота для коммита тега (ADR-030: проверить, подходит ли GITHUB_TOKEN) | - | Maintainer (internal) | architect |  | M | без них не собрать и не выкатить первый образ (ADR-018, ADR-019) | decision | ADR Accepted на каждый пункт | todo |
| AUTH-1 | Аутентификация и авторизация | - | `Владелец-оператор` | architect |  | M | развилка R7 без записи; нужна до первой спеки с доступом | decision | ADR Accepted | todo |
| STACK-2 | Объектное хранилище (DO Spaces создан, решения нет) | - | Maintainer (internal) | architect |  | S | ресурс существует, решение не записано (ADR-017) | decision | ADR Accepted или «не нужно» одной строкой | todo |
| STACK-3 | AI-провайдер (OpenAI) | - | `Владелец-оператор` | architect |  | S | ключ OpenAI уже назван в ADR-020, выбора нет | decision | ADR Accepted | todo |
| OBS-1 | Логи: срок хранения, потолок цены, сборщик, размеры, доступ к Grafana, схема полей | - | Maintainer (internal) | architect |  | S | ADR-032 выбрал pino и Loki, но срок хранения владелец отложил (2026-11-11) | decision | срок и потолок цены записаны в ADR-032 или новом ADR | todo |
| DBSEC-2 | Надёжность записи `bfdb`: `synchronous_commit=off` на DO - принять или включить `on` для команд (outbox, ADR-025) | - | Maintainer (internal) | architect |  | S | после сбоя узла подтверждённая команда может потерять последние транзакции; DO задаёт параметр на кластере (снимок 2026-11-11, `docs/runbooks/bfdb-postgres.md`) | decision: анализ bfdb 2026-11-11 | ADR Accepted: принято как есть или `SET LOCAL synchronous_commit=on` для критичных команд; решение внесено в ADR-025 или новый ADR | todo |

## Epic: Гарды репозитория

| id | title | cap | persona | owner | assignee | size | why | source | DoD | status |
|----|-------|-----|---------|-------|----------|------|-----|--------|-----|--------|

## Epic: Каркас монорепо

| id | title | cap | persona | owner | assignee | size | why | source | DoD | status |
|----|-------|-----|---------|-------|----------|------|-----|--------|-----|--------|
| CI-2 | Workflow CI на PR и при merge в `main` | - | Maintainer (internal) | dev |  | M | гарантия вместо обходимого хука (ADR-018) | decision: ADR-018 | шаги ADR-018 на PR и `main` (сделано: `tsc`, prettier, eslint, границы, unit в `ci.yml`; осталось: e2e, миграции, образ на `main`), проверка миграций на чистом Postgres, actions закреплены по digest | doing |
| QUERY-1 | Пакет фильтров query (`core`, `zod`, `drizzle`), пакет контрактов, правила границ | - | Maintainer (internal) | dev |  | M | ADR-024 и QRY-правила записаны, инструмента нет; первый list-query нечем писать | decision: ADR-024 | сначала проверка в ESM и по HTTP: схема из фабрики принимает и отклоняет то же, что обещает тип, иначе supersede ADR-012; затем пакеты с тестами QRY-18 и правила dependency-cruiser QRY-19 в CI | todo |
| QUERY-2 | Сортировка, пагинация и текстовый поиск в query | - | Maintainer (internal) | architect |  |  | ADR-024 описывает только фильтр; `ilike` нет в контракте, без него нет поиска по подстроке | decision: ADR-024 | решение записано и дополняет QRY-правила; вход query расширен без поломки клиентов | blocked:QUERY-1 |
| BOUND-1 | Проверка границ: место для shared kernel (ENF-4) и `Result` в домене (ADR-015 против `dep-3-domain-no-libraries`) | - | Maintainer (internal) | architect |  | M | `dep-5` требует `public/` у каждой папки в `src/`, а `dep-3` запрещает npm-импорты в `domain/`; первый модуль упрётся в конфиг, а ослаблять его без ADR нельзя (ADR-014) | review: pre-push 2026-11-11 | в конфиге явное исключение для shared kernel с фикстурой в `scripts/boundaries.test.ts`; ADR записывает, может ли домен импортировать `Result`; `pnpm deps:test` зелёный | todo |
| CI-3 | `ci.yml`: `cancel-in-progress` не для `main`, проверка целостности pnpm, `.dockerignore` без `dist` и `.next` | - | Maintainer (internal) | dev |  | S | новый push в `main` отменит идущую публикацию образа или коммит тега (ADR-028, ADR-030); `npm install -g pnpm` без проверки; образ потянет сборочный мусор (ADR-027) | review: pre-push 2026-11-11 | отмена только для PR; установка pnpm закреплена; `**/dist` и `**/.next` в `.dockerignore` | todo |
| HOOKS-2 | Установка lefthook при `pnpm install` на свежем клоне | - | Maintainer (internal) | dev |  | S | в `package.json` нет `prepare`: на новом клоне pre-commit не стоит, а AGENTS.md и ADR-018 считают его стоящим | review: pre-push 2026-11-11 | свежий клон после `pnpm install` имеет работающий pre-commit | todo |
| LOCAL-2 | Локальная среда: переопределения `.env` и размеры WAL | - | Maintainer (internal) | dev |  | S | `POSTGRES_DB` из `.env` ломает init-SQL и Debezium (имя `bf_dev` и пароль вписаны в файлы); init идёт только на пустом томе; `wal_keep_size=2920MB` тяжёл для Docker с 2 ГБ (ADR-033) | review: pre-push 2026-11-11 | файлы читают имя базы и пароль из одного места или ADR-033 запрещает переопределение; ограничение init и размеры WAL описаны | todo |

## Epic: Кластер и деплой

| id | title | cap | persona | owner | assignee | size | why | source | DoD | status |
|----|-------|-----|---------|-------|----------|------|-----|--------|-----|--------|
| RUNBOOK-1 | Runbook облачного слоя DO: `malinina`, `bfdb`, Load Balancer, firewall, Spaces, bootstrap ArgoCD, порядок восстановления | - | Maintainer (internal) | dev |  | M | слой создан руками и нигде не записан (R3); без runbook кластер не восстановить (ADR-017); снимок `bfdb` и `malinina` сделан 2026-11-11 (`docs/runbooks/bfdb-postgres.md`, `malinina-kubernetes.md`), осталось: Spaces, порядок восстановления, самоуправление ArgoCD из `deploy/argocd/` (сам ArgoCD поставлен 2026-11-11, команды bootstrap - в `malinina-kubernetes.md`), доступ к UI и смена начального пароля | decision: ADR-017 | в `docs/runbooks/` точные имена, регион, размеры, правила и порядок восстановления; сверено с консолью DO | todo |
| CHART-1 | Общий Helm-чарт `app`: Deployment, CronJob, миграционный Job (Pre-sync), SealedSecret, хеши в аннотациях | - | Maintainer (internal) | dev |  | M | без чарта приложение не выкатить (ADR-019) | decision: ADR-019 | `deploy/charts/app/` проходит `helm lint` и `helm template`; смена секрета меняет хеш; команды Helm в AGENTS.md; шаг `helm` в `lefthook.yml` | todo |
| SEALED-1 | Установка контроллера Sealed Secrets | - | Maintainer (internal) | dev |  | S | без контроллера секреты не расшифровать (ADR-020) | decision: ADR-020 | ArgoCD-приложение синхронизировано; версия закреплена; флаги `kubeseal`, ротация и происхождение пары ключей сверены с документацией; закрытый ключ в менеджере паролей | todo |
| SECRETS-1 | Скрипт `scripts/seal-secret.ts` и `secrets:seal` в каждом приложении | - | Maintainer (internal) | dev |  | S | ручной `kubeseal` в shell противоречит предпочтению TS-скриптов (ADR-020) | decision: ADR-020 | `pnpm secrets:seal` перезаписывает `secrets.yaml` из `.env.production`; открытых значений нигде нет | blocked:SEALED-1 |
| NATS-1 | Установка NATS JetStream: Helm-чарт в `deploy/argocd/`, одна реплика, PVC, стрим для событий | - | Maintainer (internal) | dev |  | M | очередь для событий и задач; Debezium пишет в стрим, который должен существовать (ADR-022) | decision: ADR-022 | ArgoCD-приложение синхронизировано, PVC привязан, публикация и чтение в стриме проходят, версия чарта с кулдауном | todo |
| OBS-2 | Установка Loki и Grafana: ArgoCD-приложения в `deploy/argocd/`, чанки в Spaces, версии закреплены | - | Maintainer (internal) | dev |  | M | поиск по логам (ADR-032) | asked: owner 2026-11-11 | приложения синхронизированы; логи подов backend видны и ищутся в Grafana | blocked:RUNBOOK-1 |
| DEPLOY-1 | Первый выкат backend и frontend в кластер: образы из CI в GHCR, ArgoCD-приложения, ingress | - | Maintainer (internal) | dev |  | L | без выката в кластере нечего проверять (ADR-018, ADR-019, ADR-026) | asked: owner 2026-11-11 | оба приложения в состоянии Synced и Healthy; frontend отвечает по адресу из CI-1 | blocked:CI-1 |

## Epic: События (CDC)

| id | title | cap | persona | owner | assignee | size | why | source | DoD | status |
|----|-------|-----|---------|-------|----------|------|-----|--------|-----|--------|
| CDC-1 | SQL-файл репликации Postgres и его шаг в миграционном Job | - | Maintainer (internal) | dev |  | M | единый источник правды репликации (ADR-023) | decision: ADR-023 | функции слота и таблицы и их вызовы в репозитории; шаг после миграций идемпотентен; применение на кластере - человек (красный флаг 1) | blocked:CHART-1 |
| CDC-2 | Файл настроек Debezium Server и Deployment (1 реплика, `Recreate`, хеш файла в аннотации) | - | Maintainer (internal) | dev |  | M | единый источник правды Debezium; правка файла перезапускает под (ADR-023) | decision: ADR-023 | файл и манифест в `deploy/`; `helm template` меняет хеш при правке; секреты через Sealed Secrets; версия образа с кулдауном | blocked:NATS-1 |
| CDC-3 | Роль Debezium с REPLICATION, мониторинг слота и удерживаемого WAL, проба здоровья | - | Maintainer (internal) | dev |  | M | слот держит WAL без предела; остановленный коннектор заполнит диск `bfdb` (ADR-021) | decision: ADR-021 | отдельная роль вместо `doadmin`; алерт на размер удерживаемого WAL; проба здоровья пода; всё описано в RUNBOOK-1 | blocked:CDC-2 |

## Statuses

`todo` / `doing` / `blocked:<id>` / `done`. Закрытая строка уходит в [`backlog-archive.md`](backlog-archive.md) с указателем на то, во что превратилось её содержимое.
