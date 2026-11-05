# ADR-002: ESLint flat + Prettier + tsconfig-базы в @bf/config

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | Accepted                                                                               |
| **Date**       | 2026-11-05 (оформлено при внедрении стандарта; решение принято ранее, см. docs/ADR.md) |
| **Author**     | владелец                                                                               |
| **Decided by** | владелец                                                                               |
| **Tags**       | tooling, quality                                                                       |

## Context

Нужны один линтер, один форматтер и общие tsconfig на все пакеты. Из шаблона-прототипа предлагались oxlint/oxfmt.

## Options considered

- oxlint/oxfmt (из стартового шаблона) - не выбраны: команде привычнее ESLint и нужны плагины (import-x, unused-imports).
- ESLint + Prettier - выбран.

## Decision

ESLint flat config, Prettier и tsconfig-базы живут в `packages/config` (`@bf/config`). Prettier-пресет: `singleQuote`, `trailingComma: all`, `printWidth: 100`, `endOfLine: lf`. Пресет `nest` добавляет правила Domain-Driven Hexagon (ADR-025).

## Consequences

- Плюс: знакомый инструмент, экосистема плагинов.
- Минус: медленнее oxlint/Biome; стек Layer 2 стандарта предлагает Biome - это сознательное расхождение (backlog STACK-1).

## Confirmation

`pnpm lint`, `pnpm format:check` в `ci ok`.

## Revisit when

Нужное правило недоступно в ESLint, либо время линта в CI становится узким местом.

## Related

ADR-014, ADR-025, `packages/config`.
