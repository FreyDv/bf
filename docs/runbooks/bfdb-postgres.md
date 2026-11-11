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
| Базы | только `defaultdb` (владелец `doadmin`, 8,5 МБ); служебная `_dodb` |
| Таблицы пользователя | 0: схема приложения ещё не применялась |
| Расширения | установлены `plpgsql`, `aiven_extras 1.1.22` (схема `aiven_extras`, владелец `postgres`); доступны ещё 73 (`pgcrypto`, `pg_trgm`, `uuid-ossp`, `vector`, `pg_stat_statements`, `pg_cron`, `postgis`, `timescaledb` и др.) |
| Пулы, реплики | нет; пользователей через API - только `doadmin` |
| Доверенные источники | `k8s` (кластер `malinina`) и один `ip_addr` (адрес владельца); задаются командой `doctl databases firewalls replace`, правило адреса обновляет скрипт ниже |
| Бэкапы | ежедневно в 18:01 UTC (`backup_hour=18`), на 2026-11-10 - 6 копий; срок хранения и PITR не проверены |
| Окно обслуживания | суббота 08:49:31 UTC, `pending=true` (есть ожидающее обслуживание, содержимое неизвестно) |
| Аптайм | с 2026-11-06 |

### Роли

| Роль | Суперпользователь | Прочее |
|---|---|---|
| `doadmin` (мы) | нет | LOGIN, CREATEROLE, CREATEDB, REPLICATION, BYPASSRLS; член `doadmin_group` -> `_doadmin_managed` -> `_doadmin_auditing`, `pg_create_subscription`, `pg_read_all_stats`, `pg_signal_autovacuum_worker`, `pg_signal_backend`, `pg_stat_scan_tables` |
| `postgres`, `_dodb` | да | управляющие роли DO |
| `_dodb_repl`, `_dodb_rewind`, `_doadmin_monitor` | нет | репликация, перемотка, мониторинг DO |

### Параметры сервера (источник - файл конфигурации DO)

| Группа | Параметры |
|---|---|
| Репликация и WAL | `wal_level=logical`, `max_replication_slots=20`, `max_wal_senders=20`, `max_slot_wal_keep_size=-1` (без предела), `wal_keep_size=2920MB`, `max_wal_size=2921MB`, `checkpoint_timeout=900s`, `wal_sender_timeout=60000ms`, `wal_compression=off`, `archive_mode=off` |
| Надёжность записи | `synchronous_commit=off`, `fsync=on`, `full_page_writes=on` |
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
| 2 | `synchronous_commit=off` | после сбоя узла последние подтверждённые транзакции (порядка сотен миллисекунд) могут пропасть: команда ответила «успех», а строки с outbox нет (ADR-025). Целостность агрегата и outbox сохраняется: они в одной транзакции | backlog DBSEC-2 |
| 3 | `max_slot_wal_keep_size=-1` при диске 60 ГБ | остановленный Debezium копит WAL без предела до заполнения диска (ADR-021) | CDC-3 |
| 4 | Один узел, без реплики | сбой или обслуживание узла - простой; слот Debezium при пересоздании узла может потеряться (ADR-021: поведение при failover отложено) | ADR-021 |
| 5 | `aiven_extras` установлено | это способ DO давать не-суперпользователю операции с публикациями и подписками; локально расширения нет, поэтому SQL, который его вызывает, локально не заработает | CDC-1 |
| 6 | Ожидающее обслуживание (`pending=true`) | в окно субботы возможен рестарт узла | RUNBOOK-1 |
| 7 | В кластере база `defaultdb`, локально `bf_dev` | имя базы в строке подключения расходится; на поведение не влияет | ADR-033 |

## Паритет с локальной средой

`compose.yaml` и `deploy/local/postgres/init/` повторяют: версию 18.6, UTF8 и `en_US.UTF-8`, `wal_level`, слоты, WAL, `synchronous_commit`, память, планировщик, таймауты и роль `doadmin` с её членством. Сверено запросами к `pg_settings` и `pg_roles` на чистом томе 2026-11-11.
Не повторяется: `aiven_extras` (Aiven-специфично), служебные роли DO (`_dodb*`, `_doadmin_monitor`), `pghoard`, SSL, один узел против лимитов CPU и памяти тарифа.

## Не проверено

- `shared_preload_libraries` (параметр не вернулся запросом), `ssl_min_protocol_version`, права по умолчанию на схему `public`.
- Срок хранения бэкапов и возможность PITR.
- Что содержит ожидающее обслуживание.
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

Откат схемы - новая миграция (ADR-013). Откат данных - восстановление из бэкапа DO; срок хранения и PITR не проверены, до проверки на них полагаться нельзя.
