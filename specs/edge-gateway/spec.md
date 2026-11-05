# edge-gateway

<!-- Спека извлечена из кода `apps/api/src/proxy` и `apps/api/src/app/env.schema.ts`; контракты процитированы дословно. -->

**Spec tier:** buildable
**Serves:** `Владелец-оператор`
**Status:** in-refinement
**Success metric:** n/a - North Star не определён (backlog PRODUCT-1)

> [NEEDS REVIEW] drafted by the adoption run on 2026-11-05 from the code of apps/api. Backlog: SPEC-2.

## Purpose

Единственная точка входа браузера: `api` проверяет access-JWT, пересылает проверенную личность сервисам, проверяет роль маршрута, ограничивает частоту запросов и проксирует `/<svc>/*` в сервисы.

## Scope

Проверка bearer-токена (RS256, публичный ключ), вырезание клиентских заголовков личности, `ROUTE_ROLES`, публичные пути, лимит частоты на пользователя или IP, таблица маршрутов `UPSTREAMS`.

## Out of scope

Выпуск токенов - `identity`. Пробуждение спящих сервисов - `service-orchestration` (вызывается до прокси).

## Core concepts

- **Доверенные заголовки** - `X-User-Id`, `X-User-Roles`, `X-User-Email` (`packages/trpc/src/context.ts`, `IDENTITY_HEADERS`); сервисы им доверяют, потому что edge вырезает клиентские значения.
- **Публичный путь** - путь, проходящий без токена: `/<svc>/health*` всегда, плюс префиксы из `PUBLIC_PATHS`.

## Data contracts

Данных не хранит: состояние лимита - в памяти процесса (хранилище `ThrottlerModule` по умолчанию). Конфигурация - переменные окружения (`apps/api/src/app/env.schema.ts`, процитировано в разделе Config).

## Interface contracts

Прокси-маршрут: `ANY /<name>/*` → `<UPSTREAMS[name]>/*` (префикс срезается). Порядок цепочки: `EdgeAuthMiddleware` (`apps/api/src/proxy/edge-auth.middleware.ts:40`) → `EdgeRateLimitMiddleware` → `WakeMiddleware` (если оркестратор включён) → прокси.

Решение авторизации (`edge-auth.middleware.ts:40-80`): 1) удалить все заголовки `IDENTITY_HEADERS` из запроса; 2) извлечь bearer; 3) путь публичный (`OPTIONS`, `ALWAYS_PUBLIC` = `/^\/[a-z][a-z0-9-]*\/(health)(\/|$|\?)/`, префикс из `PUBLIC_PATHS`) и токена нет - пропустить; 4) токена нет - 401; 5) проверить JWT; при ошибке на публичном пути - пропустить, иначе 401; 6) `ROUTE_ROLES[service]` задан и роли токена его не содержат - 403; 7) записать `X-User-Id`, `X-User-Roles` (через запятую), `X-User-Email`.

Ограничение частоты (`edge-rate-limit.middleware.ts:28-37`): ключ `edge:u:<userId>` при наличии личности, иначе `edge:ip:<ip>`; `storage.increment(key, ttl, limit, ttl, 'edge')`; заголовки `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`; превышение - `ThrottlerException` (429).

| Endpoint | Status | errorCode | Message / condition |
|---|---|---|---|
| `ANY /<svc>/*` | 401 | `UNAUTHORIZED` | `Missing bearer token` - токена нет, путь не публичный |
| `ANY /<svc>/*` | 401 | `UNAUTHORIZED` | `Invalid or expired token` |
| `ANY /<svc>/*` | 403 | `FORBIDDEN` | `Route /<svc> requires role '<role>'` |
| `ANY /<svc>/*` | 429 | [NEEDS CLARIFICATION: код и тело ответа `ThrottlerException` при превышении; owner: dev] | лимит частоты превышен |
| `ANY /<svc>/*` | 503 | `SERVICE_STARTING` / `SERVICE_ASLEEP` | см. `service-orchestration` |

## Algorithms & rules

Алгоритм авторизации - в разделе Interface contracts. Блокировка лимита: `blockDuration = ttl`, то есть ключ остаётся заблокированным до конца окна (без этого счётчик сбрасывается сразу и ничего не блокируется - `edge-rate-limit.middleware.ts:31`).

## Requirements

- Edge MUST удалять клиентские `X-User-*` заголовки до любой проверки.
- Сервисы MUST NOT быть достижимы из интернета минуя edge (граница сети - `infra/aws`).
- Лимит - `EDGE_RATE_LIMIT` запросов за `EDGE_RATE_TTL_MS` (по умолчанию 600 за 60 000 мс); значение в проде: [NEEDS DECISION: лимиты частоты в проде и для анонимных клиентов; owner: product].

## Invariants

- Запрос, дошедший до сервиса, несёт `X-User-*` только от проверенного токена.
- Путь `/<svc>/health*` MUST оставаться публичным и MUST NOT будить сервис.

## Config & flags

| Flag | Effect |
|---|---|
| `UPSTREAMS` | таблица `name=url,...`; `name` - `^[a-z][a-z0-9-]*$` |
| `PUBLIC_PATHS` | префиксы путей без токена |
| `ROUTE_ROLES` | `name=role,...` - требуемая роль маршрута |
| `EDGE_RATE_LIMIT`, `EDGE_RATE_TTL_MS` | лимит и окно (по умолчанию 600, 60 000) |
| `JWT_PUBLIC_KEY` | ключ проверки подписи |

## Edge cases

- Хранилище лимита - в памяти каждой задачи `api`: при нескольких задачах лимит считается на задачу: [NEEDS DECISION: нужен ли общий счётчик лимита при нескольких задачах `api`; owner: architect].

## Trust boundaries

Граница интернет → сервисы. Доказательство - bearer RS256. Клиентская личность не доверяется никогда. Злоупотребления: подделка заголовков личности (закрыто вырезанием), перебор токенов (лимит), обход роли маршрута (проверка `ROUTE_ROLES` на edge; внутри сервиса - `AuthedMiddleware`/`AdminMiddleware`).

## Cross-capability interactions

### identity

Публичный ключ из `identity` проверяет подпись ([identity](../identity/spec.md)).

### service-orchestration

`WakeMiddleware` стоит перед прокси ([service-orchestration](../service-orchestration/spec.md)).

## Acceptance criteria

[NEEDS INPUT: критерии приёмки Given/When/Then для проверки токена, ролей маршрутов, публичных путей, вырезания заголовков и лимита частоты - формулирует владелец; owner: product]

## Open questions

None known.
