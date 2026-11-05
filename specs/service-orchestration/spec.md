# service-orchestration

<!-- Спека извлечена из кода `apps/api/src/orchestrator`; контракты процитированы дословно. Решение ADR-023 - источник причин. -->

**Spec tier:** buildable
**Serves:** `Владелец-оператор`
**Status:** in-refinement
**Success metric:** n/a - North Star не определён (backlog PRODUCT-1)

> [NEEDS REVIEW] drafted by the adoption run on 2026-11-05 from the code of apps/api/src/orchestrator. Backlog: SPEC-3.

## Purpose

Оркестратор внутри `api`: переводит сервисы Fargate в сон (0 задач) при простое и будит их по первому запросу, чтобы простой ничего не стоил (BDR-002, ADR-023). Состояние - число задач ECS и теги сервиса, без дополнительного хранилища.

## Scope

Пробуждение (`ensureAwake`), сон (`sleep`), проверка сна (`isAsleep`), периодическая очистка простоя (`sweep`), ручное управление администратором (`/_services`), граф зависимостей сервисов.

## Out of scope

Развёртывание и релизы - конвейер и `infra/aws`. Сам прокси - `edge-gateway`.

## Core concepts

- **Сервис спит** - `desiredCount = 0`; **бодрствует** - `desiredCount ≥ 1`.
- **Теги ECS-сервиса:** `bf:last-activity`, `bf:cooldown` (`orchestrator.ts:10`) - последняя активность и переопределение времени простоя.
- **Граф зависимостей** (`SERVICE_GRAPH`, `admin=auth|order,billing=order`): пробуждение сервиса будит то, что он вызывает; зависимые держат его бодрствующим.

## Data contracts

Хранилища нет. Состояние - `desiredCount`/`runningCount` ECS и два тега выше (`TAGS`, `orchestrator.ts:10`). Окружение - раздел Config.

## Interface contracts

Админ-контроллер `@Controller('_services')`, роль `admin` (`apps/api/src/orchestrator/services.controller.ts`; путь снаружи `/api/_services/*`):

| Метод и путь | Успех | Вход | Эффект |
|---|---|---|---|
| `GET _services` | `ServiceView[]` | - | список сервисов и состояния |
| `POST _services/:name/wake` | `202 { service, action: 'wake' }` | - | разбудить |
| `POST _services/:name/sleep` | `202 { service, action: 'sleep' }` | - | усыпить |
| `POST _services/:name/redeploy` | `202 { service, action: 'redeploy' }` | - | принудительный релиз |
| `POST _services/:name/cooldown` | `{ service, cooldownS }` | `{ seconds: int 0..604800 }` | задать время простоя |
| `POST _services/:name/bounds` | `{ service, bounds: { min, max } }` | `{ min: int 0..20, max: int 1..20 }` | границы числа задач |

Промежуточное ПО `WakeMiddleware` (`wake.middleware.ts`): если оркестратор включён и сервис известен: путь `/<svc>/health*` - сервис спит → `503 SERVICE_ASLEEP` + `Retry-After: 10`, иначе пропустить; прочие пути - `ensureAwake`; готов → пропустить; иначе `503 SERVICE_STARTING` + `Retry-After: 10`.

| Endpoint | Status | errorCode | Message / condition |
|---|---|---|---|
| `POST _services/:name/*` | 404 | `SERVICE_NOT_FOUND` | `unknown service <name>` |
| `POST _services/:name/bounds` | 404 | `INVALID_BOUNDS` | `min > max` (код статуса 404 - как в коде; [NEEDS DECISION: оставить 404 или 400 для INVALID_BOUNDS; owner: dev]) |
| `ANY /<svc>/*` | 503 | `SERVICE_ASLEEP` | health-проба спящего сервиса |
| `ANY /<svc>/*` | 503 | `SERVICE_STARTING` | `<svc> is starting up (waiting for <pending>)` |

## Algorithms & rules

1. **Бодрствование** (`ensureAwake`, `orchestrator.ts:215`): для сервиса и его зависимостей поднять `desiredCount`, ждать готовности до `WAKE_TIMEOUT_MS`; вернуть `{ ready, pending }`.
2. **Очистка** (`sweep`): раз в минуту (`SWEEP_INTERVAL_MS = 60 000` плюс случайный сдвиг до `SWEEP_JITTER_MS = 30 000`, `sweep.service.ts`) каждая задача `api` усыпляет сервисы без активности дольше времени простоя (тег `bf:cooldown`, иначе `SERVICE_COOLDOWNS[name]`, иначе `DEFAULT_COOLDOWN_S`), кроме `ALWAYS_ON` и сервисов, от которых зависят бодрствующие.
3. **Сбой пробуждения:** `desiredCount 1` без работающей задачи дольше `WAKE_FAIL_AFTER_MS` → обратно в сон и событие `wake_failed`.

## Requirements

- Проба `/health/live` MUST NOT касаться базы данных (Aurora обязана засыпать, ADR-023).
- Состояние MUST NOT храниться вне ECS (никакого DynamoDB; ADR-023, BDR-002).
- Клиент MUST получать `Retry-After` при `503` от оркестратора.
- Время простоя по умолчанию - `DEFAULT_COOLDOWN_S` (10 800 с = 3 ч); значение в продакшене: [NEEDS DECISION: время простоя по умолчанию и для каждого сервиса; owner: product].

## Invariants

- Спящий сервис не получает проксируемых запросов до ответа `ensureAwake`.
- `min ≤ max` для границ числа задач.

## Config & flags

| Flag | Effect |
|---|---|
| `ORCHESTRATOR` | `none` локально, `ecs` на Fargate |
| `ECS_CLUSTER`, `ECS_SERVICE_PREFIX` | кластер и префикс имён сервисов (`bf-prod-` + имя) |
| `SERVICE_GRAPH`, `ALWAYS_ON` | граф зависимостей и сервисы, которые не спят |
| `DEFAULT_COOLDOWN_S`, `SERVICE_COOLDOWNS`, `SERVICE_MAX_TASKS` | простой и максимум задач при бодрствовании (по умолчанию 4) |
| `WAKE_TIMEOUT_MS`, `WAKE_FAIL_AFTER_MS` | удержание запроса (50 000) и порог сбоя (180 000) |

## Edge cases

- Первый запрос к спящему сервису занимает 30-60 с (цена бюджета).
- Неудачное пробуждение: поведение для клиента после возврата в сон: [NEEDS DECISION: что видит клиент при `wake_failed` и как владелец узнаёт; owner: product].

## Trust boundaries

Админ-контроллер доступен только роли `admin` (`JwtAuthGuard`, `RolesGuard`); путь `_services` не может совпасть с именем upstream (имена начинаются с буквы), поэтому прокси его не видит. Орке́стратор действует по ролям задачи AWS: `ecs:UpdateService`, `application-autoscaling:RegisterScalableTarget`, `ecs:DescribeServices` - права проверяет `infra/aws`.

## Cross-capability interactions

### edge-gateway

Проверка личности и лимит идут до `WakeMiddleware` ([edge-gateway](../edge-gateway/spec.md)).

## Acceptance criteria

[NEEDS INPUT: критерии приёмки Given/When/Then для пробуждения, сна по простою, зависимостей, ответов 503 и ручного управления - формулирует владелец; owner: product]

## Open questions

None known.
