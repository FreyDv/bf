# ADR-016: Линт, формат, тесты: ESLint type-aware, Prettier, Vitest (отход от Biome)

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-06 |
| **Author** | владелец |
| **Decided by** | владелец |
| **Tags** | stack, tooling, lint, test |

## Context

- Node-стандарт предлагает Biome (без type-aware правил) и Vitest с Playwright.
- Владелец хочет ESLint с type-aware линтингом и Prettier.
- Vitest по умолчанию собирает через esbuild, а esbuild не поддерживает `emitDecoratorMetadata`, нужный Nest (ADR-010).

## Options considered

| Вариант | Плюсы | Минусы | Итог |
|---|---|---|---|
| ESLint (flat, typescript-eslint type-aware) + Prettier | типовые правила | два инструмента; медленнее | выбран |
| Biome (путь стандарта) | быстрее, один инструмент | нет типовых правил | отклонён |

## Decision

1. Линтер - ESLint, flat config, type-aware правила typescript-eslint.
2. Форматтер - Prettier; в ESLint нет правил форматирования (`eslint-config-prettier`).
3. Тесты - Vitest; сборка через SWC-плагин (`unplugin-swc`) ради декораторов Nest, если тулинг Nest 12 не даёт эквивалента.
4. Biome не используется.
5. Конфиги - в общем пакете конфигураций (ADR-009).

## Consequences

- Плюс: типовые правила ловят ошибки, которых Biome не видит.
- Минус: два инструмента вместо одного; дольше CI.
- Минус: отход от пути стандарта.

## Confirmation

Линт и формат в CI красные при нарушении; `vitest` в CI (ADR-018).

## Revisit when

- Biome получает type-aware правила.
- Время линтинга в CI превышает приемлемое владельцу.

## Related

ADR-005, ADR-007, ADR-009, ADR-010, ADR-018. Уровни тестов - backlog TEST-1.
