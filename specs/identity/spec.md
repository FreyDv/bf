# identity

<!-- Спека извлечена из кода (`apps/auth`, `packages/contracts/src/auth`); контракты процитированы дословно, файл:строка - якорь. Всё, что код не показывает, - маркер, не догадка. -->

**Spec tier:** buildable
**Serves:** `Владелец-оператор`
**Status:** in-refinement
**Success metric:** n/a - North Star не определён (backlog PRODUCT-1)

> [NEEDS REVIEW] drafted by the adoption run on 2026-11-05 from the code of apps/auth and packages/contracts/src/auth. Backlog: SPEC-1.

## Purpose

Идентификация: выпуск и проверка подлинности токенов доступа и обновления. Сервис `auth` подписывает access-JWT (RS256), хранит хеши refresh-токенов и отдаёт публичный ключ; проверка access-токена - на edge (см. `edge-gateway`).

## Scope

Пользователи (`users`), refresh-токены (`refresh_tokens`), выпуск пары токенов, вращение refresh-токена, отзыв (один и все), публикация JWKS, dev-выдача токена вне продакшена.

## Out of scope

Проверка access-токена на каждом запросе, роли маршрутов, ограничение частоты - `edge-gateway`. Внешние провайдеры входа - не реализованы: [NEEDS DECISION: какие провайдеры входа планируются и когда; owner: product].

## Core concepts

- **Пара токенов** - `accessToken` (JWT RS256, короткий срок) + `refreshToken` (непрозрачный, 48 случайных байт base64url, хранится только как sha256).
- **Вращение** - предъявленный refresh-токен отзывается, выдаётся новая пара.
- **Роли** - `user`, `admin` (`packages/contracts/src/auth/schemas.ts:5`).

## Data contracts

Таблицы (`apps/auth/src/modules/identity/identity.schema.ts:8,19`; база `auth`):

| Таблица | Колонка | Тип | Ограничения / смысл |
|---|---|---|---|
| `users` | `id` | uuid | PK, `defaultRandom()` |
| `users` | `email` | text | nullable, уникальный индекс `users_email_uq` |
| `users` | `roles` | text[] | NOT NULL, по умолчанию `['user']` |
| `users` | `created_at`, `updated_at` | timestamptz | NOT NULL, `defaultNow()` |
| `refresh_tokens` | `id` | uuid | PK |
| `refresh_tokens` | `user_id` | uuid | NOT NULL, FK `users.id` ON DELETE CASCADE, индекс `refresh_tokens_user_id_idx` |
| `refresh_tokens` | `token_hash` | text | NOT NULL, sha256 токена, уникальный `refresh_tokens_hash_uq` |
| `refresh_tokens` | `user_agent` | text | nullable |
| `refresh_tokens` | `expires_at` | timestamptz | NOT NULL |
| `refresh_tokens` | `revoked_at` | timestamptz | nullable; не NULL = отозван |
| `refresh_tokens` | `created_at` | timestamptz | NOT NULL |

Схемы контрактов (`packages/contracts/src/auth/schemas.ts:9,18`):

```ts
export const ROLES = ['user', 'admin'] as const;
export const userSchema = z.object({ id: idSchema, email: z.string().email().nullable(), roles: z.array(roleSchema), createdAt: isoDateTimeSchema, updatedAt: isoDateTimeSchema });
export const tokenPairSchema = z.object({ accessToken: z.string(), refreshToken: z.string(), tokenType: z.literal('Bearer'), expiresIn: z.number().int().positive() });
```

Полезная нагрузка access-JWT (`packages/shared/src/interfaces/index.ts:44`): `{ sub: string; email?: string; roles?: string[]; iat?: number; exp?: number }`; издатель по умолчанию `bf-auth` (`JWT_ISSUER`).

## Interface contracts

REST-контроллер `@Controller('auth')` (`apps/auth/src/modules/identity/auth.controller.ts:28`); через edge путь `/auth/api/auth/...`.

| Метод и путь | Строка | Доступ | Вход | Успех | Побочные эффекты |
|---|---|---|---|---|---|
| `POST auth/refresh` | `:40` | публичный | `{ refreshToken: string }` | `200`, `TokenPair` | отзывает предъявленный токен, выпускает новую пару |
| `POST auth/logout` | `:47` | с токеном | `{ refreshToken?: string }` | `204` | отзывает переданный токен, иначе все токены пользователя |
| `POST auth/dev-token` | `:57` | публичный | `{ sub: string; roles?: string[] }` | `201`, `TokenPair` | upsert dev-пользователя, выпуск пары; `403` в production |
| `GET auth/jwks` | `:66` | публичный | - | `200`, `{ keys: [{ ...jwk, use: 'sig', alg: 'RS256', kid: 'bf-auth-1' }] }` | - |

Ошибки (таблица обязательна, строка на путь ошибки):

| Endpoint | Status | errorCode | Message / condition |
|---|---|---|---|
| `POST auth/refresh` | 401 | `UNAUTHORIZED` | `Invalid refresh token` - токен неизвестен, отозван или истёк |
| `POST auth/refresh` | 401 | `UNAUTHORIZED` | `User no longer exists` |
| `POST auth/dev-token` | 403 | `FORBIDDEN` | `Not available in production` |
| любой с DTO | 400 | [NEEDS CLARIFICATION: форма ответа валидации class-validator; owner: dev] | неверное тело запроса |

## Algorithms & rules

1. **Выпуск** (`tokens.service.ts:33`): подписать access-JWT `{ sub, email, roles }`; вычислить `expiresIn = exp - iat`; сгенерировать `randomBytes(48)` base64url; вставить строку в `refresh_tokens` с `token_hash = sha256(token)`, `expires_at = now + REFRESH_TOKEN_TTL_DAYS`; вернуть пару.
2. **Вращение** (`:52`): найти строку по хешу с `revoked_at IS NULL`; если нет или `expires_at < now` - 401; найти пользователя, иначе 401; проставить `revoked_at = now`; выпустить новую пару.
3. **Отзыв** (`:70`, `:79`): проставить `revoked_at` для строки по хешу либо для всех не отозванных строк пользователя.

## Requirements

### Токены

- Сервис MUST подписывать access-токены ключом `JWT_PRIVATE_KEY`; без ключа приложение не стартует (`env.schema.ts:14`).
- Refresh-токен MUST храниться только как sha256; сырое значение MUST NOT попадать в базу или логи.
- Refresh-токен MUST быть одноразовым (вращение).
- Срок refresh-токена - `REFRESH_TOKEN_TTL_DAYS` (1-365, по умолчанию 30, `env.schema.ts:12`); значение в продакшене: [NEEDS DECISION: срок жизни refresh-токена в проде; owner: product].
- Срок access-токена - `JWT_EXPIRES_IN` (по умолчанию `15m`, `packages/server/src/env.ts:49`; ADR-019); значение в продакшене: [NEEDS DECISION: срок жизни access-токена; owner: product].
- Сервис MUST NOT выдавать dev-токен в production.

## Invariants

- Строка `refresh_tokens` с `revoked_at IS NOT NULL` MUST NOT проходить вращение (покрыть Given/When/Then в Acceptance criteria).
- `token_hash` уникален; два пользователя не делят токен.

## Config & flags

| Flag | Effect |
|---|---|
| `JWT_PRIVATE_KEY` | обязателен для `auth`; ключ подписи RS256 |
| `JWT_PUBLIC_KEY` | публичный ключ; отдаётся в JWKS и проверяется на edge |
| `JWT_EXPIRES_IN`, `JWT_ISSUER` | срок и издатель access-токена (`packages/server/src/env.ts:49,53`) |
| `REFRESH_TOKEN_TTL_DAYS` | срок refresh-токена, 1-365, по умолчанию 30 |
| `NODE_ENV=production` | запрещает `dev-token` |

## Edge cases

- Повторное предъявление уже вращённого refresh-токена - 401 (покрыто e2e `apps/auth/test/auth.e2e-spec.ts`).
- Поведение при компрометации refresh-токена (массовый отзыв по событию): [NEEDS DECISION: нужен ли обнаружитель повторного использования; owner: architect].

## Trust boundaries

Кто вызывает: любой клиент (`refresh`, `jwks`, `dev-token` вне прод), клиент с токеном (`logout`). Доказательство - refresh-токен (владение секретом) или bearer access-JWT, проверенный edge. Валидируется на границе: DTO class-validator. Злоупотребления: перебор refresh-токенов (лимит частоты на edge, `edge-gateway`); подбор `dev-token` в проде закрыт запретом.

## Cross-capability interactions

### edge-gateway

Edge проверяет access-токен публичным ключом и пересылает личность заголовками `X-User-*` ([edge-gateway](../edge-gateway/spec.md)).

## Acceptance criteria

[NEEDS INPUT: критерии приёмки в виде Given/When/Then для выпуска, вращения, отзыва, JWKS и запрета dev-token в проде - формулирует владелец; owner: product]

## Open questions

None known.
