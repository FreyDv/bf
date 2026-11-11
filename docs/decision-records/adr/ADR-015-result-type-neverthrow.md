# ADR-015: Тип результата для бизнес-ошибок: neverthrow

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-06 |
| **Author** | владелец |
| **Decided by** | владелец |
| **Tags** | stack, architecture, errors |

## Context

- ERR-2 требует типа результата для бизнес-ошибок; ERR-3 - бросать технические.
- ADR-002 оставил реализацию стековому ADR.

## Options considered

| Вариант | Плюсы | Минусы | Итог |
|---|---|---|---|
| neverthrow | готовый `Result` | внешняя зависимость | выбран владельцем |
| Свой `Result` в shared kernel | без зависимости | код пишем и тестируем сами | отклонён |

## Decision

1. Бизнес-результат - `Result` из neverthrow (ERR-2).
2. Технические ошибки бросаются (ERR-3).
3. В domain тип появляется только в значениях, которые domain сам возвращает.

## Consequences

- Плюс: единый тип результата во всех use case.
- Минус: новая зависимость.

## Confirmation

Ревью `ddd-review` (AIP-6.5).

## Revisit when

neverthrow перестаёт поддерживаться.

## Related

ADR-002 (ERR-1..6), ADR-005.
