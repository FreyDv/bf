# Runbook: bfdb (DO Managed Postgres)

Serves: владелец-оператор и агент, действующий за него. Снимок состояния на 2026-11-11 - чтобы кластер можно было
сверить и восстановить (ADR-017, backlog RUNBOOK-1).

Источники: `doctl databases get | configuration get | user list | db list | pool list | firewalls list | replica list |
backups` (только чтение) и SELECT-запросы к `pg_catalog` через подключение WebStorm (под `doadmin`, без записи).

## Снимок

| Что | Значение |
|---|---|
| Кластер | `bfdb`, id `f74f65e6-0691-4550-bdad-a9fa5e108bc1`, создан 2026-11-06 |
| Тариф | `db-s-2vcpu-4gb`, диск 61440 MiB, 1 узел, регион `tor1` |
| Версия | PostgreSQL 18.6, x86_64, `server_encoding=UTF8`, `TimeZone=UTC`, `en_US.UTF-8`, провайдер локали libc, контрольные суммы данных включены |
| Подключение | порт 25060 (прямое, без пула), SSL включён, `listen_addresses=*`; приватный хост `private-bfdb-...`, VPC `default-tor1` (10.118.0.0/20) |
| Базы | `bf` (приложение, владелец `migrator`, с 2026-11-17) и `defaultdb` (владелец `doadmin`, 8,5 МБ, приложением не используется); служебная `_dodb` |
| Таблицы пользователя | 0: схема приложения ещё не применялась |
| Расширения | установлены `plpgsql`, `aiven_extras 1.1.22` (схема `aiven_extras`, владелец `postgres`); доступны ещё 73 (`pgcrypto`, `pg_trgm`, `uuid-ossp`, `vector`, `pg_stat_statements`, `pg_cron`, `postgis`, `timescaledb` и др.) |
| Пулы, реплики | нет |
| Доверенные источники | `k8s` (кластер `malinina`) и один `ip_addr` (адрес владельца); задаются командой `doctl databases firewalls replace`, правило адреса обновляет скрипт ниже |
| Бэкапы | ежедневно в 18:01 UTC (`backup_hour=18`), на 2026-11-10 - 6 копий; срок хранения и PITR не проверены |
| Окно обслуживания | суббота 08:49:31 UTC, `pending=true` (есть ожидающее обслуживание, содержимое неизвестно) |
| Аптайм | с 2026-11-06 |

### Роли

| Роль | Суперпользователь | Прочее |
|---|---|---|
| `doadmin` (мы) | нет | LOGIN, CREATEROLE, CREATEDB, REPLICATION, BYPASSRLS; член `doadmin_group` -> `_doadmin_managed` -> `_doadmin_auditing`, `pg_create_subscription`, `pg_read_all_stats`, `pg_signal_autovacuum_worker`, `pg_signal_backend`, `pg_stat_scan_tables` |
| `migrator` | нет | только LOGIN; владелец базы `bf` и схемы `app`, выполняет миграции (ADR-053, ADR-078) |
| `app` | нет | только LOGIN; CONNECT на `bf`, USAGE на схему `app`, DML на её таблицы и sequences через права по умолчанию `migrator` |
| `postgres`, `_dodb` | да | управляющие роли DO |
| `_dodb_repl`, `_dodb_rewind`, `_doadmin_monitor` | нет | репликация, перемотка, мониторинг DO |

### Параметры сервера (источник - файл конфигурации DO)

| Группа | Параметры |
|---|---|
| Репликация и WAL | `wal_level=logical`, `max_replication_slots=20`, `max_wal_senders=20`, `max_slot_wal_keep_size=-1` (без предела), `wal_keep_size=2920MB`, `max_wal_size=2921MB`, `checkpoint_timeout=900s`, `wal_sender_timeout=60000ms`, `wal_compression=off`, `archive_mode=off` |
| Надёжность записи | `synchronous_commit=off`, `fsync=on`, `full_page_writes=on`, `wal_writer_delay=200ms` (окно потери при `off` - до 600 мс) |
| Память | `shared_buffers=780MB`, `effective_cache_size=2341MB`, `work_mem=4MB`, `maintenance_work_mem=266MB` |
| Диск и планировщик | `random_page_cost=1`, `effective_io_concurrency=13`, `io_method=worker`, `jit=on` |
| Соединения и таймауты | `max_connections=100`, `superuser_reserved_connections=3`, `statement_timeout=0`, `lock_timeout=0`, `idle_in_transaction_session_timeout=24h` |
| Журнал | `log_min_duration_statement=1000ms`, `password_encryption=scram-sha-256` |
| Пулер (параметры кластера) | `pgbouncer` не используется; `timescaledb`, `stat_monitor_enable=false` |

Служебный слот `pghoard_local` (physical, активен) - бэкапы DO; слотов и публикаций Debezium ещё нет.

## Что видно и требует решения

| # | Находка | Почему важно | Куда |
|---|---|---|---|
| 1 | Доверенные источники были пусты (доступ с любого адреса); исправлено 2026-11-11: остались кластер `malinina` (`k8s`) и адрес владельца (`ip_addr`) | пароль и SSL больше не единственная защита; домашний адрес динамический, при его смене доступ с ноутбука пропадает, пока правило не обновлено (скрипт ниже) | DBSEC-1 закрыт |
| 2 | `synchronous_commit=off` | после сбоя узла последние подтверждённые транзакции (порядка сотен миллисекунд) могут пропасть: команда ответила «успех», а строки с outbox нет (ADR-025). Целостность агрегата и outbox сохраняется: они в одной транзакции | решено: ADR-044 (критичные команды включают `on` через `SET LOCAL`); на DO работает, раздел «Проверка `SET LOCAL synchronous_commit`» |
| 3 | `max_slot_wal_keep_size=-1` при диске 60 ГБ | остановленный Debezium копит WAL без предела до заполнения диска (ADR-021) | CDC-3 |
| 4 | Один узел, без реплики | сбой или обслуживание узла - простой; слот Debezium при пересоздании узла может потеряться (ADR-021: поведение при failover отложено) | ADR-021 |
| 5 | `aiven_extras` установлено | это способ DO давать не-суперпользователю операции с публикациями и подписками; локально расширения нет, поэтому SQL, который его вызывает, локально не заработает | CDC-1 |
| 6 | Ожидающее обслуживание (`pending=true`) | в окно субботы возможен рестарт узла | проверка владельца (RUNBOOK-2), «Не проверено» |
| 7 | В кластере база `defaultdb`, локально `bf_dev` | имя базы в строке подключения расходится; на поведение не влияет | ADR-033; приложение будет в отдельной базе `bf`, `defaultdb` не используется (ADR-053) |
| 8 | Приложение и миграции возможны только под `doadmin` (CREATEROLE, REPLICATION, BYPASSRLS) | утечка секрета приложения давала бы роли, репликацию и обход RLS | решено: ADR-053 (`migrator`, `app`, SSL `verify-full`); роли и база созданы 2026-11-17 (раздел «Роли и база `bf`»); подключение backend - DEPLOY-2 |

## Проверка `SET LOCAL synchronous_commit` (2026-11-17)

Выполнил владелец под `doadmin` в базе `defaultdb` (WebStorm), PostgreSQL 18.6; одна транзакция с `ROLLBACK`, без записи (ADR-044 п. 6, backlog DBSEC-5).

| Шаг | Результат |
|---|---|
| `BEGIN; SHOW synchronous_commit;` | `off` - значение кластера |
| `SET LOCAL synchronous_commit = on; SHOW synchronous_commit;` | `on` - `doadmin` может включить режим на свою транзакцию |
| `ROLLBACK; SHOW synchronous_commit;` | `off` - на соединение не просочилось |
| `SHOW wal_writer_delay;` | `200ms` - значение по умолчанию, окно потери при `off` до 3 x 200 мс |

Вывод: ADR-044 п. 2 работает на DO как записано; новая запись не нужна. Повторить, если DO сменит версию или параметры кластера.

## Проверки ролей и SSL (2026-11-17)

Выполнил владелец под `doadmin` в `defaultdb` и через `doctl`, только чтение (ADR-053 п. 5 и 6, backlog DBSEC-7).

| Проверка | Результат | Вывод |
|---|---|---|
| `SHOW ssl` | `on` | |
| `SHOW ssl_min_protocol_version` | `permission denied`: нужна роль `pg_read_all_settings`, у `doadmin` её нет | значение сервера неизвестно |
| `doctl databases configuration get ... --engine pg`, параметры SSL | нет ни одного | DO не даёт менять версию TLS: ADR-053 п. 6, ветка «принятый риск» - клиент требует не ниже TLSv1.2 (минимум Node по умолчанию), сервер при настройке DO, доступ ограничен доверенными источниками |
| `pg_stat_ssl` текущего подключения | `TLSv1.3`, `TLS_AES_256_GCM_SHA384` | |
| ACL схемы `public` | владелец `pg_database_owner`, `{pg_database_owner=UC/pg_database_owner,=U/pg_database_owner}` | у PUBLIC только USAGE (умолчание PostgreSQL 15+) |
| `has_schema_privilege('public', 'public', 'CREATE')` | `false` | `REVOKE CREATE ON SCHEMA public FROM PUBLIC` в `database/roles/01-as-doadmin.sql` ничего не меняет, но остаётся на случай другой базы |
| `pg_default_acl` | 0 строк | |
| Роли (`pg_roles`, без `pg_*`) | `postgres`, `doadmin`, `doadmin_group`, `_doadmin_managed`, `_doadmin_auditing`, `_doadmin_monitor`, `_dodb`, `_dodb_repl`, `_dodb_rewind`; `migrator` и `app` нет | как в снимке выше |
| Базы (`pg_database`) | `defaultdb` (владелец `doadmin`, ACL `{=Tc/doadmin,doadmin=CTc/doadmin,_doadmin_monitor=Tc/doadmin}`), `_dodb`, `template0`, `template1` | у PUBLIC `CONNECT` и `TEMP` - умолчание новой базы; для `bf` их снимает `01-as-doadmin.sql` |
| `doctl databases user list` | только `doadmin` (`primary`) | |
| Сертификат сервера (`openssl s_client -starttls postgres` на публичный хост) | субъект `CN=bfdb-1`, издатель `<uuid> Project CA` (CA проекта DO), действует до 2029-02-03; в SAN есть `private-bfdb-do-user-48015624-0.i.db.ondigitalocean.com`, публичный хост, `*.i.db.ondigitalocean.com` и `10.118.0.6` | приватный хост покрыт: production подключается с `DB_SSL_MODE=verify-full` (ADR-053 п. 5), CA - `doctl databases get-ca` (DEPLOY-2) |

## Роли и база `bf` (2026-11-17)

Выполнил владелец скриптом с ноутбука (ADR-053 п. 4, ADR-078): `doctl databases db create <id> bf`, `doctl databases user create <id> migrator` и `... app` (пароль из ответа API сразу в файл, на экран не выводился), затем `psql` по публичному хосту с `sslmode=require`: `database/roles/01-as-doadmin.sql` под `doadmin`, `database/roles/02-as-migrator.sql` под `migrator`, оба с `ON_ERROR_STOP`.

| Что | Результат |
|---|---|
| `01-as-doadmin.sql` | `NOTICE: bf is now owned by migrator` (у `doadmin` есть право действовать за `migrator`, ветка смены владельца ADR-078) |
| База `bf` | владелец `migrator`, ACL `{migrator=CTc/migrator,app=c/migrator,doadmin=c/migrator}`: у PUBLIC ничего, `app` и `doadmin` только CONNECT |
| `migrator`, `app` | LOGIN; `rolsuper`, `rolcreaterole`, `rolcreatedb`, `rolreplication`, `rolbypassrls` - все `f` |
| `02-as-migrator.sql` | схема `app`, владелец `migrator`, ACL `{migrator=UC/migrator,app=U/migrator}`; `public` без изменений |
| Права по умолчанию `migrator` в `app` | таблицы `{app=arwd/migrator}` (SELECT, INSERT, UPDATE, DELETE), sequences `{app=rU/migrator}` (SELECT, USAGE) |
| `search_path` | `ALTER ROLE migrator IN DATABASE bf SET search_path = app` |
| `doctl databases user list` сразу после создания | `app`, `doadmin`; `migrator` в ответе не было, хотя роль в `pg_roles` есть - перепроверить (см. «Не проверено») |

Пароли лежат только на ноутбуке владельца, в `apps/backend/.env.migrator.production` (`migrator`) и `apps/backend/.env.production` (`app`), права файла 600, оба файла в `.gitignore`; в каждом семь полей `DB_*` (ADR-061): приватный хост, порт 25060, `bf`, схема `app`, `verify-full`. Запечатываются в DEPLOY-2 вместе с CA и Job миграции: до этого backend выкатывается без базы. Если файл потерян - новый пароль `doctl databases user reset <id> <роль>`, файл пишется заново. `CONNECTION LIMIT` ролей не задан, решается в DEPLOY-2 (ADR-053 п. 9).

## Паритет с локальной средой

`compose.yaml` и `deploy/local/postgres/init/` повторяют: версию 18.6, UTF8 и `en_US.UTF-8`, `wal_level`, слоты, WAL, `synchronous_commit`, память, планировщик, таймауты и роль `doadmin` с её членством. Сверено запросами к `pg_settings` и `pg_roles` на чистом томе 2026-11-11.
Роли `migrator` и `app` и схема `app` локально те же (ADR-079): init создаёт роли с одним LOGIN, как DO, и применяет к `bf_dev` и `bf_test` те же `database/roles/01-as-doadmin.sql` (под `doadmin`) и `02-as-migrator.sql` (под `migrator`), что владелец применяет к `bf`; база остаётся за `doadmin`, у `migrator` `CREATE` на ней. Тесты (`pnpm test:e2e`) идут под `migrator` в схеме `app`, `pnpm migrations:check` строит ту же модель в контейнере и применяет миграции под `migrator`.
Не повторяется: `aiven_extras` (Aiven-специфично), служебные роли DO (`_dodb*`, `_doadmin_monitor`), `pghoard`, SSL, один узел против лимитов CPU и памяти тарифа.

## Не проверено

- Видит ли DO API роль `migrator`: `doctl databases user list f74f65e6-0691-4550-bdad-a9fa5e108bc1` сразу после создания вернул только `app` и `doadmin`. Без записи в API сброс пароля `migrator` через `doctl databases user reset` может не работать.
- Поведение Debezium и слота при потерянной `off`-транзакции: мог ли консьюмер увидеть событие без состояния (ADR-044 п. 6). Debezium на `bfdb` ещё нет; проверка вместе с CDC-3.
- `shared_preload_libraries` (параметр не вернулся запросом).
- Нижняя версия TLS на сервере (`ssl_min_protocol_version`): `doadmin` не может прочитать параметр, DO его не показывает (раздел «Проверки ролей и SSL»).
- Срок хранения бэкапов и возможность PITR.
- Что содержит ожидающее обслуживание. Проверка владельца (RUNBOOK-2), только чтение: `doctl databases maintenance-window get f74f65e6-0691-4550-bdad-a9fa5e108bc1` (флаги и поля сверить с `--help`); результат записать сюда и решить, переносить ли окно.
- Лимит подключений тарифа и поведение при превышении.

## Доступ с ноутбука

`scripts/db-allow-me.sh` определяет текущий публичный адрес (`api.ipify.org`), сверяет его с правилами `doctl databases firewalls list` и, если адреса нет, выполняет `doctl databases firewalls replace` с двумя правилами: кластер и этот адрес. Остальные правила затираются. Идентификаторы берутся из переменных `BF_DB_ID` и `BF_K8S_ID` (в репозитории их нет).

- Запуск: `BF_DB_ID=<id базы> BF_K8S_ID=<id кластера> sh scripts/db-allow-me.sh [--dry-run] [--force]`; без `--force` не чаще раза в 10 минут.
- Автозапуск: строка в `~/.zshrc` вызывает скрипт в фоне при старте терминала (вне репозитория, настраивается на машине владельца).
- Журнал: `~/.cache/bf/db-allow-me.log` (пишет изменения и ошибки).
- Ограничение: адрес разрешается с любой сети, из которой открыт терминал.

## Diagnose

- Состояние кластера: `doctl databases get f74f65e6-0691-4550-bdad-a9fa5e108bc1`.
- Параметры: `doctl databases configuration get f74f65e6-0691-4550-bdad-a9fa5e108bc1 --engine pg`.
- Слоты и размер удерживаемого WAL: `select slot_name, active, wal_status, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) from pg_replication_slots` под `doadmin`.
- Три вероятные причины недоступности, по убыванию: обслуживание или рестарт узла; закончились подключения (`max_connections=100`); диск заполнен WAL от остановленного слота.

## Rollback

Откат схемы - новая миграция (ADR-013). Откат данных - восстановление из бэкапа DO; срок хранения и PITR не проверены, до проверки на них полагаться нельзя. Потеря кластера `malinina` базу не затрагивает: нужно перенацелить правило `k8s` на новый кластер, порядок - [recovery.md](recovery.md).
