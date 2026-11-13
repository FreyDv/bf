# ADR-058: Входы задач `typecheck` и `lint` у contracts и frontend с файлами DTO backend вместо `--force` (заменяет пункт 2 ADR-057 в части кеша)

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-13 |
| **Author** | агент |
| **Decided by** | агент по поручению владельца (2026-11-12): владелец написал в чате «постарайся все делать сам без моих подтверждений» и «Продолжай, не жди меня»; варианты ниже выбрал агент, владелец может отменить их новой записью |
| **Tags** | ci, contract, frontend, turborepo |

## Context

- ADR-057 п. 1: правка одного DTO не меняет хеш `typecheck` и `lint` у `@bf/contracts` и `@bf/frontend`, повторный прогон возвращает зелёное из кеша. Шаг CI обходит это `--force` (п. 2 ADR-057: «`--force` обязателен»).
- Остальные прогоны оставались слепыми: `pnpm typecheck` и `pnpm lint` локально, полный прогон на `main` с кешем из `actions/cache` (`.turbo/cache`, ключ `restore-keys`), `turbo run typecheck --affected` в pre-commit (строка CONTRACT-5).
- Не было проверено, принимает ли Turborepo 2.11.10 в `inputs` файлы вне пакета и раздувает ли это набор затронутых пакетов.
- ADR-009: «один корневой `turbo.json`», граф задач в его таблице; «периодический прогон с `--force`» назван в Confirmation.

## Options considered

| Развилка | Выбрано | Отклонено |
|---|---|---|
| Что делать с `--force` | снять; шаг и скрипт остаются селектором | убрать шаг и скрипт (без `affectedUsingTaskInputs` правка одного DTO не выберет contracts и frontend под `--affected`, дыра вернётся); оставить `--force` рядом с `inputs` (лишний прогон без кеша, два механизма на один факт) |
| Где задать `inputs` | `turbo.json` в `packages/contracts` и `apps/frontend` с `extends: ["//"]` | ключи `<пакет>#<задача>` в корневом `turbo.json`: по документации Turborepo 2.11.10 (`docs/reference/package-configurations.mdx` внутри пакета `turbo`) такой ключ переопределяет задачу целиком, в том числе `dependsOn: ["^build"]` и `outputs`, их пришлось бы повторять в четырёх местах (не запускалось) |
| Какие задачи | `typecheck` и `lint` | `build` frontend: CI не запускает `turbo run build`, образ собирает в контейнере без `.turbo/cache` (строка CONTRACT-7) |
| Выбор затронутого | не менять; `affectedUsingTaskInputs` не включать | включить `futureFlags.affectedUsingTaskInputs`: по документации выбор переходит на уровень задач, любая правка `turbo.json`, `package.json`, lockfile или `globalDependencies` выбирает все задачи, меняется поведение `turbo prune`; не проверялось (строка CONTRACT-6) |
| Дом шаблона | `BACKEND_CONTRACT_TURBO_GLOBS` в `scripts/lib/backend-contract-files.ts` и тест, сверяющий два `turbo.json` с ним и с регэкспом | копия суффиксов без проверки (дрейф при смене суффиксов, R4); импорт модуля в `turbo.json` невозможен: файл статический |

## Decision

Заменяет пункт 2 ADR-057 в части кеша (`--force`) и закрывает второй пункт его «Revisit when» в части `inputs`; остальное в ADR-057 действует без изменений (спайк, шаблон файлов, рёбра, «Не делается»). Уточняет ADR-009: граф задач остаётся в корневом `turbo.json`, а два файла пакетов задают только `inputs`.

1. **Спайк** (2026-11-13, копия дерева вне репозитория, не коммитится; Node 26.13.0, pnpm 11.28.10, Turborepo 2.11.10). Фикстура: `apps/backend/src/x/foo.request.dto.ts` и его импорт в `packages/contracts/src/generated/server.ts`. Команда: `turbo run typecheck lint --filter=@bf/contracts --filter=@bf/frontend --dry=json`, сравнение `hash` и `dependencies` задач.
   - Без `inputs`: правка DTO не меняет ни один из четырёх хешей (`@bf/contracts#typecheck` `fd822ea356cb8564` до и после). Контроль: зелёный прогон, затем DTO с `import { FooRequest }` без `type` и `export { Bar }` без `export type`, прогон без `--force`: четыре `cache hit`, `FULL TURBO`, код 0; с `--force` падает `TS1484`.
   - С `turbo.json` пакетов (`$TURBO_DEFAULT$` и четыре глоба `$TURBO_ROOT$/apps/backend/src/**/*.<суффикс>.ts`): `$TURBO_ROOT$` принимается, правка DTO меняет хеши (`@bf/contracts#typecheck` `1cbd184d8507b471` -> `964ac3a91165ee1e`, так же `lint` и обе задачи frontend); `dependencies` не изменились (`@bf/config#build`, `@bf/contracts#build`). Тот же DTO без `--force`: четыре `cache miss`, падает `TS1484` и `TS1205`.
   - Каждый суффикс по одному файлу (`.request.dto.ts`, `.response.dto.ts`, `.enum.ts`, `.filter-spec.ts` в срезе и в `public/`) меняет хеш; `*.request.dto.test.ts`, `*.filter-spec.test.ts`, `*.router.ts`, другой путь в `apps/backend` хеш не меняют.
   - `turbo run typecheck lint --affected --dry=json`, `main` с теми же `inputs`: правка одного DTO выбирает только `@bf/backend`, с `inputs` и без них; правка файла без суффикса тоже; без правок пусто. Набор не вырос и не сократился: `inputs` влияют на хеш, а не на выбор.
   - `docker build -f apps/frontend/Dockerfile .` на дереве с этими файлами проходит; контейнер отвечает `200`. `turbo prune` копирует пакеты целиком, `turbo.json` пакета едет с ними.
2. **`turbo.json` в `packages/contracts` и `apps/frontend`**: `extends: ["//"]`, для `typecheck` и `lint` `inputs`: `$TURBO_DEFAULT$` и глобы по суффиксам `request.dto`, `response.dto`, `enum`, `filter-spec` из `BACKEND_CONTRACT_TURBO_GLOBS`. `$TURBO_DEFAULT$` обязателен: без него хешировались бы только DTO, а не файлы пакета. `dependsOn` наследуется из корня. Корневой `turbo.json` не менялся.
3. **Шаг CI** `Contracts of a DTO-only change`, `scripts/contracts-typecheck.ts`, `pnpm contracts:typecheck` остаются селектором: `--force` из команды снят, остальное как в ADR-057 п. 2. `affectedUsingTaskInputs` не включён.
4. **Тест** в `scripts/contracts-typecheck.test.ts`: оба `turbo.json` совпадают с `BACKEND_CONTRACT_TURBO_GLOBS` (`extends`, набор задач, `$TURBO_DEFAULT$` первым), на выборке файлов теста глобы и регэксп `BACKEND_CONTRACT_FILES` выбирают одно и то же (`path.matchesGlob`), корневой `turbo.json` держит `dependsOn` обеих задач. Число случаев теперь 42 (в ADR-057 Confirmation стояло 23).
5. **Периодический `--force` из ADR-009** в CI не существует (проверено `grep` по `.github/workflows`); здесь не добавляется. Нужен ли он, решает строка CI-4.
6. **Остаточный пробел.** `turbo run typecheck --affected` в pre-commit на правке одного DTO не выбирает contracts и frontend, поэтому хук их не запускает. `pnpm typecheck` и `pnpm lint` из корня, прогон на `main` с восстановленным кешем и шаг CI кеш больше не обманывает. Закрывает строка CONTRACT-6.

## Consequences

- Positive: хеш `typecheck` и `lint` contracts и frontend зависит от файлов контракта backend; зелёный результат из кеша после правки DTO невозможен ни локально, ни на `main`.
- Positive: шаг CI не тратит прогон без кеша на каждую такую правку; один механизм кеша вместо обхода.
- Negative: шаг (выбор) и `inputs` (хеш) остаются двумя механизмами одного факта, пока не включён `affectedUsingTaskInputs` (CONTRACT-6).
- Negative: два пакета держат `turbo.json` рядом с корневым, ADR-009 говорит «один корневой»; граф задач при этом в корне.
- Negative: `inputs` знают только файлы с суффиксами; DTO, который импортирует обычный файл backend, этот файл в хеш не вносит (QUERY-4).
- Negative: хеши `build` у contracts и frontend один раз сменились (новые файлы `turbo.json` в пакетах), кеш сбросился.
- Follow-ups: CONTRACT-4 (перепроверка на первом настоящем DTO), CONTRACT-6 (pre-commit и `affectedUsingTaskInputs`), CONTRACT-7 (`build` локально), CI-4 (периодический `--force`).
- Не проверено: шаг в GitHub Actions без `--force`; настоящий DTO (модулей нет); вариант с ключами `<пакет>#<задача>` в корне (взят из документации); поведение `affectedUsingTaskInputs`.

## Confirmation

- Машинно: `pnpm contracts:typecheck:test` (42 случая, шаг `Contract typecheck selection` в `ci`); `pnpm contracts:typecheck -- --dry-run` печатает команду без `--force`.
- Вручную на копии вне дерева: п. 1.

## Revisit when

- Первый настоящий DTO (CONTRACT-4): хеш `@bf/contracts#typecheck` не меняется после правки DTO или `docker build` frontend падает.
- Turborepo 2.11.11 и новее (после кулдауна ADR-005) меняет смысл `$TURBO_ROOT$` или `extends` в пакетах.
- Включён `affectedUsingTaskInputs`: шаг CI и скрипт не нужны.
- DTO получают новый суффикс: `scripts/lib/backend-contract-files.ts` и оба `turbo.json` (тест это поймает).

## Related

ADR-005, ADR-009, ADR-027, ADR-035, ADR-050, ADR-057 (заменён пункт 2 в части кеша); R4; backlog CONTRACT-4, CONTRACT-5, CONTRACT-6, CONTRACT-7, CI-4, QUERY-4.
