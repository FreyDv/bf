# Существующие документы, ждущие раскладки

|             |                                                                                   |
| ----------- | --------------------------------------------------------------------------------- |
| **Kind**    | `document`                                                                        |
| **Date**    | `2026-11-05`                                                                      |
| **Present** | агент                                                                             |
| **Purpose** | указатель: что из этих файлов ещё не перенесено в таксономию стандарта            |
| **Touches** | `infrastructure`                                                                  |
| **Raw**     | `docs/aws-target-architecture.md`, `docs/aws-fargate-migration.md`, `docs/ADR.md` |
| **Outcome** | `MATERIAL-1`, `LAYOUT-1`                                                          |

## What was said

- `docs/ADR.md` - сжатая таблица из 23 решений; полностью перенесена в `ADR-001..023`; остаётся указателем (LAYOUT-1).
- `docs/aws-target-architecture.md` - «финальная картина» AWS после Fargate; становится `infra/aws/README.md` по собственной записи; факты частично в `ADR-023` и `docs/ARCHITECTURE.md`; остальное - runbooks (MATERIAL-1).
- `docs/aws-fargate-migration.md` - порядок миграции; история; после раскладки удаляется или помечается историей (MATERIAL-1).
