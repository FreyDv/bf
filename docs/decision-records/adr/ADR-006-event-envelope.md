# ADR-006: Конверт события в zod; топик = <context>.<aggregate>.<event>; DLQ = <topic>.dlq

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | Accepted                                                                               |
| **Date**       | 2026-11-05 (оформлено при внедрении стандарта; решение принято ранее, см. docs/ADR.md) |
| **Author**     | владелец                                                                               |
| **Decided by** | владелец                                                                               |
| **Tags**       | events, contracts                                                                      |

## Context

Контракт между сервисами должен быть независим от клиента брокера.

## Options considered

В исходной таблице альтернативы не записаны.

## Decision

Конверт события валидируется zod (`eventEnvelopeSchema`); имя типа события `<context>.<aggregate>.<event>` служит и именем топика; мёртвая очередь - `<topic>.dlq`.

## Consequences

- Плюс: один парсинг у потребителя, брокер подменяем.

## Confirmation

`packages/events/src/envelope.ts`; `createDomainEvent` проверяет шаблон типа.

## Revisit when

Меняется формат конверта (версия `version` в событии это обрабатывает без отмены решения).

## Related

ADR-005.
