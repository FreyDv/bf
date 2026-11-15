# ADR-061: Подключение к БД: семь полей `DB_*` вместо `DATABASE_URL`, `@bf/db-utils`, два секрета и CA в чарте `app`

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-14 |
| **Author** | агент |
| **Decided by** | владелец, в чате 2026-11-14 (развилки CHART-5) |
| **Tags** | datastore, secrets, deploy, ssl |

## Context

- ADR-053 п. 4 и 5: два SealedSecret (`migrator` для миграционного Job, `app` для Deployment), CA DO в ConfigMap чарта, `doadmin` в кластере нет. ADR-060 п. 4 записывает второй секрет в `extraSecrets.<name>.encryptedData`, а привязку к процессам и отрисовку оставляет CHART-5.
- Чарт `app` до этой записи: один секрет `<release>-secrets` и общий хелпер `app.envFrom` для Deployment, CronJob и Job (`deploy/charts/app/templates/_helpers.tpl`); контрольная сумма пода хешировала весь шаблон SealedSecret (`deployment.yaml`).
- Строка подключения `DATABASE_URL` одним значением (ADR-036 п. 4, ADR-051 п. 6): пароль внутри URL нужно кодировать, схему и CA в URL не передать, а запечатанное целое значение не показывает, чего в нём не хватает.
- Владелец: `DATABASE_URL` «никогда не используй».
- Кода работы с БД в приложении ещё нет; единственный потребитель - e2e пакета `@bf/query-filter` (`pg`).

## Options considered

| Развилка | Выбрано | Отклонено |
|---|---|---|
| Поля БД | семь переменных: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_SCHEMA`, `DB_SSL_MODE`, `DB_USER`, `DB_PASSWORD`, все семь в каждом секрете роли | `DATABASE_URL` (запрещено владельцем); часть полей в `env`, пароль в секрете (чарт не мог бы проверить, что секрет полон: ключи видны, значения нет) |
| Сборка URL и проверка | внутренний пакет `@bf/db-utils` без зависимостей: `readDbConfig`, `buildConnectionUrl` | код в каждом приложении (расхождение); пакет в shared kernel (kernel без библиотек и чтения окружения, ENF-4, ADR-049) |
| Секрет `migrator` в чарте | фиксированное имя `extraSecrets.migrator`, Job читает только его | поле `migration.secretName` (лишнее имя, которое можно ошибиться); общий секрет с `app` (ADR-053 п. 4 это запрещает) |
| CA | PEM в `dbCa.pem` значений приложения, ConfigMap, файл `/etc/bf/db-ca/ca.crt` | CA в `env` (многострочное значение, нельзя читать драйверу как файл); отдельный ConfigMap вне чарта (мимо волн ADR-047) |
| Перезапуск при смене секрета | контрольная сумма только того, что получает Deployment | хеш всего шаблона SealedSecret (смена `migrator` перезапускала бы поды, которые его не читают) |

## Decision

1. **`extraSecrets`.** Чарт рисует каждую запись `extraSecrets.<name>.encryptedData` (форма, которую пишет `scripts/seal-secret.ts`, ADR-060 п. 4) как SealedSecret `<fullname>-<name>-secrets`, волна `-1`, строгая область, как главный. Запись без `encryptedData` не рисуется.
2. **Кто что читает.** Deployment и CronJob: главный секрет `<fullname>-secrets`, `env` и `envFromSecrets`. Миграционный Job: только `<fullname>-migrator-secrets` и `env`; ни главный секрет, ни `envFromSecrets`. Имя `migrator` зафиксировано соглашением (как `.env.migrator.production`), поля для него в values нет. Остальные `extraSecrets` рисуются, но не подключены ни к чему, пока их имя не названо в `envFromSecrets`. Общий хелпер `app.envFrom` разделён на `app.envFrom` (Deployment, CronJob) и `app.migrationEnvFrom` (Job).
3. **Поля БД.** `DATABASE_URL` запрещён везде. Каждый секрет роли (`.env.production` и `.env.migrator.production`, то есть `secret.encryptedData` и `extraSecrets.migrator.encryptedData`) несёт все семь полей; `DB_SSL_CA_FILE` необязателен и ставится чартом, не секретом. Фикстуры чарта и e2e переведены на эти поля. Локально и в CI роль и база те же, что были (`doadmin`, `bf_test`); две роли там - LOCAL-3.
4. **`@bf/db-utils`.** `packages/db-utils`, без зависимостей выполнения. `readDbConfig(env)` читает и проверяет семь переменных и необязательный `DB_SSL_CA_FILE`: `DB_PORT` - целое 1-65535, `DB_SSL_MODE` - режим libpq (`disable`, `allow`, `prefer`, `require`, `verify-ca`, `verify-full`); все отсутствующие и неверные имена - в одной ошибке, значений в ней нет. `DB_SCHEMA` должна быть простым идентификатором (`^[A-Za-z_][A-Za-z0-9_]*$`), иначе пробел или запятая превратили бы параметр `options` в чужую настройку (проверка агента, не развилка владельца). `buildConnectionUrl(config)` строит URL `postgres://`: пользователь и пароль в percent-encoding (пароль с `@ / : #` работает), `sslmode`, `sslrootcert` при наличии CA, схема как `options=-c search_path=<схема>` (пробел как `%20`, не `+`: libpq `+` не читает). Домен и application его не импортируют: правило `db-utils-not-in-domain-or-application` в `.dependency-cruiser.mjs` (читает и имя пакета, и путь), фикстуры в `pnpm deps:test`.
5. **CA.** PEM-текст в значениях приложения `dbCa.pem`; при заданном `dbCa.pem` чарт рисует ConfigMap `<fullname>-db-ca` на волне `-1`, монтирует его только для чтения файлом `/etc/bf/db-ca/ca.crt` в Deployment, CronJob и Job (корневая ФС только для чтения, поэтому том) и ставит `DB_SSL_CA_FILE=/etc/bf/db-ca/ca.crt` во все три. Приложение без БД (frontend) ничего не задаёт и ConfigMap не получает. Сам CA кладётся в `deploy/apps/backend/values.yaml` в DEPLOY-1 (`doctl databases get-ca`, команду выполняет агент по решению владельца).
6. **Отказы.** Чарт не рисуется, с понятным сообщением без значений (только имена ключей), когда: `migration.enabled` без главного секрета, без `extraSecrets.migrator` или без `dbCa.pem`; секрет (главный или любой из `extraSecrets`) с хотя бы одним ключом `DB_*` без любого из семи (имена ключей в `encryptedData` видны без расшифровки), и тогда `dbCa.pem` тоже обязателен. С `migration.enabled` главный секрет и `extraSecrets.migrator` считаются секретами БД по определению: семь полей обязательны и там, где ни одного ключа `DB_*` нет (иначе Job стартовал бы без БД). Без миграции и без ключей `DB_*` (frontend) ничего не требуется. Тест проверяет, что строка `doadmin` не встречается ни в значениях чарта, ни в его фикстурах, ни в отрисованных манифестах (ADR-053 п. 1).
7. **Перезапуск.** Аннотации пода Deployment: `checksum/secret` - хеш `encryptedData` главного секрета, `checksum/db-ca` - хеш `dbCa.pem`. Смена `extraSecrets.migrator` или другого неподключённого секрета контрольные суммы Deployment не меняет. У CronJob и Job контрольной суммы нет.
8. **Что заменяет.** Только упоминания `DATABASE_URL` в ADR-036 п. 4 (`passThroughEnv`) и ADR-051 п. 6 (источник базы для `test:e2e`): теперь `DB_*`. Обе записи остаются Accepted и не правятся; читаются по этой ссылке. Охранный скрипт `.claude/hooks/no-remote-db-writes.sh` (вендорный) и дайджесты в `docs/standards/**` слово `DATABASE_URL` сохраняют.

## Consequences

- Positive: роль `migrator` не доходит до Deployment, роль `app` - до Job; нехватка поля или CA видна при `helm template`, а не при старте пода; пароль с любым символом не ломает URL; смена пароля `migrator` не перезапускает рабочие поды.
- Negative: семь ключей в каждом из двух секретов (14 запечатанных значений вместо двух); пока нет настоящего кода БД, формат URL проверен юнит-тестами и e2e `query-filter` под `pg`, но не живым сервером DO с `verify-full`.
- Negative: `buildConnectionUrl` кладёт CA в `sslrootcert`; как драйвер приложения прочитает `verify-full` с этим параметром, проверяет DBSEC-8 вместе с первым подключением.
- Negative: если CA кластера DO сменится, `dbCa.pem` правится вручную (ConfigMap меняется, поды перезапускаются по `checksum/db-ca`).
- Follow-ups: DEPLOY-1 (CA в `deploy/apps/backend/values.yaml`, все семь полей в обоих `.env`), DBSEC-8 (страж читает `DB_SSL_MODE` и `DB_SSL_CA_FILE` через `@bf/db-utils`), DBSEC-7 (пароли в `DB_PASSWORD` двух файлов), LOCAL-3 (две роли локально и в CI).

## Confirmation

`pnpm charts:test`: кто какой секрет получает, волны `-1` для обоих SealedSecret и ConfigMap, Job на волне 0 хуком Sync, Deployment и CronJob на волне 1, каждый отказ, поведение контрольных сумм, отсутствие `doadmin` и `DATABASE_URL`, и связка: `scripts/seal-secret.ts` с подставным запечатывающим пишет `secrets.yaml` из двух `.env`, чарт его рисует с фикстурой. `pnpm charts` рисует обе фикстуры. `pnpm test` (юнит-тесты `@bf/db-utils`: кодирование, каждая ошибка проверки, режимы `sslmode`, параметр схемы). `pnpm deps` и `pnpm deps:test` (границы пакета). `kubectl apply --dry-run=server` отрисованных манифестов на непроизводственном кластере (ADR-059) проходит.

## Revisit when

- DBSEC-8 или первый реальный клиент БД покажет, что драйвер не читает `sslrootcert` из URL или иначе трактует `verify-full`: тогда URL собирается иначе, а поля и пакет остаются.
- Приложению понадобится третья роль (Debezium, CDC-3; чтение, MCP) или второй секрет другого назначения, которому нужен свой процесс: правило «только `migrator` подключён сам» пересматривается.
- Хранилище секретов заменит SealedSecrets (ADR-020): контракт `extraSecrets` пересматривается вместе с ним.

## Related

Заменяет упоминания `DATABASE_URL` в ADR-036 п. 4 и ADR-051 п. 6 (обе записи остаются Accepted, не правятся); исполняет ADR-053 пп. 4 и 5 и «Follow-ups» ADR-060; ADR-019, ADR-020, ADR-047, ADR-049; backlog CHART-5, DEPLOY-1, DBSEC-7, DBSEC-8, LOCAL-3.
