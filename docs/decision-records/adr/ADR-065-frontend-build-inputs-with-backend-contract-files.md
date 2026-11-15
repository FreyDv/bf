# ADR-065: Входы `build` frontend с файлами контракта backend

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-15 |
| **Author** | агент |
| **Decided by** | агент по поручению владельца, ADR-063 (техническая развилка) |
| **Tags** | ci, contracts, frontend, turborepo |

## Context

- ADR-058 п. 2 дал `inputs` с файлами DTO backend только `typecheck` и `lint` contracts и frontend. `next build` тоже проверяет типы frontend, но его хеш правку DTO не видел: локальная `pnpm build` из корня могла вернуть зелёную сборку из кеша после поломки DTO (CONTRACT-7).
- CI не запускает `turbo run build`, образ frontend собирается в контейнере без `.turbo/cache` (`apps/frontend/Dockerfile`): пробел только локальный.

## Options considered

| Вариант | Итог | Почему |
|---|---|---|
| `inputs` у `build` frontend, тот же список `BACKEND_CONTRACT_TURBO_GLOBS`, под тестом | выбран | одна задача в одном файле, тест уже связывает списки |
| Оставить: правку DTO ловит `typecheck` (pre-commit, ADR-064; CI) | отклонён | зелёная сборка из кеша всё равно вводит в заблуждение, а починка дешевле записи |

## Decision

1. В `apps/frontend/turbo.json` у задачи `build` те же `inputs`, что у `typecheck` и `lint`: `$TURBO_DEFAULT$` и `BACKEND_CONTRACT_TURBO_GLOBS`.
2. У `@bf/contracts` скрипта `build` нет - ему ничего не добавляется.
3. `scripts/contracts-typecheck.test.ts` проверяет набор задач каждого файла (`build`, `lint`, `typecheck` у frontend; `lint`, `typecheck` у contracts) и что `build` в корневом `turbo.json` не изменился. ADR-058 в силе.

## Consequences

- Positive: правка DTO сбрасывает кеш сборки frontend; локальная сборка не выдаёт устаревший зелёный результат.
- Negative: любая правка DTO пересобирает frontend локально, даже если его типы не изменились.

## Confirmation

`pnpm contracts:typecheck:test` (тест набора задач). Проверено 2026-11-15: хеш `@bf/frontend#build` (`turbo run build --dry=json`) меняется при добавлении `apps/backend/src/probe/x.request.dto.ts` и возвращается после удаления.

## Revisit when

- Включение `affectedUsingTaskInputs` (ADR-064, «Revisit when») или переход на другой способ связи frontend с типами backend: тогда `inputs` могут стать лишними.

## Related

ADR-058, ADR-063, ADR-064; `apps/frontend/turbo.json`; `scripts/contracts-typecheck.test.ts`; backlog CONTRACT-7 (в архиве).
