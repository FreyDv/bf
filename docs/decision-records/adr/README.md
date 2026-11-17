# ADR index

Architecture Decision Records - технические причины. Тест записи, жизненный цикл и иерархия: стандарт (`docs/standards/vendor/repository-standards-core/docs/tree/docs-decision-records.md`).

Записи идут в порядке, в котором их стоит читать: каждая опирается только на предыдущие.

| # | Title | Status |
|---|-------|--------|
| [001](ADR-001-adopt-repository-standards.md) | Внедрить Repository Standards (профиль core) | Accepted |
| [002](ADR-002-domain-driven-hexagon.md) | Domain-Driven Hexagon - обязательная архитектура каждого backend | Accepted |
| [003](ADR-003-branching-squash-merge.md) | Ветвление: trunk-based, rebase веток, squash-merge в main | Accepted |
| [004](ADR-004-working-language.md) | Рабочий язык: код и коммиты - английский, документы и спеки - русский | Accepted |
| [005](ADR-005-dependency-policy.md) | Политика зависимостей: точные версии, lockfile, кулдаун 7 дней | Accepted |
| [006](ADR-006-clean-slate.md) | Чистый лист: прототип и его решения удалены (2026-11-05) | Accepted |
| [007](ADR-007-language-and-runtime.md) | Язык и рантайм: TypeScript 6 strict, Node 26 LTS, ESM, pnpm | Accepted |
| [008](ADR-008-repository-topology.md) | Топология: монорепо, модульный монолит, несколько точек входа | Accepted |
| [009](ADR-009-task-runner-turborepo.md) | Задачи монорепо: Turborepo поверх pnpm workspaces, общий пакет конфигураций | Accepted |
| [010](ADR-010-backend-framework-nestjs.md) | Backend-фреймворк: NestJS 12 (отход от Fastify из Node-стандарта) | Accepted |
| [011](ADR-011-frontend-nextjs.md) | Frontend-фреймворк: Next.js с React | Accepted |
| [012](ADR-012-api-contract-trpc.md) | API и контракт FE-BE: tRPC (nestjs-trpc), MCP отдельным адаптером | Accepted |
| [013](ADR-013-datastore-postgres-drizzle.md) | Хранилище: PostgreSQL 18, Drizzle, миграции только вперёд | Accepted |
| [014](ADR-014-boundary-check-dependency-cruiser.md) | Проверка границ архитектуры: dependency-cruiser | Accepted |
| [015](ADR-015-result-type-neverthrow.md) | Тип результата для бизнес-ошибок: neverthrow | Accepted |
| [016](ADR-016-tooling-eslint-prettier-vitest.md) | Линт, формат, тесты: ESLint type-aware, Prettier, Vitest (отход от Biome) | Accepted |
| [017](ADR-017-platform-digitalocean.md) | Платформа: Kubernetes и Managed Postgres на DigitalOcean, облачный слой - runbook | Accepted |
| [018](ADR-018-unified-pipeline.md) | Единый конвейер для всех приложений: pre-commit, CI на PR, CI при merge | Accepted |
| [019](ADR-019-deployment-helm-argocd.md) | Деплой: общий Helm-чарт app и ArgoCD, манифесты в deploy/ | Accepted |
| [020](ADR-020-secrets-sealed-secrets.md) | Секреты: Sealed Secrets в кластере, GitHub Secrets только для CI | Accepted |
| [021](ADR-021-events-debezium-cdc.md) | События: Debezium читает WAL Postgres (outbox-таблица и CDC остальных таблиц) | Accepted |
| [022](ADR-022-queue-nats-jetstream.md) | Очередь: NATS JetStream в кластере, одна реплика с PVC | Accepted |
| [023](ADR-023-debezium-server-run.md) | Запуск CDC: репликация Postgres - SQL-файлом, Debezium Server - файлом настроек | Accepted |
| [024](ADR-024-query-filter-contract.md) | Контракт фильтров query: описание полей, EXISTS, публичный фасад модуля | Accepted |
| [025](ADR-025-transaction-and-domain-event-outbox.md) | Транзакция команды и outbox доменных событий: TransactionManager, DomainEventRecorder, subject в NATS | Accepted |
| [026](ADR-026-image-registry-ghcr.md) | Реестр образов: GitHub Container Registry, образы публичные | Accepted |
| [027](ADR-027-image-layout-dockerfile.md) | Устройство образа: node:26-slim, turbo prune, multi-stage, non-root | Accepted |
| [028](ADR-028-image-build-ci.md) | Сборка образов в CI: BuildKit, кэш GHA, amd64, матрица по затронутым | Accepted |
| [029](ADR-029-image-checks.md) | Проверки образа: hadolint и секреты блокируют, Trivy сообщает | Accepted |
| [030](ADR-030-image-tag-direct-commit.md) | Тег образа в Git: прямой коммит бота в main вместо PR с автослиянием (заменяет пункт 2 раздела «Тег образа» ADR-019) | Accepted |
| [031](ADR-031-ui-library-blueprintjs.md) | UI-библиотека frontend: BlueprintJS | Accepted |
| [032](ADR-032-logging-pino-loki.md) | Логирование: pino в stdout, Loki и Grafana в кластере | Accepted |
| [033](ADR-033-local-environment-docker-compose.md) | Локальная среда: docker compose с Postgres, NATS JetStream и Debezium | Accepted |
| [034](ADR-034-cooldown-exception-managed-parity.md) | Исключение из кулдауна: версия, уже работающая в managed-сервисе | Accepted |
| [035](ADR-035-router-type-export-to-frontend.md) | Тип `AppRouter` во frontend: файл из `nestjs-trpc generate` в `packages/contracts` | Accepted |
| [036](ADR-036-ci-jobs-test-infra-migrations.md) | CI: раскладка jobs, тестовая среда из compose, контракт миграций, инструменты образа | Accepted |
| [037](ADR-037-security-baseline.md) | Базовая безопасность: ответ на каждую ось security-baseline.md | Accepted |
| [038](ADR-038-environments-ingress-edge-bot.md) | Окружения, адреса, ingress, заголовки на границе и бот для коммита тега | Accepted |
| [039](ADR-039-testing-strategy.md) | Стратегия тестирования: уровни, скрипты, файлы, изоляция БД, обязательные пути | Accepted |
| [040](ADR-040-authentication-authorization.md) | Аутентификация и авторизация: пароль и серверные сессии, права как данные | Accepted |
| [041](ADR-041-ai-provider-openai.md) | AI-провайдер: OpenAI, вызов только через порт, ключ по ADR-020 | Accepted |
| [042](ADR-042-object-storage-spaces.md) | Объектное хранилище: DO Spaces, приватные бакеты, presigned URL, порт без SDK | Accepted |
| [043](ADR-043-logs-retention-cost-collector-access.md) | Логи: хранение 30 дней, потолок $10 в месяц, сборщик Alloy, Grafana только через port-forward | Accepted |
| [044](ADR-044-synchronous-commit-critical-commands.md) | Надёжность записи bfdb: кластер остаётся на synchronous_commit=off, критичные команды включают on через SET LOCAL | Accepted |
| [045](ADR-045-sealed-secrets-key-rotation.md) | Sealed Secrets: чарт 2.22.0 в kube-system, автообновление ключа выключено, ротация вручную | Accepted |
| [046](ADR-046-argocd-self-management.md) | Самоуправление ArgoCD: корневое Application, значения из репозитория, синк без prune | Accepted |
| [047](ADR-047-first-rollout-order.md) | Порядок первого выката: миграционный Job - хук Sync на волне 0, секрет и ServiceAccount раньше, рабочие нагрузки позже (уточняет ADR-019) | Accepted |
| [048](ADR-048-shared-kernel-and-result-in-domain.md) | Shared kernel - пакет `@bf/kernel`; `Result` попадает в domain только через него (уточняет ADR-009 и ADR-015) | Accepted |
| [049](ADR-049-domain-packages-whitelist-and-dist-visibility.md) | Проверка границ - из `domain/` в `packages/` только `@bf/kernel`, что импортирует сам kernel, `dist/` пакетов виден графу (уточняет ADR-048 п. 6) | Accepted |
| [050](ADR-050-query-filter-package.md) | Пакет фильтров `@bf/query-filter`: форма поставки, пины, границы, значения, лимиты, итог спайка (исполняет ADR-024) | Accepted |
| [051](ADR-051-query-filter-drizzle-entry.md) | Entry `drizzle` пакета фильтров: привязка к колонкам, форма SQL, пустые списки, границы QRY-7 и QRY-12 (дополняет ADR-050) | Accepted |
| [052](ADR-052-performance-scaling-budget.md) | Бюджет производительности и масштабирования: не применимо сейчас, сигнал пересмотра | Accepted |
| [053](ADR-053-bfdb-roles-and-client-ssl.md) | Роли в `bfdb` (`migrator`, `app`, `doadmin` только вручную), база `bf`, режим SSL клиента; заменяет п. 3 ADR-033 в части роли приложения, уточняет ADR-013 | Accepted |
| [054](ADR-054-failed-login-counter-survives-rollback.md) | Счётчик неудачных входов и откат транзакции: команда входа возвращает ok с исходом (сужает ERR-2 для отказов со следом), счётчик - отдельная запись без событий, пункт списка критичных команд подтверждён (дополняет ADR-025 и ADR-044) | Accepted |
| [055](ADR-055-csp-static-policy.md) | Content-Security-Policy: статическая политика через `headers()` с `'unsafe-inline'` (nonce из `headers()` недоступен), остаточный риск XSS, строгая политика до AUTH-2 (CSP-2); уточняет п. 5 ADR-038 | Accepted |
| [056](ADR-056-agent-ask-list-live-infra-and-gh-api-writes.md) | Ask-список агента: `kubectl`, `doctl`, `kubeseal`, `argocd`, изменяющие подкоманды `helm`, запись через `gh api` в `ask`, `DELETE` в `deny` в любой позиции; хуки не правятся; остаточные пробелы (AGENT-2); дополняет ось Agent boundaries ADR-037 | Accepted |
| [057](ADR-057-backend-contract-files-frontend-checks.md) | Файлы контракта backend и проверки frontend: итог спайка (рёбра, образ, `verbatimModuleSyntax`, слепой кеш), шаг CI `typecheck` и `lint` contracts и frontend при правке одного DTO, один дом шаблона файлов (исполняет ADR-050 п. 11) | Accepted |
| [058](ADR-058-turbo-inputs-for-backend-contract-files.md) | Входы `typecheck` и `lint` у contracts и frontend с файлами DTO backend вместо `--force`: `turbo.json` пакетов, шаг CI остаётся селектором (заменяет пункт 2 ADR-057 в части кеша, уточняет ADR-009) | Accepted |
| [059](ADR-059-agent-acts-on-the-non-production-cluster.md) | Агент сам работает с непродакшен-кластером: `kubectl`, `helm`, `argocd`, `kubeseal`, `doctl kubernetes`, `k8s`, `registry` в `allow`; БД, платные ресурсы DO и `gh api` не открыты; вернуть `ask`, когда появятся реальные пользователи (заменяет пункты 1, 2, 7 ADR-056 и запрет в ADR-047) | Accepted |
| [060](ADR-060-seal-secret-script.md) | Скрипт `seal-secret`: строгий разбор `.env`, секрет на файл (`.env.<name>.production`), манифест `SealedSecret` для сторонних чартов, `--check` шифртекста в `pnpm charts`, имя секрета = каталог приложения, namespace `bf` (уточняет ADR-020) | Accepted |
| [061](ADR-061-db-env-fields-two-secrets-and-ca.md) | Подключение к БД: семь полей `DB_*` вместо `DATABASE_URL`, пакет `@bf/db-utils`, два секрета (`extraSecrets.migrator` только у Job), CA в ConfigMap, отказы и контрольная сумма чарта `app` (исполняет ADR-053 пп. 4, 5; заменяет `DATABASE_URL` в ADR-036, ADR-051) | Accepted |
| [062](ADR-062-no-private-reporting-no-dependabot-alerts.md) | Без private vulnerability reporting и Dependabot alerts; канал отчётов - issue `security contact` (заменяет в ADR-037 включение обеих настроек) | Accepted |
| [063](ADR-063-agent-merges-and-decides-technical-choices.md) | Агент сам пушит, сливает PR на зелёном CI и решает технические развилки; владельцу - деньги, продукт и настройки GitHub; жёсткие запреты без изменений (заменяет п. 6 ADR-056) | Accepted |
| [064](ADR-064-pre-commit-step-for-backend-contract-files.md) | Шаг pre-commit на файлы контракта backend запускает typecheck и lint contracts и frontend; флаг `affectedUsingTaskInputs` не включается (дополняет ADR-058 п. 6) | Accepted |
| [065](ADR-065-frontend-build-inputs-with-backend-contract-files.md) | Входы `build` frontend с файлами контракта backend: правка DTO сбрасывает кеш локальной сборки (дополняет ADR-058 п. 2) | Accepted |
| [066](ADR-066-csp-nonce-via-proxy.md) | Content-Security-Policy: nonce и `'strict-dynamic'` через `proxy.ts`, динамический рендеринг, `style-src` с `'unsafe-inline'`, SRI проверен и не годится (заменяет пункты 1-2 ADR-055) | Accepted |
| [067](ADR-067-query-text-search-sort-and-pagination.md) | Поиск по подстроке (`contains`, `Op.Text`), сортировка и пагинация списочных query: вход `{ filter?, sort?, page? }`, лимиты, ответ `{ items, total? }`; код - с первым list-модулем (дополняет ADR-024) | Accepted |
| [068](ADR-068-filter-spec-binding-public-and-dto-import-rules.md) | Слои `.filter-spec`, `.filter-binding` и `public/` в `.dependency-cruiser.mjs`: код компилятора в `infrastructure/`, реэкспорт в `public/`; правило на импорты DTO (дополняет ADR-024 п. 7 и 11, ADR-051, ADR-057 п. 6) | Accepted |
| [069](ADR-069-query-filter-aliased-relation-tables.md) | Связь фильтра через алиас таблицы: дерево и одна таблица на двух уровнях пути (заменяет предложение ADR-051 п. 1, что они не поддержаны) | Accepted |
| [070](ADR-070-logging-in-code-kernel-pino-request-context.md) | Логирование в коде: `@bf/kernel` (порты логгера и контекста, `Result`), технический модуль `logging` с адаптером pino, контекст запроса на AsyncLocalStorage (исполняет ADR-032 и ADR-043 п. 7; отступление от STR-1, STR-9, PRG-1 для модуля `logging`) | Accepted |
| [071](ADR-071-test-levels-wiring-test-db-helper.md) | Подключение уровней тестов: пакет `@bf/test-db`, пресеты Vitest, кто применяет миграции к `bf_test`, type-level тесты, `*.in-memory.ts` вне образа | Accepted |
| [072](ADR-072-pnpm-install-pinned-by-hash.md) | Установка pnpm в CI и образах сверяется с хешем из `packageManager` | Accepted |
| [073](ADR-073-weekly-forced-turbo-run.md) | Еженедельный прогон Turborepo с `--force` - отдельный workflow `cache-check` (уточняет Confirmation ADR-009) | Accepted |
| [074](ADR-074-ghcr-retention.md) | Хранение образов в GHCR: что остаётся и кто удаляет (уточняет ADR-026 п. 7, исключение из п. 3) | Accepted |
| [075](ADR-075-migrations-without-transaction.md) | Миграция без транзакции: файл `*.no-transaction.sql` с одним оператором `CONCURRENTLY` (дополняет ADR-036) | Accepted |
| [076](ADR-076-image-digest-bumps.md) | Обновление digest образов: скрипт `image:pins`, еженедельная проверка и PR (исполняет ADR-027 п. 1) | Accepted |
| [077](ADR-077-trpc-server-peers-out-of-backend-image.md) | `next` и `typescript` - не пиры `@trpc/server` в графе: override `"-"` убирает их из образа backend | Accepted |
| [078](ADR-078-app-schema-roles-and-grants-files.md) | Схема `app`, файлы ролей и прав `bfdb` для владельца; пара R24 и скрипт `bf_test` - с первой таблицей (исполняет ADR-053 п. 3) | Accepted |
| [079](ADR-079-local-and-ci-under-migrator-and-app.md) | Локальная среда и CI под `migrator` и `app`: init применяет файлы ролей к `bf_dev` и `bf_test`, e2e под `migrator`, проверка миграций в модели DO (исполняет ADR-053 п. 8) | Accepted |
| [080](ADR-080-health-endpoints-and-http-probes.md) | Эндпоинты здоровья и HTTP-пробы: `GET /api/health` в backend, `GET /healthz` во frontend, второй технический модуль `health` (исполняет ADR-019, ADR-038; расширяет п. 4 ADR-070) | Accepted |

Первая ячейка - номер-ссылка на файл; остальное - свободный текст. `scripts/decision-records-check.mjs` сверяет таблицу с файлами. Нумерация без пропусков, номера не переиспользуются. Шаблон: [`_template.md`](_template.md). Решения прототипа не переносятся (ADR-006).

## Группы

| Группа | Записи |
|---|---|
| Как ведётся репозиторий | 001-006, 034 |
| Код: язык, структура, фреймворки, контракт, данные | 007-013, 024, 031, 041, 050, 053 |
| Качество: границы, ошибки, линт и тесты | 014-016, 039, 048, 052, 054 |
| Платформа и доставка | 017-020, 032, 033, 036-038, 040, 042, 043, 047, 060, 080 |
| События и очередь | 021-023 |

## Развилки стандарта (R7) и ответы на них

| Развилка | Ответ |
|---|---|
| Границы доменов и модулей | ADR-002, проверка - ADR-014; shared kernel и `Result` в domain - ADR-048; из `domain/` в `packages/` только kernel, граф с `dist/` - ADR-049 |
| Ветвление и релизы | ADR-003; откат деплоя - ADR-019 |
| Зависимости и цепочка поставок | ADR-005; пины `drizzle-orm` и `pg` для пакета фильтров - ADR-050 |
| Язык, рантайм, фреймворки, инструменты | ADR-007, ADR-010, ADR-011, ADR-016; UI-библиотека - ADR-031 |
| Логи и наблюдаемость | ADR-032; код логирования (порт в `@bf/kernel`, адаптер pino, контекст запроса, поля, скрытие, `LOG_LEVEL`) - ADR-070; срок хранения, потолок цены, сборщик, доступ к Grafana, правила схемы - ADR-043; метрики и алерты не по логам - открыто: backlog MON-1 |
| Топология репозитория и сборка | ADR-008, ADR-009; пакет shared kernel - ADR-048 |
| Стиль API и контракта | ADR-012; тип роутера во frontend - ADR-035; фильтр query - ADR-024, поиск, сортировка и пагинация - ADR-067, пакет и его границы - ADR-050, entry `drizzle` - ADR-051, связь через алиас таблицы (дерево) - ADR-069 вместо предложения его п. 1; слои файлов `.filter-spec`, `.filter-binding`, `public/` и импорты DTO в `.dependency-cruiser.mjs` - ADR-068; проверки frontend на файлы контракта backend - ADR-057; входы задач с файлами DTO вместо `--force` - ADR-058 вместо пункта 2 ADR-057 в части кеша; pre-commit на правке DTO - ADR-064; кеш `build` frontend - ADR-065 |
| Хранилище данных | ADR-013; размещение - ADR-017; надёжность записи (`synchronous_commit`) - ADR-044, оговорка его п. 4 про счётчик входа снята и пункт подтверждён в ADR-054; роли, база и SSL клиента - ADR-053, схема `app` и файлы прав - ADR-078, локальная среда, e2e и проверка миграций под этими ролями - ADR-079 (п. 3 ADR-033 заменён в части роли приложения); поля подключения `DB_*`, пакет `@bf/db-utils`, CA в чарте - ADR-061 (заменяет `DATABASE_URL` в ADR-036, ADR-051) |
| Модель ошибок | ERR-1..6 (ADR-002); тип результата - ADR-015; откуда `Result` в domain - ADR-048; отказ, обязанный оставить след (неудачный вход): `ok` с исходом вместо `err` - ADR-054 |
| Платформа и описание инфраструктуры | ADR-017 |
| Конвейер проверок и доставки | ADR-018; реестр образов - ADR-026, хранение и чистка - ADR-074; образы - ADR-027, ADR-028, ADR-029, обновление digest - ADR-076, пиры `@trpc/server` вне образа backend - ADR-077; раскладка jobs, тестовая среда, миграции в CI - ADR-036, миграция без транзакции (`CONCURRENTLY`) - ADR-075; установка pnpm со сверкой хеша - ADR-072; еженедельный прогон с `--force` - ADR-073; TLS на балансировщике - ADR-037; окружения, адреса, ingress, заголовки на границе, IP клиента, бот для коммита тега - ADR-038 |
| Деплой | ADR-019; тег образа - ADR-030 вместо пункта 2 раздела «Тег образа»; ingress-контроллер и бот для коммита тега - ADR-038; самоуправление ArgoCD, корневое Application, значения, политика синка - ADR-046; порядок первого выката (секрет, миграционный Job, нагрузки) - ADR-047 вместо хука Pre-sync в пункте 1 раздела «Миграции на проде»; пробы чарта и эндпоинты здоровья (`GET /api/health`, `GET /healthz`, технический модуль `health`) - ADR-080 |
| Секреты | ADR-020; установка контроллера, версия чарта, ротация ключа - ADR-045; скрипт шифрования, формат `secrets.yaml`, проверка шифртекста - ADR-060; отрисовка `extraSecrets` и кто какой секрет читает - ADR-061 |
| События и очередь | ADR-021, ADR-022, ADR-023, ADR-025 |
| Объектное хранилище | ADR-042; размещение - ADR-017 |
| AI-провайдер | ADR-041 |
| Аутентификация и авторизация | ADR-040; счётчик неудачных входов против отката, токен сессии из адаптера - ADR-054 |
| Стратегия тестирования | ADR-039; Vitest - ADR-016; где тесты идут в CI - ADR-018, ADR-036; подключение (хелпер TST-3 `@bf/test-db`, пресеты `test` и `test:e2e`, кто применяет миграции к `bf_test`, type-level, `*.in-memory.ts` вне образа) - ADR-071, уточняет ADR-039 п. 1.3, 3.3, 5.4, 5.5 и заменяет временное исключение ADR-050 п. 12 |
| Базовая безопасность | ADR-037; канал отчётов и оповещения о зависимостях - ADR-062 вместо включения настроек в строках «Dependencies» и «Embargoed work» ADR-037; аутентификация и авторизация - ADR-040; роли БД и SSL клиента - ADR-053; CSP во frontend - ADR-055, nonce вместо его пунктов 1-2 - ADR-066; границы агента (ask-список) - ADR-056, кластер без подтверждений - ADR-059 вместо пунктов 1, 2, 7 ADR-056; push, слияние и технические развилки - ADR-063 вместо п. 6 ADR-056 |
| Бюджет производительности и масштабирования | ADR-052; замер fsync - при первой критичной команде (DBSEC-4), см. ADR-044 |
