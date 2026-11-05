# ADR-031: Node 26 закреплён в .nvmrc и engines (расхождение со стеком Node 24.18.0)

|                |                  |
| -------------- | ---------------- |
| **Status**     | Accepted         |
| **Date**       | 2026-11-05       |
| **Author**     | владелец         |
| **Decided by** | владелец         |
| **Tags**       | tooling, runtime |

## Context

Стек Layer 2 закрепляет Node 24.18.0. Репозиторий работает на Node 26 (`engines: >=26`, `.nvmrc` = 26), а скрипты TypeScript запускаются обычным `node` (ADR-022). Исходная таблица ADR-001 упоминала Node 22 - устарело.

## Options considered

- Node 24.18.0 по стеку - отклонён владельцем: «nvmrc = 26».
- Node 26 - выбран.

## Decision

Рантайм - Node 26; версия записана один раз в `.nvmrc`; `spec-guard.yml` читает её оттуда. Расхождение с копией стека - исключение `content` для `.nvmrc` в манифесте. Точная версия патча (R21) - PINS-1.

## Consequences

- Плюс: запуск `.ts` скриптов без сборки.
- Минус: Node 26 не LTS на момент записи.

## Confirmation

`.nvmrc`, `engines`, `spec-guard.yml`.

## Revisit when

Node 26 перестаёт получать исправления безопасности или нужна LTS-версия для деплоя.

## Related

ADR-001, ADR-030, ADR-022.
