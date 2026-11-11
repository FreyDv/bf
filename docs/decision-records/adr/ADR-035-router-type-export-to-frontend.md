# ADR-035: Тип `AppRouter` во frontend: файл из `nestjs-trpc generate` в `packages/contracts`

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-11 |
| **Author** | агент (по запросу владельца) |
| **Decided by** | владелец |
| **Tags** | api, contract, monorepo |

## Context

- ADR-012 выбрал tRPC, ADR-009 п. 2 - пакет контрактов с типом роутера, ADR-011 п. 3 - frontend берёт тип оттуда. Способ получить тип не записан; ADR-012 откладывал проверку на SCAFFOLD-1.
- Проба на `nestjs-trpc` 2.14.0 (2026-11-11, роутер во временном файле, удалён): тип `AppRouter` сам пакет не отдаёт. Его пишет Rust-CLI `nestjs-trpc generate` разбором исходников `**/*.router.ts` и кладёт в `-o <каталог>/server.ts`.
- Что в файле: `initTRPC.create()`, дерево `t.router({...})`, обработчики заменены заглушкой, `export type AppRouter = typeof appRouter`. Схема, заданная прямо в декораторе, копируется в файл. Схема, импортированная из другого файла (вызов фабрики, `QRY-10`), остаётся относительным импортом исходника backend.
- Следствие: файл зависит от `zod`, `@trpc/server` и от исходников `.request.dto.ts` в `apps/backend`.
- Не проверено: `tsc` на сгенерированном файле под TS 6 и ESM (флаг `--import-extension`), схема из `toZod(S)` пакета фильтров (QUERY-1), типы в Next.js.

## Options considered

| Вариант | Плюсы | Минусы | Итог |
|---|---|---|---|
| A. `generate` в `packages/contracts`, файл в git, CI проверяет, что перегенерация не даёт диффа | frontend не зависит от инструментов backend; диф виден на ревью; свой код не пишем | файл тянет `.request.dto.ts` из backend (контракты зависят от backend); Rust-бинарь в CI | предложен |
| B. Тот же `generate`, файл не в git, строится задачей turbo перед `typecheck` и `build` frontend | нет дрейфа | frontend-образ (`turbo prune`, ADR-027) тянет backend и бинарь | отклонён |
| C. Схемы клиента живут в `packages/contracts`, backend импортирует их оттуда | нет зависимости контрактов от backend | меняет раскладку QRY-9, QRY-10 (DTO в слайсе): нужен ADR поверх ADR-024 | запасной |
| D. Тип `AppRouter` вручную | без бинаря | дрейф с backend, теряет смысл tRPC | отклонён |

## Decision

1. Тип `AppRouter` строится командой `nestjs-trpc generate` и пишется в `packages/contracts/src/generated/server.ts`.
2. Файл в git. Скрипт `pnpm contracts:generate` (TS, плоский `node`) строит его; CI запускает его и падает, если `git diff` не пуст.
3. `packages/contracts` публикует тип и enum'ы (QRY-20); frontend импортирует только `import type { AppRouter } from '@bf/contracts'`.
4. Контракты вправе импортировать из backend только `*.request.dto.ts`, `*.response.dto.ts`, `*.enum.ts`; правило идёт в `.dependency-cruiser.mjs` (ENF-1) с фикстурой.
5. Если проба `tsc` или `toZod(S)` из «Не проверено» не пройдёт, вариант C заменяет A отдельным ADR.

## Consequences

- Плюс: типы FE-BE без ручной работы; изменение API видно в диффе.
- Минус: зависимость контрактов от исходников backend, ограниченная п. 4.
- Минус: нативный бинарь `nestjs-trpc` нужен CI и разработчикам (macOS arm64 и x64, Linux x64 в пакете).
- Дальше: CONTRACT-1 строит каркас после Accepted; QUERY-1 проверяет `toZod(S)` через генератор.

## Confirmation

Шаг CI `contracts:generate` + пустой `git diff`; правило dependency-cruiser по п. 4 с фикстурой в `pnpm deps:test`; `tsc` frontend на импорте типа.

## Revisit when

- `nestjs-trpc generate` не раскрывает схему из `toZod(S)` или не проходит под Nest 12 и TS 6.
- Пакет перестаёт поддерживаться или отстаёт от Nest больше чем на одну мажорную версию (ADR-012).
- Появляется клиент не на TypeScript: тогда нужен контракт без tRPC.

## Related

ADR-009, ADR-011, ADR-012, ADR-024 (QRY-9, QRY-10, QRY-20), ADR-027, ADR-002 (ADP-3, ADP-6). Backlog: CONTRACT-1, QUERY-1.
