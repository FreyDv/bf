# Принятие стандартов - discovery dossier

**Summary.** Владелец поручил зафиксировать знания стандарта repositorystandards.com и эталона Domain-Driven Hexagon в репозитории так, чтобы все будущие сессии ИИ следовали им без отступлений. Из этого вышли: ADR-001 (принятие стандарта), ADR-002 (Domain-Driven Hexagon), ADR-003 (squash-merge), ADR-004 (язык), ADR-005 (зависимости), ADR-006 (чистый лист), `docs/standards/`, `.claude/rules/`, навыки `ddd-*`. Досье - только входящий материал; нормативны записи решений и спеки.

**Last reconciled:** `never (no spec has folded this dossier yet)`

## Entries

| Date         | Kind       | Source                                                                     | Touches                                 | State                    | Outcome                                    |
| ------------ | ---------- | -------------------------------------------------------------------------- | --------------------------------------- | ------------------------ | ------------------------------------------ |
| `2026-11-04` | `thread`   | `2026-11-04-owner-request.md` - исходный запрос владельца, дословно        | `architecture`, `process`               | `folded-into-spec`       | `ADR-001`, `ADR-002`, `docs/standards/`    |
| `2026-11-05` | `thread`   | `2026-11-05-intake-answers.md` - ответы владельца на карточки вступления   | `process`, `language`, `branching`      | `superseded-by: ADR-003` | `ADR-003`, `ADR-004`, `ADR-005`, `ADR-006` |
| `2026-11-05` | `note`     | `2026-11-05-agent-memory-rules.md` - правила, жившие в памяти агента       | `budget`, `infrastructure`, `contracts` | `superseded-by: ADR-023` | `BDR-002`, `ADR-017`, `ADR-023`            |

## Contradictions to resolve

| What disagrees | Source A | Source B |
|---|---|---|
| нет | - | - |
