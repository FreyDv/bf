# ADR-025: Транзакция команды и outbox доменных событий: TransactionManager, DomainEventRecorder, subject в NATS

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-09 |
| **Author** | владелец |
| **Decided by** | владелец |
| **Tags** | architecture, transactions, events, outbox, nats |

## Context

- APP-11 требует одну транзакцию на flow из событий; DOM-IE1 - событие наружу пишется в той же транзакции и только после сохранения; ENF-5 - контекст запроса не в глобалах.
- ADR-021 решил транспорт (outbox-таблица и Debezium), но не решил, кто открывает транзакцию, кто копит события и как они называются в NATS (ADR-022 оставил subject открытыми).
- Результат бизнес-ошибки - `Result.err`, не exception (ADR-015): откат только по exception закоммитил бы частичные изменения.
- Владелец хочет, чтобы консьюмеры подписывались широко (все обновления) и узко (одно событие).

## Options considered

| Вопрос | Вариант | Итог |
|---|---|---|
| Кто создаёт `updated` | A. агрегат: `touch` из изменяющих методов | выбран владельцем |
| Кто создаёт `updated` | B. репозиторий: diff снимков до и после | отклонён: событие рождается в infrastructure (DOM-EV1) |
| Что уходит в NATS | domain event напрямую, версионируемым контрактом | выбран владельцем (отступление от DOM-IE1, см. Decision п.9) |
| Что уходит в NATS | интеграционное событие, которое строит domain event handler (DOM-IE1 как есть) | отклонён: второй набор типов (PRG-3, PRG-4) |
| Subject | иерархия `BF.<AGG>.<LIFECYCLE>.<EVENT>` | выбран владельцем: широкая и узкая подписка |
| Subject | плоский `BF.<AGG>.<EVENT>`, lifecycle в заголовке | отклонён: нет подписки на все обновления |

## Decision

**Порты и реализация.**
1. `TransactionManager` и `DomainEventRecorder` - порты в application; реализации на `AsyncLocalStorage` (Drizzle для транзакции) в infrastructure (APP-12, DEP-4). В shared kernel только контракты (ENF-4). Domain их не импортирует (DEP-3, DEP-6).
2. Контекст создаётся middleware шины на каждую команду; запрос (query) его не получает (APP-10). Команда внутри открытой транзакции - ошибка, не присоединение (APP-9).

**Транзакция.**
3. `TransactionManager.execute(fn)`: BEGIN; fn; цикл обработки in-process событий (APP-13) до пустого буфера; `DomainEventRecorder.storeToPersistence()`; COMMIT. Commit только на `ok`; `Result.err` и exception - ROLLBACK, буфер событий выбрасывается (ERR-2, ERR-3).

**События.**
4. Агрегат меняет поля только через защищённый `change(field, value)` базового `AggregateRoot` (присваивает и делает `touch`); публичных сеттеров нет (DOM-E3).
5. За транзакцию на агрегат - одно сообщение состояния: `created` (фабрика), `updated` (были `touch`), `deleted` (метод удаления). Payload: `aggregate_id`, `version`, `changed` (имена полей), `state` (whitelist-мап в примитивы, ADP-4, DOM-V4); `deleted` несёт последнее состояние.
6. Бизнес-событие агрегат записывает `record(event)`: прошедшее время, payload по смыслу, `aggregate_id`, `version` (DOM-EV1).
7. Репозиторий при `save` передаёт `pullEvents()` агрегата в Recorder (DOM-EV1: публикует после persist).

**Outbox и subject.**
8. Recorder пишет в `domain_event_outbox` в транзакции команды. Колонки: `seq` (bigserial), `event_id`, `aggregate_type`, `aggregate_id`, `subject`, `version`, `schema_version`, `payload` (jsonb), `occurred_at`, `correlation_id`, `causation_id`, `user_id`. Таблица входит в публикацию `FOR TABLE` (ADR-023). Debezium публикует в NATS в порядке `seq`.
9. Domain event уходит в NATS напрямую как версионируемый контракт (`schema_version`); интеграционный слой не вводится. **Отступление от DOM-IE1**, модуль - все; причина - Options.
10. Subject: `BF.<AGGREGATE>.<LIFECYCLE>.<EVENT>`, ровно четыре токена, верхний регистр.

| Токен | Значения |
|---|---|
| `AGGREGATE` | имя агрегата в единственном числе (`ORDER`, `ORDER_ITEM`) |
| `LIFECYCLE` | `CREATED`, `UPDATED`, `DELETED` - что случилось со строкой в транзакции |
| `EVENT` | `STATE` (зарезервировано: сообщение состояния) или имя бизнес-события (`PLACED`, `ADDRESS_CHANGED`) |

Токены без `.`, пробелов, `*`, `>`; составные имена через `_`. Бизнес-событие нового агрегата - `CREATED.<EVENT>`, удалённого - `DELETED.<EVENT>`, иначе `UPDATED.<EVENT>`. `STATE` как имя бизнес-события запрещено; формат проверяет `record` при записи.

| Подписка | Получает |
|---|---|
| `BF.ORDER.UPDATED.*` | все обновления: состояние и бизнес-события |
| `BF.ORDER.UPDATED.STATE` | только состояние |
| `BF.ORDER.UPDATED.ADDRESS_CHANGED` | одно событие |
| `BF.ORDER.*.PLACED` | `PLACED` при создании и при обновлении |

11. Консьюмер идемпотентен по `event_id`; устаревшее отбрасывает по `version` агрегата. Доставка at-least-once.

## Consequences

- Плюс: один механизм на любую команду, handler остаётся оркестрацией; откат гарантирован для бизнес-ошибки; события не теряются и не опережают коммит.
- Плюс: широкая и узкая подписка одним деревом subject.
- Минус: `touch` вне `change` не защищён языком - ловится ревью `ddd-review` и тестом на `changed`.
- Минус: состояние агрегата становится публичным контрактом; переименование поля - новая `schema_version`.
- Минус: отступление от DOM-IE1; бизнес-событие и сообщение состояния - два сообщения на одно изменение.
- Минус: длинный flow из событий держит транзакцию (APP-11): при contention переходить на eventual через очередь.
- Дальше: формат `schema_version`, имя стрима и ключ порядка по `aggregate_id` (ADR-022), мониторинг размера outbox - в спеке первой возможности; идемпотентность консьюмеров - backlog.

## Confirmation

Ревью `ddd-review` (AIP-6.3-6.5). Тесты: откат на `Result.err` и на exception не оставляет строк в outbox; `change` попадает в `changed`; формат subject отклоняет `STATE` и недопустимые символы. Правило dependency-cruiser: порты не импортируют Drizzle и `node:async_hooks` вне infrastructure (ADR-014). Пока кода нет - только ревью.

## Revisit when

- Второй потребитель требует стабильный контракт, не равный форме агрегата: вводим интеграционный слой и supersede п.9.
- Транзакция flow из событий превышает допустимое время под нагрузкой.
- `AsyncLocalStorage` перестаёт переносить контекст через границы, которые мы используем (воркеры, шина).

## Related

ADR-002 (DOM-EV1, DOM-IE1, APP-9, APP-11, ENF-5, INF-4), ADR-008, ADR-013, ADR-015, ADR-021, ADR-022, ADR-023.
