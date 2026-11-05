# ADR-014: ESLint 10.10 с @eslint-react/eslint-plugin вместо eslint-plugin-react

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | Accepted                                                                               |
| **Date**       | 2026-11-05 (оформлено при внедрении стандарта; решение принято ранее, см. docs/ADR.md) |
| **Author**     | владелец                                                                               |
| **Decided by** | владелец                                                                               |
| **Tags**       | tooling                                                                                |

## Context

eslint-plugin-react 7.x ломается на ESLint 10 (удалён `getFilename`).

## Options considered

- eslint-plugin-react - отклонён: несовместим с ESLint 10.

## Decision

ESLint 10.10 и `@eslint-react/eslint-plugin`.

## Consequences

- Плюс: рабочий линт React на ESLint 10.

## Confirmation

`pnpm lint` для фронтенд-приложений.

## Revisit when

eslint-plugin-react получает поддержку ESLint 10.

## Related

ADR-002.
