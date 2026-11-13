# ADR-051: Entry `drizzle` пакета фильтров: привязка к колонкам, форма SQL, пустые списки, границы QRY-7 и QRY-12 (исполняет ADR-024, дополняет ADR-050)

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-13 |
| **Author** | агент |
| **Decided by** | агент по поручению владельца (2026-11-12): владелец написал в чате «постарайся все делать сам без моих подтверждений» и «Продолжай, не жди меня»; варианты ниже выбрал агент, владелец может отменить их новой записью |
| **Tags** | query, architecture, database, testing |

## Context

- ADR-050 п. 2, 7, 12 уже решил для PR2: пины `drizzle-orm 0.45.4` (peer и dev), `pg` и `@types/pg` (dev), `compile` возвращает фрагмент без scope, лимиты проверяются повторно, тесты на Postgres живут в самом пакете. Здесь только то, чего ADR-050 не держит: сигнатуры привязки, форма SQL, пустые списки, поведение `compile` на кривом вводе, границы.
- QRY-11, QRY-13, QRY-14, QRY-15 задают семантику; QRY-7 и QRY-12 - границы; ADR-024 п. 7 кладёт компилятор условия в `public/` модуля.
- ADR-050 п. 4 оставил смысл пустых `in` и `nin` для SQL (PR2).

## Options considered

| Развилка | Выбрано | Отклонено |
|---|---|---|
| Привязка поля к колонке | `defineBinding(spec, fields)`: тип `BindingFields<S>` требует запись на каждое поле и не допускает лишнюю (QRY-15); колонка - `AnyColumn` | SQL-выражение вместо колонки (имя колонки может прийти не из привязки); необязательные поля (поле без колонки не должно собираться) |
| Привязка связи | `related(table, on, binding)`: `on` - SQL корреляции с таблицей узла (`eq(orders.userId, users.id)`), `binding` - привязка спеки связи, её `spec` проверяется на равенство спеке поля | JOIN в фильтре (умножает строки корня, QRY-11); внешний ключ как имя колонки в строке (идентификатор из строки) |
| Значения в SQL | всегда параметры через шаблон `sql` без кодировщика колонки: тип значения решает Postgres по колонке | `eq(column, value)` из drizzle: кодировщик колонки (например `mode: 'date'` у `timestamp`) не принимает строку ISO с провода; `sql.raw` и `sql.identifier` (запрещены QRY-15, тест читает исходники) |
| Пустой `in` / `nin` | `in []` - `case when col is null then null else false end`, `nin []` - то же с `true`: `nin` - отрицание `in`, ни тот ни другой не возвращает строку с NULL (QRY-14), `NOT in []` равен `nin []` | `in []` - `false`, `nin []` - `true` (`nin []` вернул бы строки с NULL, а `nin [x]` нет; `NOT` над `in []` разошёлся бы с `nin []`) |
| Кривой ввод в `compile` | `TypeError` на пустой узел, неизвестное поле, оператор вне набора поля, значение не того вида (по `kind`), `value` у `isnull`, пару не из двух, не один квантор; `RangeError` на лимит. Это ошибка программиста при ручной сборке (ERR-3): запрос приходит с границы уже разобранным `toZod` | молча собирать то, что понял; Result (бизнес-исхода тут нет) |
| Где компилятор модуля | entry `drizzle` импортируется только из `infrastructure/` (решение владельца, QRY-7); исключения для `public/<x>.filter-compiler.ts` нет, где писать компилятор из ADR-024 п. 7 решает QUERY-4; `qry-12-filter-compiler-only-from-infrastructure`: чужой `public/*.filter-compiler.ts` импортируется только из `infrastructure/` | разрешить `public/` импорт `drizzle` (решение не принято владельцем) |
| Разделение тестов | `*.e2e.test.ts` не входят в `test`, идут в `test:e2e` (`vitest.e2e.config.ts`); тесты, которым нужны несколько entry, лежат в `test/` пакета (правило `qry-6-entries-are-independent` читает только `src/`) | один конфиг на всё (`pnpm test` потребовал бы Postgres) |

## Decision

1. **Привязка.** `defineBinding` и `related` в `src/drizzle/binding.ts`; типы `FilterBinding`, `BindingFields`, `RelationBinding`. Проверка повторяется на рантайме: нет поля, лишнее поле, связь без `related`, спека связи не своя. Таблица связи подставляется как есть: связь на самого себя и одна таблица на двух уровнях одного пути не поддержаны (алиасы `alias()` в шаблоне `sql` раскрываются без `table alias`); внешний ключ в `on` индексирован (QRY-11), тесты создают такие индексы.
2. **SQL.** `compile(binding, filter, { limits? })` возвращает один скобочный `SQL`: поля узла через `and`; `AND`, `OR` - соединение детей; `NOT` - `not (узел)`; условие поля - `col op $n`; `between`, `not between` с включёнными границами; `isnull`, `nisnull`.
   - `some` - `exists (select 1 from t where on and узел)`; `none` - `not exists (...)`; связь один к одному - `exists (...)`; `every` (QRY-13) - `not exists (select 1 from t where on and (узел) is not true)`. Корень никогда не умножается (QRY-11). `NOT` над связью - `not (exists ...)`, строки без связанных записей подходят.
   - Значения - параметры. Колонка и таблица приходят из привязки (QRY-15).
3. **Пустые списки.** Как в таблице выше. Для `in` и `nin` с одним значением и больше - обычное `in`, `not in`.
4. **Лимиты** считает `checkLimits` из `core`; превышение - `RangeError` с описанием каждого нарушения и путём (ADR-050 п. 6). `limits` только ужесточает.
5. **Границы** (`.dependency-cruiser.mjs`, фикстуры в `pnpm deps:test`): `qry-7-drizzle-entry-only-in-infrastructure`, `qry-12-filter-compiler-only-from-infrastructure`, `qry-6-drizzle-entry-only-drizzle-orm`, `qry-6-drizzle-tests-only-drizzle-orm-pg-and-vitest`; `qry-7-domain-no-toolkit` уже закрывает `domain/` по имени `@bf/query-filter/drizzle`. Правила читают имя и путь в `dist/`, как для `zod`. Остаток QRY-12 (описание фильтра другого модуля читается только из его `public/`, чужие таблицы не импортируются) уже держат `dep-5-modules-only-through-public` и `dep-2-*`; суффиксы `.filter-spec`, `.filter-binding` в регэкспах слоёв - QUERY-4.
6. **Тесты.** `test:e2e` пакета: `vitest run --config vitest.e2e.config.ts`, база из `DATABASE_URL` (CI подставляет `bf_test`, `turbo.json` пропускает переменную). Хелпер `test/db.ts`: имя базы должно содержать слово `test` (TST-3), проверяются имя в URL и `current_database()`; схема `qf_<8 hex>` на каждый файл, создаётся и удаляется тестом (ADR-050 п. 12). Покрыто: NULL, `neq`, `nin`, `nbetween`, `some`, `none`, `every` (пустая связь, NULL), `NOT` над связью, пустые списки, лимиты, scope снаружи, параметры, согласие `toZod` и `compile`; без базы: текст SQL и тип привязки (`@ts-expect-error`: поле без колонки, колонка без поля, связь с колонкой, чужая спека).

## Consequences

- Positive: пакет закрывает QRY-1..20 как инструмент; первый список с фильтром пишется через `defineBinding` и `compile`.
- Positive: `compile` не принимает кривой ввод молча и не строит идентификатор из запроса.
- Negative: значения идут без кодировщика колонки: `date` и `datetime` как строки ISO, их приводит Postgres; колонка с нестандартным драйверным типом (например составным) не поддержана.
- Negative: `in []` и `nin []` в SQL длиннее, чем `false` и `true`.
- Negative: без алиасов связь на себя не собирается (п. 1).
- Negative: `pg` и `@types/pg` лежат только в dev; боевой драйвер выберет первый модуль, тесты `drizzle` проверяют SQL на `pg`, не на нём.
- Follow-ups: TEST-2 обобщает хелпер `test/db.ts` и снимает исключение ADR-050 п. 12; QUERY-4 - суффиксы в регэкспах слоёв и место компилятора фильтра в `public/` (импорт `drizzle` оттуда сейчас запрещён).
- Не проверено: CI на GitHub (шаг e2e начнёт выполняться, потому что у пакета появился `test:e2e`); образ backend с `drizzle-orm`.

## Confirmation

- Машинно: `pnpm test` (SQL, типы), `pnpm test:e2e` (Postgres), `pnpm deps` и `pnpm deps:test` (п. 5), `pnpm typecheck`, `pnpm lint`.
- Ревью: пункт 9 чеклиста AIP-6 в `ddd-review`.

## Revisit when

- Первый модуль требует связь на самого себя или одну таблицу на двух уровнях пути: п. 1.
- Появляется `ilike`, сортировка или JOIN для столбцов ответа (QUERY-2): п. 2, п. 5.
- `drizzle-orm` меняет шаблон `sql` или рендер таблицы (ветка 1.0): п. 1, п. 2.
- Нужен драйвер с другим кодированием параметров: п. 2 (значения без кодировщика колонки).

## Related

ADR-002, ADR-013, ADR-014, ADR-024, ADR-039, ADR-048, ADR-049, ADR-050; QRY-1..20, ENF-1, ERR-3, TST-3; backlog QUERY-1, QUERY-2, QUERY-4, TEST-2.
