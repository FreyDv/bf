# Архив бэклога

> Куда уходит закрытая строка из [`backlog.md`](backlog.md). Строка переезжает вместе с указателем `where` на то, во что превратилось её содержимое; своего текста архив не держит. Группировка - по релизу.

## Unreleased

| id | title | type | where |
|---|---|---|---|
| PRODUCT-1 | North Star и метрики успеха в `PRODUCT.md` | task | `docs/PRODUCT.md` (Vision: горизонт и ставка; Success metrics: определение успеха словами владельца, числа отложены), `docs/discovery/product-vision/2026-11-12-owner-north-star.md`; числа - METRICS-1 |
| PERSONAS-1 | Подтвердить BDR-001 и персоны | task | BDR-001 (Accepted 2026-11-11), `docs/personas.md` (четыре персоны, маркеры `[NEEDS INPUT]` и `[NEEDS REVIEW]` сняты; `[NEEDS DECISION]` о полномочиях MCP отложен владельцем до первой MCP-спеки), `docs/discovery/product-vision/` |
| STACK-1 | Стек и развилки | task | `docs/decision-records/adr/README.md` - развилки записаны в ADR-007..023; остаток разделён на STACK-2 (объектное хранилище), STACK-3 (AI-провайдер), AUTH-1 (аутентификация) |
| SCAFFOLD-1 | Каркас: pnpm workspaces, `turbo.json`, пакет конфигураций, пустые приложения backend и frontend | task | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `packages/config/`, `apps/backend/`, `apps/frontend/`; команды в AGENTS.md; Helm-команды перенесены в CHART-1 |
| ENF-1 | Проверка границ dependency-cruiser в CI | task | `./.dependency-cruiser.mjs`, `scripts/boundaries.test.ts`, `.github/workflows/ci.yml` (шаг границ); команды в AGENTS.md; сопоставление с QRY-19 (правила QRY-7, QRY-12 для пакета фильтров) остаётся в QUERY-1 |
| HOOKS-1 | Pre-commit на lefthook | task | `lefthook.yml`, `pnpm-workspace.yaml` (`allowBuilds: lefthook`); шаг `helm` перенесён в CHART-1 |
| GUARD-2 | Настройки GitHub: squash-merge, защита `main`, обязательные проверки | task | `docs/runbooks/github-settings.md`; применено на GitHub 2026-11-11: squash-only, PR обязателен, проверки `ci`, `spec-guard`, `secret scan`, защита на админа |
| GUARD-1 | Самотест хуков агента | task | `bash scripts/verifyAgentGuards.sh` зелёный (205 проверок, 2026-11-11), `jq` установлен; запускать после любой правки `.claude/hooks/` (AGENTS.md) |
| LOCAL-1 | Локальная среда: docker compose с Postgres, NATS JetStream и Debezium | task | `compose.yaml`, `deploy/local/` (init-SQL ролей и баз, настройки Debezium), команды `pnpm local:*` в `AGENTS.md`, ADR-033, снимок `docs/runbooks/bfdb-postgres.md`; подключение приложений к базе и NATS появится с первым клиентом БД и NATS |
| DBSEC-1 | Доверенные источники `bfdb`: ограничить доступ кластером Kubernetes и адресом владельца | task | `docs/runbooks/bfdb-postgres.md` (правила проверены `doctl databases firewalls list` 2026-11-11, подключение с адреса владельца работает), `scripts/db-allow-me.sh` обновляет правило адреса |
| CHART-1 | Общий Helm-чарт `app`: Deployment, CronJob, миграционный Job (Pre-sync), SealedSecret, хеши в аннотациях | task | `deploy/charts/app/` (чарт и фикстуры в `ci/`), проверка `scripts/charts-check.ts`, тесты `scripts/charts.test.ts` (13: что рисует, хеш секрета, отказы), команды `pnpm charts` в `AGENTS.md`, шаги в `lefthook.yml` и `.github/workflows/ci.yml`; порядок SealedSecret и Pre-sync на первом выкате вынесен в CHART-2 |
| CONTRACT-1 | Как тип `AppRouter` и схемы Zod попадают во frontend | task | ADR-035 (Accepted), `packages/contracts/`, `scripts/contracts-generate.ts` (`pnpm contracts:generate`, `contracts:check`), шаг в `.github/workflows/ci.yml` и `lefthook.yml`, правило `contracts-only-dtos-from-backend` в `./.dependency-cruiser.mjs` с фикстурой; проба на временном роутере 2026-11-11: `tsc` под TS 6 в contracts и frontend проходит, тип выводится из схемы фабрики; настоящая `toZod(S)` проверяется в QUERY-1, образ - в CONTRACT-2 |
| CI-2 | Workflow CI на PR и при merge в `main` | task | ADR-036, `.github/workflows/ci.yml` (jobs `ci`, `image`, `publish`), `apps/*/Dockerfile`, `scripts/check-migrations.ts`, `scripts/image-check.ts`; первый `publish` на `main` 2026-11-12 (run 43298690894) зелёный, анонимный pull образа backend по SHA проходит, `image` в обязательных проверках `main` |
