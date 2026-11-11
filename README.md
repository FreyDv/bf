# bf

Платформа для одного владельца: знания о готовке, заказы, платежи и аналитика в одном месте, плюс доступ ChatGPT к данным через MCP. Что и зачем: [`docs/PRODUCT.md`](docs/PRODUCT.md).

## Состояние

Продуктового кода пока нет: ни одной спеки возможности. Есть стек, каркас монорепо и проверки архитектуры. Стек выбран записями [ADR-007..033](docs/decision-records/adr/README.md); что ещё осталось до первой функции - в [`docs/backlog.md`](docs/backlog.md).

## Что внутри

| Путь | Что это |
|------|---------|
| `apps/backend` | модульный монолит на NestJS, API через tRPC |
| `apps/frontend` | Next.js |
| `packages/config` | общие конфигурации TypeScript, ESLint, Prettier, Vitest |
| `specs/` | спеки возможностей: поведение системы |
| `docs/` | продукт, архитектура, решения, бэклог, база знаний |

Устройство и границы: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Почему так: [`docs/decision-records/`](docs/decision-records/).

## Начать работу

```bash
nvm use          # версия Node из .nvmrc
pnpm install
pnpm build && pnpm lint && pnpm typecheck && pnpm test
pnpm deps        # границы архитектуры
```

Все команды и соглашения (коммиты, ветки, зависимости): [`AGENTS.md`](AGENTS.md). Сначала читать его - и людям, и агентам.

## Правила

Репозиторий ведётся по двум стандартам, оба обязательны:

- [repositorystandards.com](https://repositorystandards.com): спеки по возможностям, записи решений, бэклог. Проверка: `node scripts/self-verify.mjs`.
- Domain-Driven Hexagon: правила архитектуры backend, загружаются в каждую сессию агента: [`.claude/rules/architecture-rules.md`](.claude/rules/architecture-rules.md).

Вся база знаний по ним: [`docs/standards/`](docs/standards/README.md).
