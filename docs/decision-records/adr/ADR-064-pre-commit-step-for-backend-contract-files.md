# ADR-064: Шаг pre-commit на файлы контракта backend вместо флага `affectedUsingTaskInputs`

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-15 |
| **Author** | агент |
| **Decided by** | агент по поручению владельца, ADR-063 (техническая развилка) |
| **Tags** | ci, contracts, frontend, turborepo |

## Context

- ADR-058 п. 6: `inputs` в `turbo.json` меняют хеш задач, но не выбор `--affected`. На правке одного DTO `turbo run typecheck --affected` в `lefthook.yml` выбирает только `@bf/backend`, contracts и frontend не проверяются до CI.
- В CI на PR пробел уже закрыт шагом `Contracts of a DTO-only change` (`pnpm contracts:typecheck`, ADR-057); слеп только pre-commit (CONTRACT-6).
- Флаг Turborepo `futureFlags.affectedUsingTaskInputs` переводит выбор на уровень задач, но меняет выбор во всех потребителях `--affected` (CI, `scripts/image-check.ts`) и, по тексту ADR-058, поведение `turbo prune`; не проверен.

## Options considered

| Вариант | Итог | Почему |
|---|---|---|
| Шаг `lefthook.yml` на файлы контракта | выбран | одна правка, семантика turbo, CI и выбора образов не меняется |
| Флаг `affectedUsingTaskInputs`, удалить шаг CI и `scripts/contracts-typecheck.ts` | отклонён | шире, эффекты на `prune` и `turbo ls --affected` не проверены |
| Оставить как есть | отклонён | pre-commit остаётся слепым к правке DTO |

## Decision

1. В `lefthook.yml` шаг `contracts of a DTO change`: на `apps/backend/src/**/*.{request.dto,response.dto,enum,filter-spec}.ts` запускает `pnpm turbo run typecheck lint --filter=@bf/contracts --filter=@bf/frontend` - ту же команду, что `COMMAND` в `scripts/contracts-typecheck.ts`.
2. Шаг стоит после eslint, перед `boundaries` - в порядке CI, где `Contracts of a DTO-only change` идёт после ESLint (ADR-018).
3. Шаг CI `Contracts of a DTO-only change` и `scripts/contracts-typecheck.ts` остаются (ADR-057, ADR-058 п. 3): pre-commit обходим, гейт - CI.
4. Повтор шаблона: суффиксы glob повторяют `BACKEND_CONTRACT_FILES` (`scripts/lib/backend-contract-files.ts`), команда - `COMMAND`; тестом не связаны, как и glob шага `contracts are generated`. ADR-058 и его решения в силе.

## Consequences

- Positive: ошибка типа во frontend от правки DTO видна при коммите, а не в CI.
- Negative: шаблон суффиксов и команда живут в трёх местах; расхождение ловит только CI.
- Negative: glob требует папку под `src/` (`**/`): DTO прямо в `apps/backend/src/` шаг не выбирает; DTO живут в папках модулей (STR-6).
- Остаток: `test` и `test:e2e` contracts и frontend на правке только DTO не выбираются ни в pre-commit, ни в CI (`inputs` ADR-058 есть только у `typecheck` и `lint`); у frontend пока нет тестов, зависящих от типов backend.

## Confirmation

Проверено 2026-11-15: `pnpm exec lefthook run pre-commit --file apps/backend/src/probe/x.request.dto.ts --job 'contracts of a DTO change'` запускает 4 задачи (typecheck и lint contracts и frontend); на `apps/backend/src/main.ts` шаг пропускается. Дальше - review.

## Revisit when

- Появится первый модуль с DTO (CONTRACT-4): проверить на нём флаг `affectedUsingTaskInputs`; если он ведёт себя предсказуемо, флаг заменяет этот шаг, шаг CI и скрипт (ADR-058, «Revisit when»).
- У frontend появятся тесты, зависящие от типов backend: добавить им `inputs` (ADR-058 п. 2) или шаг.

## Related

ADR-018, ADR-035, ADR-057, ADR-058, ADR-063; `lefthook.yml`; `scripts/contracts-typecheck.ts`; `scripts/lib/backend-contract-files.ts`; backlog CONTRACT-6 (в архиве).
