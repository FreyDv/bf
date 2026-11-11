# ADR-010: Backend-фреймворк: NestJS 12 (отход от Fastify из Node-стандарта)

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-06 |
| **Author** | владелец |
| **Decided by** | владелец |
| **Tags** | stack, backend, framework |

## Context

- Node-стандарт предлагает Fastify с DI на плагинах без контейнера.
- Владелец хочет привычный модульный DI и совпадение модулей фреймворка с модулями DDD.
- Nest 12: ESM по умолчанию, Standard Schema (Zod) в декораторах, Node 20.19+ или 22.12+.

## Options considered

| Вариант | Плюсы | Минусы | Итог |
|---|---|---|---|
| NestJS 12 | модули, DI, зрелая экосистема | декораторы и метаданные; запуск только через сборку | выбран |
| Fastify без контейнера (путь стандарта) | легче | DI и структуру модулей собирать вручную | отклонён |

## Decision

1. Backend - NestJS 12.
2. Декораторы Nest допустимы в application, infrastructure и driving adapters.
3. Domain - чистые классы без Nest (DEP-3, DEP-7); `@nestjs/*` не выходит за composition root и внешние слои.
4. Валидация на границе - Zod через Standard Schema.

## Consequences

- Плюс: DI и модули из коробки; Vitest и ESM поддерживаются самим Nest.
- Минус: тяжелее Fastify; запуск только через сборку (ADR-007).
- Минус: отход от пути стандарта.
- Дальше: при scaffold убедиться, что Nest 12 вышел и работает с TypeScript 6 (backlog SCAFFOLD-1).

## Confirmation

dependency-cruiser запрещает импорт `@nestjs/*` из `domain/` (ADR-014).

## Revisit when

- Nest уходит от ESM или тулинга, который мы используем.
- Nest-специфика просачивается в domain.

## Related

ADR-002, ADR-007, ADR-014. Node-стандарт: `docs/standards/vendor/repository-standards-node/DECISIONS.md`, пункт 5.
