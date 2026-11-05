# Adoption assessment

> Артефакт Gate 2: что нашла восьмипроходная `repo-assessment` (стандарт ADR-048). Состояние **после сброса до чистого листа** (2026-11-05): кода нет, поэтому оценка - это оценка основы. Прототипный код и его оценка остались в истории `main` (`7c7928a`) и не используются.

## Maturity per pass

| # | Pass | Maturity | What that rests on |
| --- | --- | --- | --- |
| 1 | Skeleton & docs | solid | `AGENTS.md`, `CLAUDE.md`, `SPEC.md`, `docs/` с принципами, архитектурой, продуктом, персонами, записями решений, бэклогом, база знаний `docs/standards/` |
| 2 | Decisions in code | partial | решены: адаптация стандарта, DDH, ветвление, язык, зависимости, чистый лист; открыты стек, хранилище, API, auth, безопасность, тесты, CI (бэклог STACK-1, SEC-1, TEST-1, CI-1) |
| 3 | Capabilities & specs | absent | спек нет, `capability-map.json` пуст; кода нет |
| 4 | Quality gates | absent | кода нет; проверка границ архитектуры ждёт стека (ENF-1) |
| 5 | CI/CD | partial | работают гейты стандарта (`spec-guard`, `gitleaks`, `standards-update-watch`); конвейера сборки и релиза нет (CI-1) |
| 6 | Security & supply chain | partial | сканирование секретов и агентные хуки на месте; политика зависимостей записана (ADR-005), не исполнима без стека; модели безопасности нет (SEC-1) |
| 7 | Dependencies & stack | absent | зависимостей и стека нет |
| 8 | Drift & health | solid | `node scripts/self-verify.mjs` даёт drift 0; расхождений код-документы нет, потому что нет кода |

## Top risks

1. **Стек и проверка границ ещё не выбраны.** Пока их нет, правила DDH не исполняются машиной; закрывается STACK-1 и ENF-1, до тех пор backend-код не пишется (AGENTS.md красный флаг 9).
2. **Правила держатся на протоколе сессии, а не на коде.** Всегда загружаемые `architecture-rules.md` и `ai-protocol.md` обязывают план и ревью, но жёсткая гарантия появится только с проверкой границ в CI.
3. **Хуки агента не проверены самотестом** (GUARD-1).
4. **Персоны и продуктовая рамка - наброски** (PERSONAS-1, PRODUCT-1): спеки будут ссылаться на непроверенное.

## Findings by owner role

### product / business

| Finding | Where it goes |
| --- | --- |
| персоны, продукт, метрики не подтверждены | PERSONAS-1, PRODUCT-1 |
| нет первой спеки | SPEC-1 |

### architect

| Finding | Where it goes |
| --- | --- |
| стек и технические развилки открыты | STACK-1 |
| безопасность, тесты, конвейер без решений | SEC-1, TEST-1, CI-1 |

### dev

| Finding | Where it goes |
| --- | --- |
| проверки границ нет | ENF-1 |
| хуки не проверены, настройки GitHub не применены | GUARD-1, GUARD-2 |

### agent (mechanical, no human judgment needed)

| Finding | Where it goes |
| --- | --- |
| механических задач нет | - |

## Closed by the alignment wave itself

- Добавлены: `AGENTS.md`, `CLAUDE.md`, дерево стандарта, записи решений, бэклог со счётом, персоны и `PRODUCT.md` (наброски), база знаний `docs/standards/`, стек-независимые правила DDH с протоколом сессии, три навыка `ddd-*`.
