# Adoption intake - bf

> Что Step 0 `align-to-standards` измерил и спросил до любой работы (стандарт ADR-042). Обновляется на месте при каждом повторном входе, не пересоздаётся.

## State measured

- **self-verify drift at intake:** нет `.standards-version` - нескорректированный brownfield (первый прогон после копирования дерева: drift 8, остаток закрыт этой волной).
- **Lifecycle and policy signals found:** репозиторий активный (последний коммит 2026-10-22), не архивный, переезда нет; политики для AI-агентов (`AI_POLICY`, `CONTRIBUTING`, `AGENTS.md`) не было; в истории коммитов стоят трейлеры `Co-Authored-By: Claude`, которые стандарт запрещает (CONV-1).
- **Existing-knowledge sources offered:** `docs/ADR.md`, `docs/aws-target-architecture.md`, `docs/aws-fargate-migration.md`, правила, жившие только в памяти агента (бюджет, никакого DynamoDB, TypeScript вместо bash, только tRPC, решения по Fargate); доступны и цитируемы; лежат в `docs/discovery/standards-adoption/`.

## Question round

- **Intent:** мигрировать всё (приведение к стандарту, волнами).
- **Technology:** Node/TypeScript (по `package.json`, `pnpm-workspace.yaml`, `turbo.json`); Layer 2 принят выборочно: репозиторий - монорепозиторий со своим тулингом, стандарт советует переносимые части, не весь starter.
- **Appetite:** программа волн; первая волна - один PR `feat/repository-standards` по коммиту на задачу.
- **Profile:** core - один автор, работа не передаётся асинхронно, нет внешних читателей и релизной аудитории.
- **Tracked-work location:** в репозитории, `docs/backlog.md` (внешнего трекера нет).
- **Plan-only or execute:** execute. Согласие подтверждается заново после Gate 2 (отчёт и число 21 перед владельцем).
- **Evidence:** send nothing (запись прогона в стандарт не отправляется).
- **Language:** код и коммиты по-английски, документы и спеки по-русски (ADR-032).
- **Layout:** перенос в раскладку стандарта (`docs/ADR.md` → записи решений; плоский `auth/identity` → DDH, ARCH-1).
- **Records / personas:** записи переписаны; недостающие записаны (часть как Proposed); персоны - черновик «предложить из кода».
- **Conventions:** дефолты стандарта; два записанных расхождения: squash-merge (ADR-027) и Node 26 (ADR-031).
- **Guards:** набор стандарта с тремя адаптациями (чтение `.env.example` разрешено; пути к per-service `.env` для гарда миграций; деплой- и БД-скрипты AWS в списке ask); `onFailure: block` на обоих хуках.

## Deviations recorded as manifest exceptions

См. `standard.manifest.json` → `exceptions` и `stack.manifest.json` → `exceptions`; каждая с причиной и ссылкой на запись решения.

## Re-entry log

- 2026-11-05: первый вход, как выше. Дальше: волна 2 - закрытие маркеров спек и подтверждение черновиков (SPEC-1..3, REC-1..3, PERSONAS-1).
