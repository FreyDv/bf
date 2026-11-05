# Adoption intake

> Что Step 0 `align-to-standards` измерил и спросил до любой работы (стандарт ADR-042). Обновляется на месте при каждом повторном входе.

## State measured

- **self-verify drift at intake:** нет `.standards-version` - нескорректированный brownfield (прототип с кодом, инфраструктурой и 23 сжатыми решениями).
- **Lifecycle and policy signals found:** репозиторий активный; политики для AI-агентов не было; в истории коммитов стояли трейлеры `Co-Authored-By`, которые стандарт запрещает.
- **Existing-knowledge sources offered:** прототипные документы и правила из памяти агента; после решения о чистом листе (ADR-006) ничто из них не переносится; остаётся в истории `main` (коммит `7c7928a`).

## Question round

- **Intent:** мигрировать всё; затем владелец решил начать с чистого листа (ADR-006).
- **Technology:** Node/TypeScript был обнаружен в прототипе; после сброса стек **не выбран** (backlog STACK-1). Слой 2 (стек Node) владелец принял («применить»), но он ложится вместе со стековым ADR; хранилище эталона - `docs/standards/vendor/repository-standards-node/`.
- **Appetite:** волнами; первая волна - сброс и основа (одна ветка `feat/repository-standards`, коммит на задачу).
- **Profile:** core - один автор, работа не передаётся асинхронно.
- **Tracked-work location:** в репозитории, `docs/backlog.md`.
- **Plan-only or execute:** execute.
- **Evidence:** send nothing.
- **Language:** код и коммиты по-английски, документы и спеки по-русски (ADR-004).
- **Layout:** раскладка стандарта.
- **Conventions:** дефолты стандарта; единственное расхождение - squash-merge (ADR-003).
- **Guards:** набор стандарта без адаптаций (адаптации были нужны прототипу), с `onFailure: block` на обоих хуках.
- **Architecture:** Domain-Driven Hexagon обязателен (ADR-002); правила извлечены в `.claude/rules/architecture-rules.md` и `ai-protocol.md`.

## Re-entry log

- 2026-11-05: первый вход, как выше.
- 2026-11-05: сброс до чистого листа по просьбе владельца: удалены код, инфраструктура, конвейер, скрипты прототипа, его решения и спеки; правила DDH переписаны как стек-независимые и грузятся в каждую сессию.
