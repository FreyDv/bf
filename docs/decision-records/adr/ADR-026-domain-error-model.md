# ADR-026: Модель ошибок: Result для бизнес-ошибок, исключения для технических

> [NEEDS REVIEW] drafted by the adoption run on 2026-11-05 from the DDD reference README and the existing @bf/shared/ddd code. Backlog: REC-1.

|                |                                 |
| -------------- | ------------------------------- |
| **Status**     | Proposed                        |
| **Date**       | 2026-11-05                      |
| **Author**     | владелец                        |
| **Decided by** | ожидает подтверждения владельца |
| **Tags**       | architecture, error-model       |

## Context

Развилка стандарта «модель ошибок и результатов» требует одного контракта по всей поверхности. Эталон DDD разделяет ошибки на восстановимые (возвращаются как `Result`) и невосстановимые (бросаются) и запрещает HTTP-исключения в ядре (DDH-71..76). В `@bf/shared/ddd` уже есть `Result`, `DomainException` и фильтры.

## Options considered

- Только исключения - отклонено: ошибки невидимы в сигнатуре (DDH-73).
- Только `Result` - отклонено: технические ошибки продолжат работу в неверном состоянии (DDH-74).
- Смешанная модель по критерию восстановимости - предлагается.

## Decision

Бизнес-отказ use case - `Result<T, E>` с `DomainException` с устойчивым кодом (`ORDER.ALREADY_PAID`); технический отказ - исключение. Роутер tRPC переводит `err` в `TRPCError` (`NOT_FOUND`, `CONFLICT`, `UNPROCESSABLE_CONTENT`, `FORBIDDEN`), неизвестные ошибки пробрасывает. Ниже роутера нет ни `HttpException`, ни `TRPCError`.

## Consequences

- Плюс: ошибки видны в типе.
- Минус: шаблонный код сопоставления.

## Confirmation

Ревью по `bf-mapping.md` §10 п.4; позже - правило ESLint на запрет импорта `@nestjs/common` HTTP-исключений в `domain/` (уже блокирует `pnpm deps`).

## Revisit when

Появляется потребитель, которому нужен иной контракт ошибок (например публичный API другого стиля), либо накладные расходы `Result` превышают пользу на простых use case.

## Related

ADR-025, ADR-017.
