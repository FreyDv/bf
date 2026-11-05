# Принятие стандартов - discovery dossier

**Summary.** Владелец поручил зафиксировать знания стандарта repositorystandards.com и эталона Domain-Driven Hexagon в репозитории так, чтобы все будущие сессии ИИ следовали им без отступлений. Из этого вышли: ADR-024 (принятие стандарта), ADR-025 (Domain-Driven Hexagon), ADR-027 (squash-merge), ADR-031 (Node 26), ADR-032 (язык), `docs/standards/`, `.claude/rules/`, три `bf-*` навыка. Досье - только входящий материал; нормативны записи решений и спеки.

**Last reconciled:** `never (no spec has folded this dossier yet)`

## Entries

| Date         | Kind       | Source                                                                     | Touches                                 | State                    | Outcome                                    |
| ------------ | ---------- | -------------------------------------------------------------------------- | --------------------------------------- | ------------------------ | ------------------------------------------ |
| `2026-11-04` | `thread`   | `2026-11-04-owner-request.md` - исходный запрос владельца, дословно        | `architecture`, `process`               | `folded-into-spec`       | `ADR-024`, `ADR-025`, `docs/standards/`    |
| `2026-11-05` | `thread`   | `2026-11-05-intake-answers.md` - ответы владельца на карточки вступления   | `process`, `language`, `branching`      | `superseded-by: ADR-027` | `ADR-027`, `ADR-030`, `ADR-031`, `ADR-032` |
| `2026-11-05` | `note`     | `2026-11-05-agent-memory-rules.md` - правила, жившие в памяти агента       | `budget`, `infrastructure`, `contracts` | `superseded-by: ADR-023` | `BDR-002`, `ADR-017`, `ADR-023`            |
| `2026-11-05` | `document` | `2026-11-05-existing-docs.md` - указатели на `docs/ADR.md` и AWS-документы | `infrastructure`                        | `open`                   | `MATERIAL-1`                               |

## Contradictions to resolve

| What disagrees               | Source A                           | Source B                                                                            |
| ---------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------- |
| версия Node: 22 или 26       | `docs/ADR.md` строка 1 («Node 22») | `.nvmrc` (26), `package.json` engines (`>=26`) - решено ADR-031 (Node 26)           |
| план Fargate «не реализован» | запись памяти агента от 2026-10-21 | `docs/ADR.md` строка 23 и конвейер: Fargate реализован (PR #3, #5) - решено ADR-023 |
