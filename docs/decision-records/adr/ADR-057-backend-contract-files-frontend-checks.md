# ADR-057: Файлы контракта backend и проверки frontend: итог спайка, шаг CI для правки только DTO, дом шаблона файлов (исполняет ADR-050 п. 11)

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-13 |
| **Author** | агент |
| **Decided by** | агент по поручению владельца (2026-11-12): владелец написал в чате «постарайся все делать сам без моих подтверждений» и «Продолжай, не жди меня»; варианты ниже выбрал агент, владелец может отменить их новой записью |
| **Tags** | ci, contract, frontend, process |

## Context

- ADR-035: сгенерированный `packages/contracts/src/generated/server.ts` импортирует `*.request.dto.ts`, `*.response.dto.ts`, `*.enum.ts` backend по относительному пути. Пакеты `@bf/contracts` и `@bf/frontend` компилируют эти файлы, а backend не их зависимость в графе Turborepo.
- Следствие, найденное в CONTRACT-2 и CONTRACT-3: `turbo --affected` на правку одного DTO выбирает только `@bf/backend`; образ frontend ловит регэксп `scripts/image-check.ts`, а `typecheck` и `lint` frontend и contracts не ловит ничто.
- ADR-050 п. 11: рёбра графа от `@bf/contracts` и `apps/backend` к `@bf/query-filter` приходят с первым модулем, у которого DTO использует `toZod`. До модуля проверить «на настоящем DTO» нечего: в `apps/backend/src` нет ни роутера, ни DTO.
- DTO компилируют двумя конфигурациями: backend (`nest.json`) с `verbatimModuleSyntax: false` и `isolatedModules: false`, contracts и frontend (`base.json`) с обоими `true`. Гипотеза строки CONTRACT-3: правка, проходящая у backend, падает у frontend.

## Options considered

| Развилка | Выбрано | Отклонено |
|---|---|---|
| Доказательство без модуля | одноразовый спайк в копии вне дерева, результат здесь; остаток отдельной строкой под первый модуль | закоммиченная фикстура и CI-тест со сборкой образа (тяжёлый, дублирует будущий модуль, PRG-3); ждать модуля без проверки (строка зависла бы, а пробел `typecheck` решается без модуля) |
| Как гонять проверку на правку одного DTO | шаг CI на скрипте TS по шаблону файлов, `--filter` на два пакета | ребро backend -> frontend в графе (неверная модель: frontend зависит от типов, не от кода backend; тянет `^build` backend и меняет `turbo prune` и выбор образов, ADR-027, ADR-050); принять пробел записью (поломка контракта уходит на `main`) |
| Какие пакеты и задачи | `typecheck` и `lint` у `@bf/contracts` и `@bf/frontend` | только `typecheck` frontend (`tsc` frontend доходит до DTO лишь через файл, импортирующий `RouterInputs`; сейчас таких нет); добавить `test` (типы DTO тестов frontend не меняют) |
| Кеш Turborepo в этом шаге | `--force` | полагаться на кеш (спайк: зелёный результат берётся из кеша); `inputs` задач с файлами вне пакета (не проверено, строка CONTRACT-5) |
| `verbatimModuleSyntax` | только проверить на DTO спайка и записать | менять `nest.json` или добавлять правило линтера (владелец: без правки конфигурации) |
| Дом шаблона файлов | один модуль `scripts/lib/backend-contract-files.ts` для `image-check.ts`, нового шага и `.dependency-cruiser.mjs` | копии в каждом файле (дрейф при смене суффиксов, R4) |

## Decision

1. **Спайк** (2026-11-13, копия дерева в каталоге вне репозитория, не коммитится; Node 26.13.0, `nestjs-trpc` 2.14.0, Zod 4.6.7, TypeScript 6.0.3, Turborepo 2.11.10). Фикстура: роутер `spike` с процедурой с `input` и `output`, request DTO `z.object({ filter: toZod(S).optional() }).strict()`, описание фильтра `S` во втором файле (`.filter-spec.ts`), клиентский enum, response DTO, страница frontend с `RouterInputs`. Итоги:
   - без ребра от `@bf/contracts` к тулкиту, с зависимостью только у backend: `typecheck` contracts падает `TS2307` на `@bf/query-filter/core` и `/zod`; `typecheck` frontend: `TS2307` и лишний `@ts-expect-error` (`TS2578`); `docker build` падает на `next build`; повторяет ADR-050 п. 9;
   - с обоими рёбрами и без `dist/` тулкита: `pnpm turbo run typecheck lint --filter=@bf/contracts --filter=@bf/frontend` проходит (пять задач, тулкит собирается первым), `@ts-expect-error` на оператор вне набора срабатывает; `docker build -f apps/frontend/Dockerfile .` проходит (`turbo prune` добавляет `@bf/query-filter`, две задачи сборки); контейнер запущен, `/` отвечает `200`, в `/app` только `apps/frontend` и `node_modules`;
   - `value` в условии `oneOf(Enum)` имеет тип самого enum: строковый литерал `'new'` даёт `TS2322`, frontend обязан импортировать enum; импорт из каталога backend нарушает правило `apps-do-not-import-each-other` (`pnpm deps`): клиентский enum должен лежать в contracts (QRY-20, QUERY-3);
   - `verbatimModuleSyntax`: DTO с `import { FilterOf } from '@bf/query-filter/core'`, используемым как тип, и `export { FilterOf as ... } from` проходит `tsc --noEmit` backend (код 0) и ESLint backend, а `typecheck` contracts и frontend падает `TS1484` и `TS1205`. Гипотеза подтверждена: в DTO нужны `import type` и `export type`, а видит ошибку только проверка из п. 2;
   - кеш: после первого зелёного прогона правка одного DTO не меняет хеши `typecheck` и `lint` contracts и frontend (файлы DTO не их входы), второй прогон идёт с `cache hit` и возвращает зелёный результат вместо ошибки.
2. **Шаг CI.** `scripts/contracts-typecheck.ts`, `pnpm contracts:typecheck`, шаг `Contracts of a DTO-only change` в `ci.yml` после `ESLint`, только на `pull_request`. Если среди изменённых файлов есть `apps/backend/src/**/*.{request.dto,response.dto,enum,filter-spec}.ts`, он запускает `pnpm turbo run typecheck lint --filter=@bf/contracts --filter=@bf/frontend --force`; иначе пропускает. `lint` входит, потому что общий конфиг ESLint учитывает типы (ADR-016, `packages/config/eslint/index.js`). Два пакета, а не один: `typecheck` contracts всегда читает `server.ts` и DTO за ним, `typecheck` frontend доходит до них, когда страница импортирует `RouterInputs`. Push в `main` гоняет все задачи целиком, шаг там не нужен. `--force` обязателен (спайк, последний пункт п. 1).
3. **Шаблон файлов.** `scripts/lib/backend-contract-files.ts`, суффиксы `request.dto`, `response.dto`, `enum`, `filter-spec`. Его читают `scripts/image-check.ts` (выбор образа frontend, шаблон расширен суффиксом `filter-spec`), шаг из п. 2 и `.dependency-cruiser.mjs`. Правило `contracts-only-dtos-from-backend` берёт из модуля более узкий набор, без `filter-spec`: сгенерированный файл вправе импортировать напрямую только DTO и enum. Импорт `.ts` из конфигурации cruiser работает без сборки (проверено на Node 26.13.0).
4. **Рёбра ADR-050 п. 11** - ссылки workspace (`workspace:*`, в lockfile `link:`), а не сторонние зависимости в смысле ADR-005 и R21: версии из реестра нет, кулдауна нет. Их покрывает ADR-050 п. 11, отдельной записи не нужно. Эта запись их не добавляет: потребителя `toZod` в репозитории нет (PRG-3). Рёбра и проверка образа с настоящим DTO идут строкой CONTRACT-4 под первый модуль.
5. **Регрессия.** ADR-050, раздел Confirmation, остаётся: регрессию сборки образа frontend с `toZod(S)` даёт первый модуль (CONTRACT-4), эта запись её не создаёт. До модуля шаг п. 2 и `pnpm contracts:typecheck:test` не имеют настоящего DTO, поэтому на реальном коде проверка не запускалась.
6. **Не делается.** Правило `dependency-cruiser` на то, что импортирует сам DTO (прямые рёбра из `packages/contracts` оно видит, дальше нет): строка QUERY-4. Правка `tsconfig` или линтера под `verbatimModuleSyntax`: не сейчас, решает владелец.

## Consequences

- Positive: правка одного DTO или описания фильтра на pull request проходит `typecheck` и `lint` contracts и frontend до слияния; образ frontend выбирается по тому же шаблону.
- Positive: суффиксы файлов контракта имеют один дом; смена суффикса (QUERY-4) правится в одном месте.
- Negative: второй механизм выбора затронутого рядом с `turbo --affected`; шаг пересобирает тулкит и повторяет `typecheck` и `lint` двух пакетов при каждой такой правке (`--force`, без кеша).
- Negative: кеш Turborepo остаётся слепым к DTO для всех прогонов вне шага: `pnpm typecheck` локально и `turbo --affected` в pre-commit могут вернуть зелёное из кеша (строка CONTRACT-5).
- Negative: автор DTO пишет `import type` и `export type` из-за конфигурации frontend; backend ошибку не покажет.
- Follow-ups: CONTRACT-4 (рёбра, образ и `verbatimModuleSyntax` на настоящем DTO), CONTRACT-5 (`inputs` в `turbo.json`), QUERY-3 (enum клиента в contracts), QUERY-4 (правило на импорты DTO).
- Не проверено: шаг в GitHub Actions (на `pull_request` он сработает впервые на следующей правке DTO); настоящий DTO, потому что модулей нет.

## Confirmation

- Машинно: `pnpm contracts:typecheck:test` (23 случая: какие файлы выбираются, шаг на временных репозиториях, команда без кеша; шаг `Contract typecheck selection` в `ci`); `pnpm deps` и `pnpm deps:test` (правило `contracts-only-dtos-from-backend` читает модуль шаблона).
- Вручную на копии вне дерева: правка одного DTO даёт `turbo --affected` только `@bf/backend`, а шаг падает `TS1484`; правка `.filter-spec.ts` выбирает шаг и образ frontend; правка обычного файла backend не выбирает ни то, ни другое.
- Образ с настоящим `toZod(S)` и рёбра: не подтверждено до CONTRACT-4.

## Revisit when

- Первый модуль не собирается в образе frontend или не проходит `typecheck` contracts с рёбрами ADR-050 п. 11: п. 4 и 5 этой записи и ADR-050 п. 11.
- Задачи contracts и frontend получают входы с файлами DTO (CONTRACT-5) или backend становится их зависимостью в графе: шаг и `--force` не нужны.
- DTO получают новый суффикс или `filter-spec` меняет имя: `scripts/lib/backend-contract-files.ts` (QUERY-4).
- Конфигурации `verbatimModuleSyntax` backend и frontend выравниваются: п. 1 (пункт про `TS1484`).

## Related

ADR-005, ADR-016, ADR-024, ADR-027, ADR-035, ADR-036, ADR-050; QRY-20, PRG-3, R4, R21; backlog CONTRACT-2, CONTRACT-3, CONTRACT-4, CONTRACT-5, QUERY-3, QUERY-4.
