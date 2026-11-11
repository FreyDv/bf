# ADR-007: Язык и рантайм: TypeScript 6 strict, Node 26 LTS, ESM, pnpm

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-06 |
| **Author** | владелец |
| **Decided by** | владелец |
| **Tags** | stack, language, runtime |

## Context

- Владелец хочет один язык на backend и frontend, Node, который сам запускает TypeScript, и ESM.
- Node запускает `.ts` срезанием типов: типы не проверяет, `enum` и parameter properties не поддерживает.
- Nest опирается на декораторы и `emitDecoratorMetadata` (ADR-010), поэтому приложение нативно не запустить.
- TypeScript 7 несовместим с Nest CLI: у него нет программного API.

## Options considered

| Вариант | Плюсы | Минусы | Итог |
|---|---|---|---|
| TypeScript strict на Node, pnpm | путь Node-стандарта; совпадает с предпочтениями владельца | два режима запуска TS | выбран |
| Java/Kotlin | ArchUnit, строгие типы | нет пути стандарта; тяжело одному | отклонён |
| Python | - | слабее типизация и инструменты границ | отклонён |

## Decision

1. Backend и frontend - TypeScript 6.x, `strict` плюс `noUncheckedIndexedAccess`, `noImplicitOverride`.
2. TypeScript 7 не берём, пока Nest CLI его не поддерживает.
3. Рантайм - Node 26 LTS, версия в `.nvmrc`.
4. Модули - ESM (`"type": "module"`).
5. Менеджер пакетов - pnpm.
6. Приложения собираются в JS и запускаются из `dist/`.
7. Скрипты, CI и утилиты - `.ts`, запуск `node file.ts`, без `enum` и parameter properties; типы проверяет `tsc --noEmit`.

## Consequences

- Плюс: один язык и общие типы между FE и BE.
- Плюс: скрипты запускаются одинаково локально и в CI.
- Минус: два режима запуска TS (сборка и нативный).
- Минус: TS 7 откладывается.
- Минус: path aliases под ESM могут ломаться - их избегаем.
- Дальше: при scaffold закрепить точные версии (ADR-005), сверить статус LTS Node 26 и релиз Nest 12 (backlog SCAFFOLD-1).

## Confirmation

`engines` и `.nvmrc` совпадают; `tsc --noEmit` в CI для всего репозитория; ревью lockfile-диффа.

## Revisit when

- Nest CLI поддерживает TypeScript 7.
- Node поддерживает декораторы и метаданные без сборки.

## Related

ADR-005, ADR-010.
