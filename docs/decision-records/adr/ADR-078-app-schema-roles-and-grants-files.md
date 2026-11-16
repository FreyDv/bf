# ADR-078: Схема `app`, файлы ролей и прав `bfdb` для владельца; пара R24 и скрипт `bf_test` - с первой таблицей (исполняет ADR-053 п. 3)

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-16 |
| **Author** | агент |
| **Decided by** | агент по поручению владельца, ADR-063 п. 2 (техническая развилка) |
| **Tags** | database, security, roles, schema |

## Context

- ADR-053 п. 3 оставил SCHEMA-1 имя схемы приложения и точные `GRANT`/`REVOKE` для ролей `migrator` и `app`; SQL применяет человек в DBSEC-7. Его ждут DBSEC-7 и DEPLOY-2.
- SCHEMA-1 несёт и условное: `database/schema/` с типизированной парой (R24), скрипт миграций для `bf_test` (ADR-071 п. 5). Ни спеки, ни таблицы нет: пара и скрипт сейчас были бы пустышкой (PRG-3).
- На `bfdb` `doadmin` не суперпользователь (`docs/runbooks/bfdb-postgres.md`); роли `migrator` и `app` создаёт DigitalOcean (`doctl databases user create`), и есть ли у `doadmin` право действовать от их имени, не известно.
- Проверено на Postgres 18.6 в тесте: `ALTER DATABASE ... OWNER` переносит записи прав старого владельца на нового, и после `REVOKE ... FROM PUBLIC` прежний владелец теряет `CONNECT`.

## Options considered

| Развилка | Выбрано | Отклонено |
|---|---|---|
| Объём | ADR, два файла ролей и прав и их тест; пара, скрипт `bf_test`, первая таблица - строка SCHEMA-2 | всё сразу: таблицы нет; первая таблица `domain_event_outbox` тянет TransactionManager раньше модуля |
| Имя схемы | `app`, одно везде | `public`: зависит от непроверенного ACL, нельзя пересоздать в `bf_test`; `bf`: `bf.bf` на кластере |
| Кто применяет | два файла: шаг 1 под `doadmin`, шаг 2 под `migrator` | один файл под `doadmin`: создание схемы от имени `migrator` требует членства, которого может не быть |
| Атрибуты ролей | проверка и отказ, без `ALTER ROLE` | `ALTER ROLE ... NOCREATEDB ...`: без admin option у `doadmin` не выполнится |
| Где файлы | `database/roles/` | `database/schema/`: `scripts/schema-pair.mjs` требовал бы двойника, которого у прав нет; `deploy/`: это не манифест кластера |
| Проверка | тест `scripts/db-roles.test.ts` на Postgres в Docker, шаг CI | только ревью: ошибку с `CONNECT` нашёл тест |

## Decision

1. **Схема приложения - `app`** во всех средах (кластер, `bf_dev`, `bf_test`), `DB_SCHEMA=app`. Имя совпадает с ролью `app`; Postgres различает схемы и роли.
2. **`database/roles/01-as-doadmin.sql`** (владелец, под `doadmin`, в базе `bf`): отказ, если ролей нет или у них есть SUPERUSER, CREATEROLE, CREATEDB, REPLICATION, BYPASSRLS; `REVOKE ALL ON DATABASE bf FROM PUBLIC`; `CONNECT` для `migrator`, `app` и самого `doadmin`; `CREATE` на `bf` для `migrator`; `REVOKE CREATE ON SCHEMA public FROM PUBLIC`.
3. **Владелец базы.** Если `doadmin` может действовать как `migrator`, `bf` передаётся `migrator` (ADR-053 п. 2), и `CONNECT` для `doadmin` выдаётся заново от имени `migrator`. Иначе `bf` остаётся за `doadmin`, а инвариант ADR-053 п. 3 (объекты создаёт и владеет ими `migrator`, `app` только пользуется) держит `CREATE` из п. 2. Это уточняет ADR-053 п. 2 для второго случая; ADR-053 остаётся Accepted и не правится.
4. **`database/roles/02-as-migrator.sql`** (владелец, под `migrator`, в базе `bf`): схема `app` с владельцем `migrator`, `USAGE` для `app`; права по умолчанию `migrator` в `app`: `SELECT, INSERT, UPDATE, DELETE` на таблицы и `USAGE, SELECT` на sequences для `app`; `search_path = app` для `migrator` в `bf`, так что миграции пишут имена без схемы. Приложение ставит `search_path` само из `DB_SCHEMA` (ADR-061).
5. Оба файла повторяемы и печатают итог (владелец базы, атрибуты ролей, ACL схем), который владелец пишет в `docs/runbooks/bfdb-postgres.md`. Агент их на живой БД не выполняет (AGENTS.md, красный флаг 1). `CONNECTION LIMIT` и роль Debezium сюда не входят (ADR-053 п. 7, 9).
6. **Отложено в SCHEMA-2** (ждёт первый модуль с таблицей): `database/schema/` и пара R24 (Drizzle `pgTable` как идиома стека, файл на модуль), ручные DDL и миграции без drizzle-kit, скрипт `scripts/apply-test-migrations.ts` (ADR-071 п. 5, `applyCommand` ADR-075, хост и роль из `DB_*`), первый пользователь `openSharedTestDatabase`. Локальная среда применяет эти же два файла в init SQL - строка LOCAL-3.

## Consequences

- Плюс: DBSEC-7 получает готовые файлы; права проверены на Postgres той же версии в модели DO, а не только ревью.
- Плюс: `app` не может создать ни таблицу, ни схему, ни временную таблицу, а базу `bf` не видит никто, кроме трёх ролей.
- Минус: если `doadmin` не может действовать как `migrator`, владельцем `bf` остаётся `doadmin` (отступление от буквы ADR-053 п. 2, записанное здесь).
- Минус: пара R24 и скрипт `bf_test` ещё не существуют; `scripts/schema-pair.mjs` пропускает, пока нет `database/schema/`.

## Confirmation

`pnpm db:roles:test` (шаг `ci`, нужен Docker): оба файла дважды; `migrator` создаёт таблицу без схемы, и она в `app`; `app` читает и пишет её с sequence без выдачи на таблицу; `app` не создаёт в `app` и `public`, не создаёт схему и временную таблицу; чужая роль не подключается к `bf`; при членстве `doadmin` в `migrator` база передаётся `migrator`, а `doadmin` сохраняет подключение; отказ при опасном атрибуте; второй файл отказывает не-`migrator`.

## Revisit when

- DBSEC-7 покажет, что `doadmin` может действовать как `migrator`, или что DigitalOcean создаёт роли с другими атрибутами: п. 2-3.
- Первый модуль с таблицей (SCHEMA-2): пара R24, скрипт `bf_test`, проверка «свёртка миграций равна `database/schema/`».
- CDC-3 заводит роль Debezium: её права на схему `app`.

## Related

ADR-013, ADR-033, ADR-036, ADR-053, ADR-061, ADR-063, ADR-071, ADR-075; SPEC.md R24; backlog SCHEMA-1 (в архиве), SCHEMA-2, DBSEC-7, LOCAL-3, DEPLOY-2.
