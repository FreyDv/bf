# ADR-077: `next` и `typescript` - не пиры `@trpc/server` в графе: override `"-"` убирает их из образа backend

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-16 |
| **Author** | агент |
| **Decided by** | агент по поручению владельца, ADR-063 п. 2 (техническая развилка) |
| **Tags** | images, dependencies, backend |

## Context

- `@trpc/server` 11.23.0 объявляет пиры `next` (необязательный) и `typescript` (`>=5.7.2`). pnpm разрешал их из графа workspace (`next` - зависимость frontend), и `pnpm deploy --prod` клал в образ backend `next` 16.4.4 и `typescript` 6.0.3: `node_modules` образа 434 МБ, из них `next` около 210 МБ (IMG-2).
- Backend использует адаптер express; адаптер `next` пакета не загружается, `typescript` нужен только типам при сборке, а сборка идёт со своим `typescript` из `devDependencies`.
- `dedupePeerDependents: false` и повторное разрешение `@trpc/server` у backend граф не изменили (проверено 2026-11-16).

## Options considered

| Вариант | Итог | Почему |
|---|---|---|
| `overrides` в `pnpm-workspace.yaml`: `'@trpc/server>next': '-'`, `'@trpc/server>typescript': '-'` | выбран | правка в 24 строки lockfile, только у этого пакета; frontend и сборка не затронуты |
| `dedupePeerDependents: false` | отклонён | граф не изменился |
| Удалять файлы в Dockerfile после `deploy` | отклонён | ломает ссылки `.pnpm`, обходит lockfile |
| Оставить | отклонён | +210 МБ на каждый образ и чужие уязвимости `next` в скане Trivy backend |

## Decision

1. В `pnpm-workspace.yaml` - `overrides` со значением `"-"` для `@trpc/server>next` и `@trpc/server>typescript`: у `@trpc/server` этих пиров в графе нет.
2. Это не новая зависимость и не смена версии: override убирает ребро (ADR-005 п. 1 - overrides точные; ADR-005 п. 5 не задет).
3. Если backend когда-нибудь подключит адаптер `next` пакета `@trpc/server`, override снимается этой же записью в «Revisit when».

## Consequences

- Плюс: `node_modules` образа backend 69 МБ вместо 434 МБ, весь образ 321 МБ; в нём нет `next` и `typescript`; скан Trivy backend не видит уязвимостей `next`.
- Минус: `pnpm peers` при новых версиях `@trpc/server` молчит о `typescript`; совместимость типов держит `pnpm typecheck`.
- Минус: override живёт в `pnpm-workspace.yaml` и действует на весь workspace; сейчас `@trpc/server` есть только у backend и `nestjs-trpc`.

## Confirmation

2026-11-16: `pnpm why next --filter @bf/backend --prod` и то же для `typescript` - пусто; `pnpm build`, `typecheck`, `lint`, `test`, `contracts:check`, `deps` зелёные; `docker build -f apps/backend/Dockerfile .`: в `node_modules/.pnpm` нет `next@` и `typescript@`, контейнер отвечает на `/api/trpc` ошибкой tRPC `NOT_FOUND` и пишет только JSON.

## Revisit when

- Backend или другой пакет начинает использовать адаптер `next` из `@trpc/server`, или `@trpc/server` перестаёт объявлять эти пиры.

## Related

ADR-005, ADR-012, ADR-027, ADR-029, ADR-063; backlog IMG-2 (в архиве).
