# ADR-070: Логирование в коде: `@bf/kernel` (порты логгера и контекста, `Result`), технический модуль `logging` с адаптером pino, контекст запроса на AsyncLocalStorage (исполняет ADR-032 и ADR-043 п. 7)

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-16 |
| **Author** | агент |
| **Decided by** | агент по поручению владельца, ADR-063 п. 2 (технические развилки решает агент) |
| **Tags** | architecture, observability, logging, boundaries |

## Context

- ADR-032 п. 1-4 и ADR-043 п. 7 задают правила (pino через nestjs-pino только в `apps/backend`, порт в kernel, correlation id на каждой записи, скрытие секретов, поля тела JSON, перечень полей в коде), кода не было: ни пакета `@bf/kernel`, ни порта, ни адаптера, ни контекста запроса.
- ADR-048 п. 2 и ADR-049: kernel создаёт строка, которой он нужен первой, состав реэкспорта `Result` называет она; правила границ kernel уже в `.dependency-cruiser.mjs` и доказаны на имитации пакета.
- ENF-4 перечисляет для kernel много имён (`Entity`, `Guard`, `Command` ...); потребителя у них нет (PRG-3).
- Модуль `logging` не доменный: STR-1 требует имя из языка предметной области, STR-9 запрещает имя «по таблице, экрану или тикету», PRG-1 требует классификацию `domain-rich` или `data-centric`. INF-8 прямо относит реализацию логгера к инфраструктуре.
- Проверено запуском (2026-11-16):
  - nestjs-trpc монтирует роутер в `onModuleInit` через `app.use(basePath)`; Nest регистрирует свой middleware раньше: middleware nestjs-pino не видит вызов tRPC (запись `request completed` для `/api/trpc/...` не появлялась, для обычного маршрута появлялась);
  - `pnpm deps` на настоящем kernel сработал на его `eslint.config.js` (`kernel-is-domain-free`: импорт `@bf/config`) и `vitest.config.ts` (`kernel-npm-only-neverthrow`: `vitest/config`): правила смотрят каждый файл под `packages/kernel/`, а не только `src/`;
  - `docker build -f apps/backend/Dockerfile .` с первой runtime-зависимостью на пакет workspace проходит без правки: `pnpm deploy --prod` кладёт `@bf/kernel` копией (`dist` и `package.json`), `injectWorkspacePackages` не нужен;
  - nestjs-trpc 2.14.0 создаёт `new ConsoleLogger()` в `trpc.module.js` и `factory.module.js`: его строки при старте (`TRPC Server`, `Router Factory`) идут текстом мимо pino.
- Версии (`npm view`, 2026-11-16): pino 10.4.0 (2026-10-02), nestjs-pino 5.3.1 (2026-10-02), pino-http 11.0.0 (2026-08-15), neverthrow 8.2.0 (2025-02-21): кулдаун ADR-005 пройден у всех, `pnpm` принял без обхода.

## Options considered

| Развилка | Выбрано | Отклонено |
|---|---|---|
| Состав kernel сейчас | только порт логгера, порт контекста, `Result`; остальное ENF-4 приносит первый модуль | весь список ENF-4: код без потребителя (PRG-3); добавление имени позже не ломает |
| Контекст запроса | в kernel только интерфейс (чистый TS, без `node:`); реализация на AsyncLocalStorage в `apps/backend` | AsyncLocalStorage в kernel: `node:async_hooks` в kernel, а ADR-049 п. 2 оставляет встроенные модули Node вне решения |
| Дом адаптера | технический модуль `apps/backend/src/logging/`, только инфраструктура | положить в `app.module` или `src/infrastructure/`: нет `<module>/infrastructure/`, который читают правила STR-6 и `dep-5`; модуль по имени сущности |
| middleware контекста и access-лога | `app.use` на уровне Express в `configureApp`, до всего, что монтирует Nest | `forRoutes` nestjs-pino: не видит tRPC (см. Context) |
| nestjs-pino | `useExisting: true`: библиотека даёт `Logger` и `PinoLogger`, pino-http ставит `configureLogging` | pino-http внутри nestjs-pino: двойная запись для обычных маршрутов и ни одной для tRPC |
| Конфиги kernel | у kernel нет своих `eslint.config.js` и `vitest.config.ts`; lint по общему `packages/config/eslint/package-root.js`, vitest по умолчаниям | исключить конфиги из графа или из правил kernel: ослабление, которого запретил AGENTS.md и ADR-014 п. 4 |
| `child()` в порту | нет (YAGNI) | `child(fields)`: нет потребителя |
| Правило импорта pino | новое правило `dep-4-pino-only-in-infrastructure-and-module-wiring` | оставить «ловит `pnpm deps`» из ADR-032 Confirmation: правила не было, утверждение было неверным |

## Decision

1. **`@bf/kernel` (`packages/kernel`), собран в `dist`, как `packages/db-utils`.** Состав: `Logger`, `LogFields`, `ErrorCode`, `JsonValue`, `RequestContext` (типы); `Result`, `Ok`, `Err` (типы) и `ok`, `err` (функции) из neverthrow 8.2.0 (точная версия, ADR-015, ADR-048 п. 3-4); `InMemoryLogger` (TST-5) отдельным путём `@bf/kernel/testing`, чтобы продуктовый код его не импортировал. Остальное ENF-4 (`Entity`, `Guard`, `Command` ...) добавит первый модуль. Добавление имени не ломает потребителей.
2. **Порт логгера.** Методы `debug`, `info`, `warn`, `error(message: string, fields?: LogFields)`. `LogFields` - объект из JSON-значений; необязательные `code` (форма `MODULE.REASON`, ERR-1) и `err` (`Error`, сериализует адаптер). `child()` и `with()` нет. Вызывающий не передаёт `correlationId`, `actorId`, `actorSource`: тип запрещает (`never`), адаптер дополнительно вырезает их в рантайме и берёт из контекста запроса.
3. **Контекст запроса.** В kernel - интерфейс `RequestContext`, только чтение: `correlationId`, `actorId`, `actorSource`. Реализация - `AsyncLocalRequestContext` на AsyncLocalStorage в `apps/backend/src/logging/infrastructure/`. Объект хранилища создаётся на каждый запрос middleware (ENF-5: на запрос, не глобальным значением). `actorId` и `actorSource` равны null, пока AUTH-3 их не привяжет; слот в объекте есть (ADR-040 п. 5 и 10: личность кладёт в контекст driving adapter), сеттера сейчас нет. Запись вне запроса (старт, остановка, будущая точка входа не из HTTP) несёт `correlationId: null`. **Правило:** потребитель NATS или воркер открывает свой контекст тем же `run()` со своим id; запись без контекста допустима только при старте и остановке.
4. **Модуль `logging` технический.** Отступление от STR-1, STR-9, PRG-1 записано здесь, только для него: домена, спеки возможности и классификации нет, потому что в нём нет ни бизнес-правил, ни данных, только инфраструктура (INF-8). Раскладка: `src/logging/infrastructure/` (адаптер pino, контекст на AsyncLocalStorage, middleware, настройка `configureLogging`, список скрываемых полей, чтение уровня), `src/logging/logging.module.ts` (сборка зависимостей, STR-6; `@Global`), `src/logging/public/logging.tokens.ts` (`LOGGER`, `REQUEST_CONTEXT` символами, без импортов: `public/` по ADR-068 импортирует только файлы контракта). Другие модули внедряют порт по токену, тип берут из `@bf/kernel`. Остальные правила (STR-2, STR-6, STR-7, DEP, ENF, TST, ERR) действуют.
5. **Зависимости `apps/backend`:** `pino` 10.4.0, `nestjs-pino` 5.3.1, `pino-http` 11.0.0, `@bf/kernel` (workspace). `pino-http` - обязательный peer `nestjs-pino` 5.x и используется напрямую в `configureLogging`; зависимость покрыта ADR-032, отдельной записи не нужно. `neverthrow` 8.2.0 - только в `packages/kernel`.
6. **Correlation id.** Входящий `x-request-id` принимается только если это UUID любой версии длиной 36; иначе `crypto.randomUUID()`. Id возвращается в заголовке ответа `x-request-id`, в записи это поле тела JSON `correlationId`, не метка (ADR-043 п. 7.2).
7. **Порядок монтирования.** `configureApp` первым вызывает `configureLogging(app)`: `app.use` с middleware контекста, затем `app.use` с pino-http, затем `app.useLogger` с `Logger` nestjs-pino. Всё это на Express до `onModuleInit` nestjs-trpc, поэтому вызов tRPC и его access-запись идут внутри контекста. `main.ts` создаёт приложение с `bufferLogs: true`: записи Nest до `useLogger` не теряются и выходят JSON. Порядок доказывает тест через `/api/trpc` (`logging.setup.test.ts`).
8. **Поля записи** (явный перечень в коде, `LOG_RECORD_FIELDS` и `HTTP_LOG_FIELDS` в адаптере, R4): `time` (ISO 8601), `level` (имя), `msg`, `correlationId`, `actorId`, `actorSource`, `code` (если задан), `err` (если задан), поля вызывающего; access-запись добавляет `req`, `res`, `responseTime`. Без `pid` и `hostname`. **Скрытие:** экспортируемый список `REDACTED_FIELDS` в адаптере: `phone`, `address`, `password`, `secret`, `token`, `accessToken`, `refreshToken`, `authorization`, `cookie` на верхнем уровне и на уровне ниже (`*.<имя>` в путях redact pino), замена `[redacted]`. Глубже второго уровня не скрывается: вызывающий выбирает поля. LOG-1 добавляет параметры подписанных ссылок Spaces ещё одной записью списка.
9. **Access-записи остаются включены, сериализаторы с белым списком:** `req = { method, path }` (путь без строки запроса), `res = { statusCode }`, `responseTime`. Без заголовков, адреса клиента и строки запроса (ADR-043 п. 4.1, ERR-6): tRPC кладёт входные данные вызова в query.
10. **Уровень.** Переменная `LOG_LEVEL`, по умолчанию `info`, допустимы уровни pino (`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`); неверное значение останавливает запуск (ERR-3). Значение для прода выбирает OBS-2 (ADR-043 п. 8), здесь только чтение. В тестах backend `LOG_LEVEL=silent` (`apps/backend/vitest.config.ts`).
11. **Граница.** Правило `dep-4-pino-only-in-infrastructure-and-module-wiring` (усиление, ENF-1): `pino`, `nestjs-pino`, `pino-http` импортируют только файлы `<модуль>/infrastructure/` и `<модуль>/<модуль>.module.ts`. `main.ts` и `configure-app.ts` не входят: им хватает `configureLogging` из `infrastructure/`. Фикстуры в `scripts/boundaries.test.ts`: допустимые импорты из `infrastructure/` и файла модуля, отклонённые из `application/`, слайса, `public/`, `domain/`, корня `src/` и kernel. Существующие правила не ослаблены. Тест границ теперь подменяет workspace-ссылки `apps/backend/node_modules/@bf/*` деревом фикстур: настоящий backend линкует настоящий `@bf/kernel`.
12. **Конфиги kernel.** По итогам проверки на настоящем пакете (Context): под `packages/kernel/` нет файлов конфигурации с импортами пакетов. Lint: `eslint --config ../config/eslint/package-root.js .`; тесты: vitest по умолчаниям; `tsconfig.json` включает только `src`. Правила kernel не менялись.
13. **Образ.** Dockerfile не меняется (проверено сборкой, Context). Контейнер при запуске пишет JSON-записи с `correlationId` и access-запись с id из `x-request-id`.
14. **Исправление утверждения ADR-032.** Раздел Confirmation ADR-032 («Импорт pino вне infrastructure ловит `pnpm deps`») верен с этой записи: правило из п. 11. ADR-032 не правится (Accepted).

## Consequences

- Плюс: каждая запись backend несёт `correlationId`, `actorId`, `actorSource` без участия вызывающего; персональные данные и секреты по списку не доходят до stdout; строка запроса tRPC в лог не попадает.
- Плюс: порт, in-memory дубль и `Result` готовы первому модулю; pino виден только `logging` и правилу границ.
- Минус: нестандартный модуль `logging` (без домена и спеки) - исключение из STR-1, STR-9, PRG-1; других таких модулей без новой записи нет.
- Минус: строки nestjs-trpc при старте (`TRPC Server`, `Router Factory`) идут текстом, не JSON, и без `correlationId` (его при старте нет). Строка LOG-3.
- Минус: скрытие работает на двух уровнях; секрет, положенный глубже, в логе виден. Вызывающий не логирует объекты целиком.
- Минус: `actorId` и `actorSource` пока null на каждой записи; слот заполнит AUTH-3.
- Минус: у kernel нет своих конфигов инструментов, lint идёт по конфигу из `packages/config` через `--config`; это обход правил kernel, а не их исключение.
- Дальше: LOG-1 (параметры подписи Spaces), OBS-2 (уровень в проде, отсев проб, сбор Alloy), AUTH-3 (привязка актора), LOG-3 (строки nestjs-trpc).

## Confirmation

- Машинно: `pnpm deps` и `pnpm deps:test` (шаг `Architecture boundaries` в `ci`): правило из п. 11 с фикстурами, правила kernel на настоящем пакете.
- Тесты: `packages/kernel/src/*.test.ts` и `packages/kernel/src/testing/*.test.ts`; `apps/backend/src/logging/infrastructure/*.test.ts` - запись несёт `correlationId` (в том числе после `await`), все имена списка скрыты на верхнем и вложенном уровне, поля в теле JSON, перечень полей, `LOG_LEVEL`, UUID из заголовка, вызов `/api/trpc`: запись внутри вызова и access-запись несут id, строка запроса не появляется в записях.
- Сборка: `docker build -f apps/backend/Dockerfile .` и запуск контейнера (прогнано 2026-11-16 при этом решении); `pnpm image:check lint` без замечаний, кроме прежнего DL3066.
- Ревью: `ddd-review` (AIP-6.2, AIP-6.5): запись только через порт, `Result` только из `@bf/kernel`.

## Revisit when

- Появилась вторая точка входа, не HTTP (потребитель NATS, воркер): п. 3, свой `run()` с id из сообщения.
- Нужны вложенность скрываемых полей глубже второго уровня или `child()` в порту: п. 2, п. 8.
- Первый модуль просит в kernel имена ENF-4 или встроенный модуль Node: п. 1, ADR-049 п. 2.
- nestjs-trpc перестаёт писать мимо логгера приложения (LOG-3) или nestjs-pino сменяется: п. 7.
- Нужен трейсинг: correlation id заменяется или дополняется id трассы.

## Related

ADR-005, ADR-008, ADR-009, ADR-014, ADR-015, ADR-032, ADR-040, ADR-042, ADR-043, ADR-048, ADR-049, ADR-063, ADR-068; ENF-1, ENF-4, ENF-5, STR-1, STR-9, PRG-1, PRG-3, DEP-3, DEP-4, ERR-1, ERR-3, ERR-6, INF-8, TST-5; backlog LOG-1, LOG-2, LOG-3, OBS-2, AUTH-3.
