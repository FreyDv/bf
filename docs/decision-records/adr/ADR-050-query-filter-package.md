# ADR-050: Пакет фильтров `@bf/query-filter`: форма поставки, пины, границы, значения, лимиты, итог спайка (исполняет ADR-024)

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-13 |
| **Author** | агент |
| **Decided by** | агент по поручению владельца (2026-11-12): владелец написал в чате «постарайся все делать сам без моих подтверждений» и «Продолжай, не жди меня»; варианты ниже выбрал агент, владелец может отменить их новой записью |
| **Tags** | api, contract, query, architecture, dependencies |

## Context

- ADR-024 и QRY-1..20 задают контракт фильтра, но инструмента нет: ни пакета, ни `drizzle-orm`, ни драйвера Postgres в манифестах (backlog QUERY-1).
- ADR-024 «Не проверено»: сборка в ESM и валидация по HTTP; при расхождении действует путь из ADR-012 (свой адаптер). ADR-035 п. 5: при провале `toZod(S)` через генератор вариант C заменяет A.
- ADR-048 п. 1: тулкит - отдельный пакет, не shared kernel. ADR-049: `dist/` пакетов виден графу `dependency-cruiser`, из `domain/` в `packages/` можно только kernel.
- Контракт не задаёт: форму пакета, пины, сигнатуры, семантику значений, где проверяются лимиты и как приходит scope.
- PR1 строки QUERY-1 (этот): пакет, entries `core` и `zod`, правила границ для них. PR2: entry `drizzle`, тесты на Postgres, правила для него, закрытие строки.

## Options considered

| Развилка | Выбрано | Отклонено |
|---|---|---|
| Форма поставки | один пакет `packages/query-filter`, ESM, `exports` на `dist/` (`types` и `default`) | исходники `.ts` как у `@bf/contracts` (образ backend не исполнит `.ts` из `node_modules`); три пакета (против QRY-6) |
| `zod` | peer `4.6.7` + dev `4.6.7`: пин репозитория, один экземпляр у тулкита и приложения | обычная зависимость (два экземпляра Zod в дереве) |
| `drizzle-orm` (PR2) | `0.45.4` peer + dev: версию выбирает приложение, один экземпляр | `1.0.0-rc.5` (prerelease, ADR-005 о них молчит); обычная зависимость тулкита |
| Драйвер (PR2) | `pg` `8.23.1` и `@types/pg` `8.23.1` только dev, для тестов QRY-18; боевой драйвер выберет первый модуль | драйвер как зависимость тулкита |
| Возвращаемый тип `toZod(S)` | `z.ZodType<FilterOf<S>, FilterOf<S>>`, объявлен явно | вывод Zod из рекурсивного generic-построителя: тяжёлый тип доходит до `RouterInputs` frontend, равенство с `FilterOf<S>` не гарантировано |
| Type-level тесты | `expectTypeOf` из Vitest и `@ts-expect-error` в файлах из `tsconfig`; их проверяет `pnpm typecheck` | `tsd` (новая зависимость); свой раннер над `tsc` |
| Лимиты QRY-16 | в `toZod` и повторно в `compile` | только в `toZod` (код, строящий фильтр руками, обходит); только в `compile` (плохой запрос доходит до infrastructure, против VAL-1) |
| Спек capability | нет: инфраструктурный пакет, контракт уже нормативен в ADR-024 и QRY | `spec-specify` (дублирует нормативный текст, R4; нет персоны) |
| Спайк | временный, не коммитится, результат здесь | фикстурный роутер в `apps/backend/src` (попадает в `AppRouter` и frontend-образ) |

## Decision

1. **Пакет.** `@bf/query-filter` в `packages/query-filter`, `type: module`, сборка `tsc -p tsconfig.build.json` в `dist/`, `exports`: `./core`, `./zod` (в PR2 `./drizzle`). Тесты и `fixtures.ts` не собираются. `turbo` собирает пакет перед `typecheck`, `lint`, `test` его потребителей (`^build`).
2. **Зависимости.** PR1 ставит только пины репозитория: `zod 4.6.7` (peer + dev), `vitest 5.1.0`, `typescript 6.0.3`, `eslint 10.14.0`. PR2: `drizzle-orm 0.45.4` peer + dev, `pg 8.23.1` и `@types/pg 8.23.1` dev; даты публикации в реестре npm: 2026-10-08, 2026-09-30, 2026-08-17, кулдаун ADR-005 пройден; `pnpm install` проверяет его снова.
3. **Границы** (`.dependency-cruiser.mjs`, имена правил, фикстуры в `pnpm deps:test`); правила читают и имя пакета, и путь в `dist/`, поэтому действуют и до установки пакета:
   - `qry-7-domain-no-toolkit`: из `domain/` ничего из тулкита (поверх `domain-packages-only-kernel` из ADR-049, который видит только разрешённый путь);
   - `qry-7-zod-entry-only-in-adapters`: entry `zod` импортируют только `.router`, `.controller`, `.resolver`, `.cli-controller`, `.message-controller`, `.request.dto` и файлы тестов;
   - `qry-6-core-no-libraries`, `qry-6-core-tests-only-vitest`: `core` без npm-библиотек, в тестах только `vitest`;
   - `qry-6-zod-entry-only-zod`, `qry-6-zod-tests-only-zod-and-vitest`: `zod` импортирует из npm только `zod`;
   - `qry-6-entries-are-independent`: каждый entry зависит от `core` и ни от чего больше в пакете;
   - `qry-6-toolkit-no-apps`: пакет не импортирует `apps/`.
   - PR2 добавит правило `drizzle` только из infrastructure и правила QRY-12. Регэкспы `ADAPTER` и `APPLICATION_IN_SLICE` суффиксов `.filter-spec`, `.filter-binding` не знают: строка backlog.
4. **Значения** (проводные формы, `toZod`):
   - `str` - строка как есть, без нормализации; регистр и collation решает база (PR2: `eq` чувствителен к регистру, `ilike` в контракте нет);
   - `int` - целое в диапазоне безопасных целых JS (`z.int()`); `bigint` и `int8` не поддержаны;
   - `decimal` - строка `-?\d+(\.\d+)?`, без экспоненты и `+`; порядок в `between` считается числами (BigInt), не текстом;
   - `date` - `YYYY-MM-DD`; `datetime` - ISO 8601 с `Z` или смещением, без смещения отклоняется; порядок в `between` - по моменту времени;
   - `uuid` - `z.uuid()`; `bool` - boolean; `oneOf` - один из значений enum или массива;
   - `in` и `nin` с пустым списком допустимы (смысл в SQL - PR2); `between` и `nbetween` требуют `v1 <= v2`.
5. **Ошибки** (QRY-5, ADP-8): все нарушения структуры и диапазонов идут как issues Zod, вместе, с путём к узлу. Неизвестный ключ даёт одну ошибку, а не ещё и «пустой узел».
6. **Лимиты QRY-16** считает `checkLimits` из `core`; `toZod` вызывает его первым, на сыром значении, до разбора структуры: тело, вложенное в сто тысяч уровней, отклоняется без рекурсии Zod. Если лимит превышен, ошибки структуры рядом не идут.
   - Вложенность `AND`/`OR`/`NOT` - по одному пути, 5; уровни связей - по одному пути, 2; узлы - объекты узлов плюс условия, 50; список `in`/`nin`, 1000.
   - Запрос может только ужесточить: `toZod(S, { limits })` и `resolveLimits` бросают `RangeError` на значение выше умолчания.
   - `compile` (PR2) вызывает тот же `checkLimits`.
7. **Scope** (QRY-17): `compile` возвращает только SQL-фрагмент фильтра; вызывающий пишет `and(scope, фрагмент)`. Фильтр физически не заменяет авторизацию (ADR-040 п. 5).
8. **Тип.** `toZod(S)` объявлен как `z.ZodType<FilterOf<S>, FilterOf<S>>`; соответствие схемы типу доказывают тесты принять и отклонить, а `z.infer` и `z.input` равны `FilterOf<S>` по объявлению. Input и output одинаковы, иначе `RouterInputs` получил бы `unknown`.
9. **Спайк** (2026-11-13, на настоящих `core` и `zod`, фикстурный роутер в `apps/backend/src/spike`, удалён, не закоммичен; `nestjs-trpc` 2.14.0, Zod 4.6.7, TS 6.0.3):
   - `pnpm contracts:generate` раскрыл `findSpikes` со схемой `toZod(S)`; `pnpm contracts:check` и `pnpm deps` зелёные;
   - `tsc` frontend принял `RouterInputs['spike']['findSpikes']`: допустимый фильтр компилируется, два `@ts-expect-error` (оператор вне набора, неизвестное поле) срабатывают;
   - HTTP на собранном ESM: допустимый фильтр с `orders.some`, `orders.every`, `group`, `OR` - 200; оператор вне набора, неизвестное поле, `between` с `v1 > v2`, `value` у `isnull`, пустой узел, вложенность 6 - 400 с issues; тело вложенности 700 - 400 с одной ошибкой лимита;
   - образ backend собран и запущен с тулкитом, ответы те же; в образе `node_modules/@bf/query-filter` содержит `dist/` и `package.json`;
   - спайк шёл после написания `core` и `zod`, а не до: DoD строки требует настоящую `toZod(S)`, на фабрике его уже проверяли 2026-11-08 (ADR-024);
   - образ frontend: с зависимостью только backend сборка падает (`TS2307`, нет `dist/` тулкита: его нет в графе turbo frontend, `--filter=@bf/frontend` собирает только `^build` frontend); после добавления `@bf/query-filter` в `dependencies` `@bf/contracts` сборка проходит, turbo выполняет две задачи (тулкит и frontend), типы фильтра проверены; образ не запускали.
   - Итог: supersede ADR-012 и ADR-035 не нужен.
10. **Роутеры.** Каждая процедура объявляет `output` (схема в `*.response.dto.ts`). Без неё генератор импортирует класс роутера в `server.ts`; frontend проверяет его со своим `tsconfig` и падает на декораторах (`TS1241`), правило `contracts-only-dtos-from-backend` срабатывает в `pnpm deps` (оба проверены спайком).
11. **Ответ на CONTRACT-3 для entry `zod`.** Frontend видит типы тулкита из `dist/`. Для образа и CI нужно ребро в графе turbo от frontend к тулкиту: `@bf/query-filter` в `dependencies` `@bf/contracts`, и зависимость `apps/backend` от него (по ней DTO резолвит пакет). Оба ребра приходят с первым модулем, у которого есть `*.request.dto.ts` с `toZod`; пакет без потребителя их не получает (PRG-3).
12. **Тесты на Postgres** (PR2): `test:e2e` в самом пакете (ADR-039 п. 1.2); хелпер отказывается работать с БД без `test` в имени (TST-3); таблицы тулкита создаёт и удаляет сам тест, в базе `bf_test` и в отдельной схеме, а не миграции: узкое исключение из ADR-039 п. 5.1, только для тестовых таблиц тулкита; TEST-2 обобщает хелпер и снимает исключение.
13. **Enum QRY-20** не создаётся до первого клиентского enum: `oneOf(Enum)` проверен на локальном enum тестов тулкита; расхождение пути `packages/contracts/<module>/` с фактическим `src/` - строка backlog.
14. **Исключение из gate `ddd-plan-module`.** Тулкит не бизнес-модуль (STR-1): capability-спека нет, раздел AIP-2 ниже заменяет её; контракт нормативен в ADR-024.

## Architecture conformance

- Module: тулкит фильтров, `packages/query-filter`; не бизнес-модуль, PRG-1 не применяется: ни агрегатов, ни инвариантов домена, только данные описания полей, типы и схемы
- Slices: нет (STR-2 про use case); entries: `core` (читает application, адаптеры, infrastructure), `zod` (только interface adapters), `drizzle` (только infrastructure, PR2)
- Файлы: `src/core/{operators,fields,filter,limits,index}.ts` (данные и типы, без библиотек), `src/zod/{values,to-zod,index}.ts` (схема запроса), тесты рядом (`*.test.ts`), `src/core/fixtures.ts` (общие описания для тестов, не собирается)
- Агрегаты, сущности, объекты-значения: нет; инвариант описания (`defineFilter`: поле с оператором, без зарезервированных имён, строковый enum) защищён в самих построителях и проверен типами и тестами (DOM-V5)
- События домена: нет; транзакция: нет
- Порты: тулкит не вводит; read-порт запроса с фильтром принадлежит модулю (QRY-8), этот пакет даёт `FilterOf<S>` для его сигнатуры
- Ошибки: нарушения запроса - issues Zod (QRY-5, ADP-8), технические - исключения (ERR-3); `RangeError` при попытке ослабить лимит - ошибка программиста при построении схемы
- DTO: `toZod(S)` даёт поле `filter` request DTO (ADP-3, QRY-10); response DTO не затронуты
- Запросы с фильтром: описание полей, `defineFilter`, relation только через готовое описание, EXISTS - PR2 (QRY-11), другой модуль через `public/` - правила PR2 (QRY-12), enum в contracts - отложено (п. 13)
- Тесты: type-level (запрещённый оператор, числовой enum, `z.infer` равен `FilterOf<S>`), принять и отклонить, лимиты, правила границ на фикстурах; Postgres - PR2 (TST-2, TST-3, QRY-18)
- Граница: `pnpm deps` и `pnpm deps:test`, `.dependency-cruiser.mjs`, шаг `Architecture boundaries` в `ci`, зелёные на дату записи (ENF-1)
- Правила, не применённые: STR-1, STR-8 (не бизнес-модуль, п. 14); TST-2 по уровням: нет доменного и use-case уровня, поведенческий - PR2

## Consequences

- Positive: один способ писать фильтр доступен PR2 и QUERY-2; тип фильтра доходит до frontend точным; лимиты и ошибки одинаковы во всех модулях.
- Positive: правила QRY-6 и QRY-7 держат `zod` вне application и `core` без библиотек, пока ни одного модуля нет.
- Negative: `toZod(S)` возвращает объявленный тип, а не выведенный: расхождение схемы и типа ловят только тесты пакета, не компилятор.
- Negative: лимиты считаются дважды (`toZod` и `compile`), одним кодом.
- Negative: потребитель собирает пакет перед `typecheck`; без рёбер из п. 11 образ frontend падает при первом `toZod`.
- Negative: исключение из ADR-039 п. 5.1 для тестовых таблиц тулкита (п. 12) живёт до TEST-2.
- Negative: значения `int` ограничены безопасными целыми JS, `decimal` - строкой без экспоненты; `bigint` и `ilike` вне контракта (QUERY-2).
- Follow-ups: PR2 (entry `drizzle`, Postgres, правила QRY-12 и `drizzle`, закрытие QUERY-1); первый модуль добавляет рёбра из п. 11 (CONTRACT-3); TEST-2 обобщает хелпер; регэкспы суффиксов `.filter-spec`, `.filter-binding`; enum QRY-20.
- Не проверено: CI на GitHub; образ frontend не запускали (проверена сборка); `compile` и SQL (PR2).

## Confirmation

- Машинно: `pnpm typecheck` (type-level тесты), `pnpm test` (принять и отклонить, лимиты), `pnpm deps` и `pnpm deps:test` (правила п. 3, фикстуры по имени пакета и по пути в `dist/`), `pnpm contracts:check`.
- Не воспроизводится в CI до первого модуля: спайк п. 9; регрессию сборки образа frontend с `toZod(S)` даст первый модуль и CONTRACT-3.
- Ревью: пункт 9 чеклиста AIP-6 в `ddd-review`.

## Revisit when

- Первый модуль не собирается в образе frontend при рёбрах из п. 11: п. 11 и CONTRACT-3.
- `nestjs-trpc` перестаёт раскрывать схему из `toZod(S)` или импортирует роутер при заданном `output`: п. 9 и 10.
- Рекурсивный `FilterOf<S>` даёт на реальном модуле заметную нагрузку на `tsc` frontend или глубину инстанцирования: п. 8.
- Нужны `bigint`, регистронезависимый поиск или смещённые даты без зоны: п. 4 (вместе с QUERY-2 и ADR-024).
- Выходит `drizzle-orm` 1.0 без prerelease или старая ветка 0.45 перестаёт получать исправления: п. 2.

## Related

ADR-002, ADR-005, ADR-012, ADR-013, ADR-014, ADR-016, ADR-024, ADR-035, ADR-039, ADR-040, ADR-048, ADR-049; QRY-1..20, ENF-1, VAL-1, ADP-8; backlog QUERY-1, QUERY-2, TEST-2, CONTRACT-3.
