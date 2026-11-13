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

Первая ячейка - номер-ссылка на файл; остальное - свободный текст. `scripts/decision-records-check.mjs` сверяет таблицу с файлами. Нумерация без пропусков, номера не переиспользуются. Шаблон: [`_template.md`](_template.md). Решения прототипа не переносятся (ADR-006).

## Группы

| Группа | Записи |
|---|---|
| Как ведётся репозиторий | 001-006, 034 |
| Код: язык, структура, фреймворки, контракт, данные | 007-013, 024, 031, 041 |
| Качество: границы, ошибки, линт и тесты | 014-016, 039, 048 |
| Платформа и доставка | 017-020, 032, 033, 036-038, 040, 042, 043, 047 |
| События и очередь | 021-023 |

## Развилки стандарта (R7) и ответы на них

| Развилка | Ответ |
|---|---|
| Границы доменов и модулей | ADR-002, проверка - ADR-014; shared kernel и `Result` в domain - ADR-048 |
| Ветвление и релизы | ADR-003; откат деплоя - ADR-019 |
| Зависимости и цепочка поставок | ADR-005 |
| Язык, рантайм, фреймворки, инструменты | ADR-007, ADR-010, ADR-011, ADR-016; UI-библиотека - ADR-031 |
| Логи и наблюдаемость | ADR-032; срок хранения, потолок цены, сборщик, доступ к Grafana, правила схемы - ADR-043; метрики и алерты не по логам - открыто: backlog MON-1 |
| Топология репозитория и сборка | ADR-008, ADR-009; пакет shared kernel - ADR-048 |
| Стиль API и контракта | ADR-012; тип роутера во frontend - ADR-035 |
| Хранилище данных | ADR-013; размещение - ADR-017; надёжность записи (`synchronous_commit`) - ADR-044 |
| Модель ошибок | ERR-1..6 (ADR-002); тип результата - ADR-015; откуда `Result` в domain - ADR-048 |
| Платформа и описание инфраструктуры | ADR-017 |
| Конвейер проверок и доставки | ADR-018; реестр образов - ADR-026; образы - ADR-027, ADR-028, ADR-029; раскладка jobs, тестовая среда, миграции в CI - ADR-036; TLS на балансировщике - ADR-037; окружения, адреса, ingress, заголовки на границе, IP клиента, бот для коммита тега - ADR-038 |
| Деплой | ADR-019; тег образа - ADR-030 вместо пункта 2 раздела «Тег образа»; ingress-контроллер и бот для коммита тега - ADR-038; самоуправление ArgoCD, корневое Application, значения, политика синка - ADR-046; порядок первого выката (секрет, миграционный Job, нагрузки) - ADR-047 вместо хука Pre-sync в пункте 1 раздела «Миграции на проде» |
| Секреты | ADR-020; установка контроллера, версия чарта, ротация ключа - ADR-045 |
| События и очередь | ADR-021, ADR-022, ADR-023, ADR-025 |
| Объектное хранилище | ADR-042; размещение - ADR-017 |
| AI-провайдер | ADR-041 |
| Аутентификация и авторизация | ADR-040 |
| Стратегия тестирования | ADR-039; Vitest - ADR-016; где тесты идут в CI - ADR-018, ADR-036 |
| Базовая безопасность | ADR-037; аутентификация и авторизация - ADR-040 |
