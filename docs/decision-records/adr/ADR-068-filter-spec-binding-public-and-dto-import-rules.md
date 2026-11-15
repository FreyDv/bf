# ADR-068: Слой файлов `.filter-spec`, `.filter-binding`, `public/` и правило на импорты DTO в `.dependency-cruiser.mjs` (дополняет ADR-024 п. 7 и 11, ADR-051, ADR-057 п. 6)

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-15 |
| **Author** | агент |
| **Decided by** | агент по поручению владельца, ADR-063 (техническая развилка) |
| **Tags** | architecture, query, contract, dependencies |

## Context

- ADR-024 п. 11 добавил к STR-6 и STR-7 папку `public/` и суффиксы `.filter-spec`, `.filter-binding`, `.enum`; `.dependency-cruiser.mjs` их слоями не знал: файл описания фильтра в срезе не относился ни к application, ни к адаптерам.
- ADR-051 оставил на QUERY-4 суффиксы в регэкспах слоёв и место компилятора фильтра в `public/`: entry `drizzle` берут только из `infrastructure/` (QRY-7), а компилятор для чужого модуля лежал в `public/` (ADR-024 п. 7).
- ADR-057 п. 6 отложил правило на то, что импортирует сам DTO: `contracts-only-dtos-from-backend` видит только прямые рёбра из `packages/contracts`, а тип для frontend определяют и файлы, которые читает DTO.
- Бэкенд-модулей нет: проверку несут фикстуры `scripts/boundaries.test.ts`.

## Options considered

| Развилка | Выбрано | Отклонено |
|---|---|---|
| Место компилятора | код в `infrastructure/<x>.filter-compiler.ts`, `public/<x>.filter-compiler.ts` - реэкспорт | код в `public/` и исключение из QRY-7: ослабляет правило, которое держит `drizzle` в infrastructure; отдельная папка вне модуля: ломает DEP-5 |
| Класс `.filter-spec` | нейтрален: application, адаптеры и infrastructure читают; domain нет; сам спек - лист | слой application: адаптеры (`request.dto`, router) тогда не читают; слой адаптеров: application не читает |
| Политика `public/` | узкая: только то, что названо ниже | общий фасадный регэксп с произвольными импортами: сверх DEP-5, правило без потребителя (PRG-4) |
| Импорты DTO | белый список целей | чёрный список (domain, infrastructure): новый файл или пакет проходит молча |
| Текст `architecture-rules.md` | не правится; суффиксы и `public/` определены в `query-filter-rules.md`, проверяются в `.dependency-cruiser.mjs` | дописать суффиксы в STR-7: правило DDH меняется ради набора, который живёт в QRY |

## Decision

1. **Компилятор.** Код `<x>.filter-compiler.ts` лежит в `infrastructure/` модуля и импортирует entry `drizzle`; `public/<x>.filter-compiler.ts` его реэкспортирует. QRY-7 не ослаблен: `public/` по-прежнему не импортирует `drizzle` (фикстура `billing/public/bad-drizzle.filter-compiler.ts` остаётся нарушением). Блок Layout в `.claude/rules/query-filter-rules.md` показывает оба файла.
2. **`.filter-spec` нейтрален.** application, адаптеры и infrastructure его импортируют. Правило `dep-2-domain-no-filter-spec`: domain не импортирует ни один `.filter-spec` (среза и `public/`). Правило `qry-filter-spec-is-leaf`: спек импортирует только entry `core` пакета `@bf/query-filter`, другие `.filter-spec` (своего модуля или `public/` чужого), файлы `*.enum.ts` вне `domain/` и файлы enum пакета `packages/contracts` (путь под `packages/contracts/src/`, оканчивается на `.enum.ts`).
3. **`.filter-binding`** лежит только в `infrastructure/`: правило `qry-filter-binding-only-in-infrastructure`.
4. **`public/`.** Домен `public/` не импортирует: `dep-2-domain-no-public` (свой и чужой). `qry-public-only-contract-files`: `public/` импортирует только другие файлы `public/`, entry `core`, файлы `.filter-spec` и `.enum`. Единственное исключение, `qry-public-compiler-reexports-own-infrastructure`: файл `*.filter-compiler.ts` в `public/` импортирует ещё и `*.filter-compiler.ts` из `infrastructure/` своего модуля. Шире политики нет: что ещё модуль отдаёт другим, остаётся в пределах DEP-5.
5. **Импорты DTO.** Правило `contracts-dto-imports-only-contract-files`: файлы с суффиксами `request.dto`, `response.dto`, `enum` (`DTO_SUFFIXES`) в `apps/backend/src` вне `domain/` (enum домена - файл домена, его судят DEP-2 и DEP-3, сгенерированный файл его не читает) импортируют только файлы контракта (`request.dto`, `response.dto`, `enum`, `filter-spec`) вне `domain/`, entry `core` и `zod` пакета `@bf/query-filter`, `zod` и файлы enum пакета `packages/contracts`; индекс `@bf/contracts` нельзя: он импортирует `generated/server.ts`, а тот импортирует DTO, это цикл. Ядра (kernel) в списке нет: `packages/kernel` не существует. Регэкспы собраны из `scripts/lib/backend-contract-files.ts` (R4: `BACKEND_DTO_FILES`, `DTO_IMPORT_TARGETS`, `FILTER_SPEC_IMPORT_TARGETS`); `BACKEND_CONTRACT_FILES` и globs turbo не менялись.
6. **Текст правил.** `.claude/rules/architecture-rules.md` не правится: суффиксы `.filter-spec`, `.filter-binding`, `.filter-compiler` и папка `public/` определены в `.claude/rules/query-filter-rules.md` и проверяются в `.dependency-cruiser.mjs`.
7. **Не менялось:** ADR-024, ADR-051, ADR-057 (кроме отложенного пункта 6, который эта запись исполняет); существующие правила QRY-7 и QRY-12.

## Consequences

- Positive: слои файлов фильтра проверяет `pnpm deps`; новый модуль получает границы до первого кода; то, что DTO тянет за собой для frontend, ограничено списком, а не памятью ревьюера.
- Negative: правило `qry-filter-binding-only-in-infrastructure` читает импорты файла; файл `.filter-binding` без единого импорта не виден (привязка всегда импортирует entry `drizzle` и свой спек).
- Negative: то, что файл компилятора в `public/` только реэкспортирует и не содержит логики, cruiser не различает (он видит ребро, не вид импорта); остаётся за ревью (`ddd-review`).
- Negative: файл с суффиксом, которого нет в списке, правила не видят; новый суффикс - правка `scripts/lib/backend-contract-files.ts` и этой записи.
- Negative: реальных рёбер нет, пока нет первого модуля; фикстуры доказывают правила, не потребителя.

## Confirmation

`pnpm deps` и `pnpm deps:test` (`scripts/boundaries.test.ts`): на каждое новое правило есть нарушающая и допустимая фикстура; случаи, которые уже ловит существующее правило (`request.dto` -> domain: `dep-2-adapters-no-domain-no-infrastructure`; импорт `public/` другого модуля из своей infrastructure: `dep-5-modules-only-through-public`), проверяются по имени сработавшего правила и не дублируются новым.

## Revisit when

- Первый модуль со списочным query: реальные рёбра не ложатся в правила (например, спеку нужен файл вне перечня) - расширить список новой записью.
- Появится `packages/kernel` и DTO потребуется что-то оттуда: добавить в список импортов DTO.
- Появятся суффиксы сортировки или пагинации из ADR-067: решить, листья ли они.

## Related

ADR-024 (п. 7, 11), ADR-035, ADR-050, ADR-051, ADR-057 (п. 6), ADR-063, ADR-067; `.claude/rules/query-filter-rules.md` (QRY-7, QRY-12, QRY-20); `.dependency-cruiser.mjs`; backlog QUERY-4 (в архиве).
