# ADR-079: Локальная среда и CI под ролями ADR-053: init применяет файлы ролей, тесты идут под `migrator`, проверка миграций - в модели DO (исполняет ADR-053 п. 8)

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-16 |
| **Author** | агент |
| **Decided by** | агент по поручению владельца, ADR-063 п. 2 (техническая развилка) |
| **Tags** | database, local, ci, roles, migrations |

## Context

- ADR-053 п. 8 заменил п. 3 ADR-033 в части роли приложения: локально и в CI те же `migrator` и `app`, что на DO; сейчас init SQL, e2e и `migrations:check` работают под `doadmin` (e2e) и `postgres` (проверка миграций): права шире боевых, недостающий грант тест не заметит.
- ADR-078 дал два файла ролей и прав (`database/roles/`), прибитых к базе `bf`; локальные базы - `bf_dev` и `bf_test` (ADR-033).
- ADR-071 п. 5 оставил роль DDL скрипта `bf_test` за LOCAL-3 («`migrator`, когда LOCAL-3 заведёт роли»).
- Проверено на Postgres 18.6 (чистый том, `pnpm local:reset && pnpm local:up`): init-скрипты видят только сокет; `local` в `pg_hba.conf` - `trust`; `doadmin` без членства в `migrator` оставляет базу за собой, `CREATE` на базе у `migrator` есть (ADR-078 п. 3).

## Options considered

| Развилка | Выбрано | Отклонено |
|---|---|---|
| Файлы ролей | параметр `db` (`psql -v db=<имя>`, по умолчанию `bf`); каждое предложение берёт `current_database()`; без `-v` файл требует `bf`, как на кластере | копия файлов с другим именем базы: два дома одного факта (R4); имя `bf` везде: ломает ADR-033 |
| Откуда init берёт файлы | compose монтирует `./database/roles` только для чтения; init читает те же файлы | копия в `deploy/local/`: расходится с файлами владельца |
| Форма init | `.sh` (исполняемый): роли от `postgres`, затем `psql` под `doadmin` и `migrator` по сокету | `.sql` под `postgres`: файлы ролей требуют входа именно под `doadmin` и `migrator` (проверка `current_user`); Node в образе нет |
| Роль тестов e2e | `migrator`, `DB_SCHEMA=app`: у него `CREATE` на базе, схемы `qf_<hex>` и `tdb_<hex>` хелпера `@bf/test-db` продолжают работать, владелец - `migrator` | `app`: не создаёт схем, ломает режим «схема на файл» (ADR-071); `doadmin`: BYPASSRLS, шире боевого |
| Проверка миграций | в контейнере: платформа (`doadmin`, `migrator`, `app`, база `bf` у `doadmin`), затем оба файла ролей, затем миграции под `migrator` в `bf` | оставить `postgres`: суперпользователь пропустит миграцию, которой на DO не хватит прав |
| Debezium и `doadmin` | как в ADR-033 до CDC-3 (ADR-053 п. 7) | роль Debezium здесь: решает CDC-3 |

## Decision

1. **Файлы ролей** принимают `-v db=<имя>` (по умолчанию `bf`): ожидаемое имя передаётся в `DO`-блоки через `set_config('bf.expected_db', ...)`, а `REVOKE`/`GRANT ON DATABASE`, `ALTER DATABASE ... OWNER` и `ALTER ROLE ... IN DATABASE` собираются `format('%I', current_database())`. Поведение на кластере не меняется: без `-v` файлы требуют `bf`.
2. **Init** (`deploy/local/postgres/init/`): `01-roles-and-databases.sql` как был (`doadmin`, `bf_dev`, `bf_test` у `doadmin`); `02-roles-migrator-and-app.sh` создаёт `migrator` и `app` (LOGIN, пароль `bf_local_only`, без других атрибутов - как оставляет DO) и для `bf_dev` и `bf_test` запускает `01-as-doadmin.sql` под `doadmin` и `02-as-migrator.sql` под `migrator` с `-v db=<имя>`. `compose.yaml` монтирует `./database/roles` в `/database/roles` только для чтения. Init идёт один раз на пустом томе: после правки - `pnpm local:reset`.
3. **Тесты e2e**: `DB_USER=migrator`, `DB_SCHEMA=app`, остальное как было (`127.0.0.1`, `5432`, `bf_test`, `disable`, `bf_local_only`); значения в шаге `End-to-end tests` в `.github/workflows/ci.yml` и в `AGENTS.md`. Тесты, проверяющие поведение приложения под `app`, появятся с первым модулем (SCHEMA-2): сейчас приложения с таблицами нет.
4. **Проверка миграций** (`scripts/check-migrations.ts`): контейнер настроен как у DO (`doadmin` не суперпользователь, `migrator` и `app` с одним LOGIN, база `bf` у `doadmin`), оба файла ролей применены, миграции идут под `migrator` в `bf` с `search_path = app` из настройки роли. `CONTRACT.apply` и `applyCommand` остаются единственным домом команды `psql` (`-U migrator -d bf`; файл без транзакции по-прежнему без `--single-transaction`, ADR-075).
5. **Деплой** (DEPLOY-2): Job миграции применяет файлы той же командой под `migrator`; то, что проходит `pnpm migrations:check`, имеет те же права на кластере.
6. **Роль DDL скрипта `bf_test`** (ADR-071 п. 5): `migrator`; ADR-071 остаётся Accepted и не правится, этот пункт закрывает его условие.
7. ADR-033, ADR-053, ADR-078 остаются Accepted и не правятся.

## Consequences

- Плюс: локально и в CI права те же, что на `bfdb`; миграции, которым не хватает прав `migrator`, падают в PR, а не на кластере; файлы ролей проверены в трёх базах (`bf`, `bf_dev`, `bf_test`).
- Минус: роли и платформа заданы в трёх местах (init-скрипт, `scripts/db-roles.test.ts`, `scripts/check-migrations.ts`): init - оболочка в образе без Node, два других - TypeScript; расхождение ловит `pnpm db:roles:test`, `pnpm migrations:test` и `pnpm local:reset`.
- Минус: init - bash, а не TypeScript (в образе `postgres` нет Node).
- Минус: e2e пока не проверяют права `app`: тестов поведения приложения нет до SCHEMA-2.

## Confirmation

`pnpm local:reset && pnpm local:up` на пустых томах создаёт `migrator` и `app` и схему `app` в `bf_dev` и `bf_test`; `pnpm test:e2e` под `migrator`; `pnpm db:roles:test` (случай `-v db=bf_test` и отказ без `-v`); `pnpm migrations:test` (таблица без схемы попадает в `app`, `CREATE ROLE` в миграции падает).

## Revisit when

- Первый модуль с таблицей (SCHEMA-2): тесты поведения под `app`, скрипт миграций `bf_test`.
- CDC-3 заводит роль Debezium: её права и init.
- DBSEC-7 покажет, что `doadmin` может действовать как `migrator`: модель в `check-migrations.ts` повторить.

## Related

ADR-033, ADR-036, ADR-053 (п. 8), ADR-061, ADR-063, ADR-071 (п. 5), ADR-075, ADR-078; backlog LOCAL-3 (в архиве), SCHEMA-2, DEPLOY-2, CDC-3.
