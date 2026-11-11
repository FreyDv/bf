# Архив бэклога

> Куда уходит закрытая строка из [`backlog.md`](backlog.md). Строка переезжает вместе с указателем `where` на то, во что превратилось её содержимое; своего текста архив не держит. Группировка - по релизу.

## Unreleased

| id | title | type | where |
|---|---|---|---|
| STACK-1 | Стек и развилки | task | `docs/decision-records/adr/README.md` - развилки записаны в ADR-007..023; остаток разделён на STACK-2 (объектное хранилище), STACK-3 (AI-провайдер), AUTH-1 (аутентификация) |
| SCAFFOLD-1 | Каркас: pnpm workspaces, `turbo.json`, пакет конфигураций, пустые приложения backend и frontend | task | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `packages/config/`, `apps/backend/`, `apps/frontend/`; команды в AGENTS.md; Helm-команды перенесены в CHART-1 |
| ENF-1 | Проверка границ dependency-cruiser в CI | task | `.dependency-cruiser.mjs`, `scripts/boundaries.test.ts`, `.github/workflows/ci.yml` (шаг границ); команды в AGENTS.md; сопоставление с QRY-19 (правила QRY-7, QRY-12 для пакета фильтров) остаётся в QUERY-1 |
| HOOKS-1 | Pre-commit на lefthook | task | `lefthook.yml`, `pnpm-workspace.yaml` (`allowBuilds: lefthook`); шаг `helm` перенесён в CHART-1 |
| GUARD-2 | Настройки GitHub: squash-merge, защита `main`, обязательные проверки | task | `docs/runbooks/github-settings.md`; применено на GitHub 2026-11-11: squash-only, PR обязателен, проверки `ci`, `spec-guard`, `secret scan`, защита на админа |
| GUARD-1 | Самотест хуков агента | task | `bash scripts/verifyAgentGuards.sh` зелёный (205 проверок, 2026-11-11), `jq` установлен; запускать после любой правки `.claude/hooks/` (AGENTS.md) |
| LOCAL-1 | Локальная среда: docker compose с Postgres, NATS JetStream и Debezium | task | `compose.yaml`, `deploy/local/` (init-SQL ролей и баз, настройки Debezium), команды `pnpm local:*` в `AGENTS.md`, ADR-033, снимок `docs/runbooks/bfdb-postgres.md`; подключение приложений к базе и NATS появится с первым клиентом БД и NATS |
| DBSEC-1 | Доверенные источники `bfdb`: ограничить доступ кластером Kubernetes и адресом владельца | task | `docs/runbooks/bfdb-postgres.md` (правила проверены `doctl databases firewalls list` 2026-11-11, подключение с адреса владельца работает), `scripts/db-allow-me.sh` обновляет правило адреса |
