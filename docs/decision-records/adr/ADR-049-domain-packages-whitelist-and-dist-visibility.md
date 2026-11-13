# ADR-049: Проверка границ - из `domain/` в `packages/` только `@bf/kernel`, что импортирует сам kernel, `dist/` пакетов виден графу (уточняет ADR-048 п. 6)

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-13 |
| **Author** | агент |
| **Decided by** | агент по поручению владельца (2026-11-12): владелец написал в чате «постарайся все делать сам без моих подтверждений»; варианты ниже выбрал агент, владелец может отменить их новой записью |
| **Tags** | architecture, boundaries |

## Context

- ADR-048 п. 6 оставил три дыры и назвал их строкой BOUND-2: `dep-3-domain-no-libraries` смотрит только npm-типы, поэтому из `domain/` проходит импорт любого workspace-пакета; не решено, какие npm-пакеты может импортировать сам kernel; при `exports` пакета в `dist/` импорт выпадает из графа.
- Проверено запуском `depcruise` 18.7.2 на временном дереве фикстур (2026-11-13):
  - `options.exclude` с `(^|/)dist/` действует и на цель зависимости: `dist/` пакета workspace и `dist/` любой npm-библиотеки исчезают из графа, правило их не видит;
  - так выпадал не только kernel: `dep-3` не видел npm-пакет, чья точка входа лежит в `dist/` (форма поставки neverthrow); на фикстуре со входом в `dist/` `dep-3-domain-no-libraries` не срабатывал на `neverthrow` из `domain/`;
  - `doNotFollow.path` принимает список; модуль, подпавший под него, остаётся в графе листом: его входящее ребро проверяется правилами, его собственные импорты не читаются.
- Заготовленные клиенты: `@bf/contracts` из `domain/` запрещает QRY-20 (пакет импортирует backend, домен не может зависеть от DTO), будущий пакет фильтров (QRY-6, ADR-024) домену тоже не нужен (QRY-7: domain ничего из тулкита). Единственный пакет, который `domain/` вправе брать из `packages/`, - kernel (ENF-4, ADR-048).
- Правило, названное в `.claude/rules/query-filter-rules.md` QRY-19 («запрет `contracts` из `domain/`»), до сих пор не имело правила в конфиге.

## Options considered

| Развилка | Выбрано | Отклонено |
|---|---|---|
| Что из `packages/` можно в `domain/` | белый список: только `packages/kernel/` | чёрный список (`contracts`, пакет фильтров): каждый новый пакет надо вносить отдельно, пропуск молчит |
| Где действует белый список | любая папка `domain/` под `apps/*/src/`, файлы тестов включены | только `apps/backend/src/<модуль>/domain/`: frontend остаётся без проверки |
| Что импортирует kernel из npm | только neverthrow; в тестовых файлах ещё vitest | свободно: kernel становится вторым местом, куда тянут библиотеки, а ENF-4 держит его малым и свободным от домена |
| Что импортирует kernel из workspace | ничего (ни `apps/`, ни другие пакеты) | другие пакеты: kernel зависит от того, что зависит от backend (круг через `@bf/contracts`) |
| Как вернуть `dist/` в граф | убрать `dist/` пакетов из `options.exclude`, поставить `packages/*/dist/` в `doNotFollow`: лист виден, не читается | оставить `exclude` и ловить пакеты по имени модуля (приём `dep-4-openai-only-in-infrastructure`): не работает для относительных путей и не чинит `dep-3`; снять `dist/` с `doNotFollow` совсем: собранный код пакета проверяется правилами исходников |

## Decision

1. **Белый список.** Правило `domain-packages-only-kernel`: файл в `domain/` под `apps/*/src/` (включая файлы тестов) не импортирует ничего из `packages/`, кроме `packages/kernel/`. Правило смотрит на путь, в который импорт разрешился, поэтому действует и на имя пакета (`@bf/contracts`), и на относительный путь. Закрывает пункт QRY-19 «запрет `contracts` из `domain/`» (QRY-20) и ту же дыру для пакета фильтров.
2. **Что импортирует kernel.** Из npm - только `neverthrow` (правило `kernel-npm-only-neverthrow`), файлы тестов kernel - ещё `vitest` (`kernel-tests-only-neverthrow-and-vitest`, как `dep-3-domain-tests-only-vitest`). Из workspace - ничего: `kernel-is-domain-free` теперь запрещает и `apps/`, и любой другой `packages/*`. Встроенные модули Node правилами не ограничены: решения о них нет (ADR-048 п. 4 говорит про библиотеки). Новая библиотека в kernel - новая запись.
3. **`dist/` пакетов в графе.** Из `options.exclude` убран `(^|/)dist/`; остались `^apps/[^/]+/dist/` (сборка приложений), `.next` и `coverage`. В `options.doNotFollow` к `node_modules` добавлен `^packages/[^/]+/dist/`. Это правка `options` (ADR-014 п. 4): ослабления нет, граф только полнее.
4. **Какие правила это включает.** С видимым `dist/`:
   - `domain-packages-only-kernel` видит `@bf/contracts` и `@bf/kernel`, если их `exports` указывают в `dist/`;
   - `kernel-is-domain-free`, `kernel-npm-only-neverthrow`, `kernel-tests-only-neverthrow-and-vitest` видят импорты kernel и сам `dist/` как лист;
   - `dep-3-domain-no-libraries` и `dep-3-domain-tests-only-vitest` видят npm-библиотеку, чей вход лежит в `dist/` (neverthrow, nestjs-trpc, vitest), чего раньше не видели;
   - `dep-4-openai-only-in-infrastructure` и `not-to-dev-dep-from-prod` видят импорт, разрешившийся в `dist/` библиотеки;
   - QRY-7 и QRY-12 (QUERY-1) для пакета фильтров с `exports` в `dist/` строятся на том же: правило по пути ловит и этот пакет.
5. **Фикстуры** (`scripts/boundaries.test.ts`, `pnpm deps:test`): `@bf/contracts` из `domain/` отклонён (по имени, относительным путём, из файла теста, из `domain/` frontend); `@bf/kernel` из `domain/` разрешён с проверкой, что граф видит ребро, и с `exports` из исходников, и из `dist/`; на дереве с `exports` в `dist/` отклонён `@bf/contracts`, `dist/` остаётся листом (его импорт `zod` не оценивается); из kernel отклонены npm-пакет, не neverthrow (и `vitest` вне теста), другой пакет workspace; разрешён neverthrow (его вход в `dist/`), а в тесте kernel - ещё vitest.
6. **ADR-048 п. 6 заменён** этой записью; ADR-048 остаётся Accepted и не правится. Строка BOUND-2 закрыта.

## Consequences

- Positive: новый пакет в `packages/` не нужно вносить в запретный список: `domain/` его не импортирует по умолчанию; `dep-3` перестаёт молча пропускать npm-библиотеки со входом в `dist/`.
- Positive: правило QRY-19 про `contracts` и `domain/` получило проверку, пакет фильтров идёт по тому же правилу.
- Negative: граф больше (на реальном дереве 28 модулей до правки, 35 после: листья `dist/` npm-пакетов); новые правила видят и то, что раньше не видели, значит возможны новые срабатывания на уже написанном коде; на дату записи `pnpm deps` их не показал.
- Negative: `dist/` пакета читается как лист; собранный код не проверяется, только ребро в него. Ошибка в исходниках пакета ловится правилами на путях `src/`, а не `dist/`.
- Negative: `doNotFollow` для `packages/*/dist/` привязан к форме `packages/<имя>/dist/`; иное место сборки потребует правки.
- Follow-ups: LOG-2 создаёт настоящий `@bf/kernel` и в тот же день запускает `pnpm deps` и `pnpm deps:test`; QUERY-1 опирается на это правило и не добавляет своего запрета `contracts` из `domain/`.

## Confirmation

- Машинно: `pnpm deps` и `pnpm deps:test` (шаг `Architecture boundaries` в `ci`): правила из п. 1, 2 и фикстуры из п. 5; тесты `dist/` падают, если вернуть `(^|/)dist/` в `exclude` или убрать `packages/*/dist/` из `doNotFollow` (проверено вручную 2026-11-13).
- Ревью: `ddd-review` (AIP-6.2): новая зависимость kernel от npm-пакета, кроме neverthrow, идёт записью, а не правкой правила.

## Revisit when

- В kernel понадобился npm-пакет, кроме neverthrow, или встроенный модуль Node (`node:crypto` для идентификаторов и подобное): п. 2.
- Пакет workspace с собственной сборкой кладёт её не в `packages/<имя>/dist/`: п. 3.
- Домен получает от пакета, кроме kernel, то, без чего не обойтись (например, общий тип идентификатора): п. 1.

## Related

ADR-002, ADR-014, ADR-024, ADR-035, ADR-048; ENF-1, ENF-4, DEP-2, DEP-3, DEP-6, QRY-6, QRY-7, QRY-12, QRY-19, QRY-20; backlog BOUND-2, QUERY-1, LOG-2.
