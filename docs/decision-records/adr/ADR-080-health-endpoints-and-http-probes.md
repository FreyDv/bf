# ADR-080: Эндпоинты здоровья и HTTP-пробы: `GET /api/health` в backend, `GET /healthz` во frontend, второй технический модуль `health` (исполняет ADR-019, ADR-038; расширяет п. 4 ADR-070)

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-16 |
| **Author** | агент |
| **Decided by** | агент по поручению владельца, ADR-063 п. 2 (технические развилки решает агент) |
| **Tags** | deploy, observability, architecture, boundaries |

## Context

- Чарт `app` без `probes.path` проверяет TCP-порт 3000 (`deploy/charts/app/templates/deployment.yaml`). Такая проба не отличает процесс, который держит порт, но не отвечает, от здорового (PROBE-1, найдено при DEPLOY-1).
- `/api` на хосте принадлежит backend, остальное frontend (ADR-038): маршрут здоровья frontend не может лежать под `/api`.
- Kubernetes-проба шлёт обычный HTTP GET; tRPC для неё не подходит.
- База данных у backend ещё нет (DEPLOY-1 без БД, ADR-019); проверять нечего, кроме ответа процесса.
- ADR-070 п. 4 допустил один технический модуль (`logging`) и записал: «других таких модулей без новой записи нет».
- Правила границ (`.dependency-cruiser.mjs`) читают адаптер по суффиксу `.controller.ts`; ограничения на папку для него вне слайса `commands/` и `queries/` нет, правила `dep-2` для адаптера действуют внутри слайса.
- Проверено запуском (2026-11-16): образы `bf-backend` и `bf-frontend` собраны и запущены с read-only корнем; `GET /api/health` дал 200 и `{"status":"ok"}`, `GET /health` дал 404, `GET /healthz` дал 200 и `ok`; в логе контейнера backend записи `request completed` для пробы нет, для 404 есть.

## Options considered

| Развилка | Выбрано | Отклонено |
|---|---|---|
| Реализация в backend | обычный контроллер Nest, `GET /api/health` (глобальный префикс `api` действует) | tRPC-процедура: проба не умеет вызов tRPC; `@nestjs/terminus`: новая зависимость ради одного ответа (ADR-005, DEP-10) |
| Модуль | второй технический модуль `health` (запись ниже) | положить контроллер в `app.module` или `src/`: нет `<модуль>/`, который читают правила; модуль «по экрану или тикету» |
| Место контроллера | слайс `health/queries/check-liveness/check-liveness.controller.ts` (STR-2: слайс держит свой driving adapter), `health/health.module.ts` в корне модуля (STR-6) | `infrastructure/`: контроллер - interface adapter, суффикс `.controller` (STR-7); новое правило для технического модуля: не нужно, ни одно правило не ослаблено |
| Query и handler | нет: вызывать у приложения нечего, ответ константа (PRG-3, PRG-4) | пустые `check-liveness.query.ts` и handler: код без смысла |
| Что отвечает проба | только жив ли процесс: 200 и `{"status":"ok"}`, без версии, имени хоста и других данных | проверка БД или NATS: БД нет; чужая недоступность не должна перезапускать здоровый под (liveness); readiness с БД - DEPLOY-2, SCHEMA-2 |
| Одна проба или две | один путь для `readinessProbe` и `livenessProbe` (чарт уже так рендерит) | два пути сейчас: разница появится с проверкой БД в readiness |
| Frontend | route handler `apps/frontend/app/healthz/route.ts`, GET, 200 и текст `ok`, `dynamic = 'force-dynamic'` | `/api/...`: хост отдаёт `/api` backend (ADR-038); статический ответ при сборке: проба не дошла бы до обработчика |
| Access-лог | `autoLogging.ignore` у pino-http ровно для пути `/api/health` (`http-logging.config.ts`) | отфильтровать все пробы или шум в проде: это OBS-2; писать запись на каждую пробу: десятки тысяч записей в сутки без содержания |

## Decision

1. **Backend.** `GET /api/health` отвечает 200 и `{"status":"ok"}`, больше ничего. Обычный контроллер Nest `CheckLivenessController` в `apps/backend/src/health/queries/check-liveness/`, модуль `apps/backend/src/health/health.module.ts` подключён в `AppModule`. Проверок нет: только жив ли процесс, который принимает запросы. Новой зависимости нет.
2. **Модуль `health` технический.** Отступление от STR-1, STR-9, PRG-1 то же и по той же причине, что в п. 4 ADR-070, и только для `health` и `logging`: домена, спеки возможности и классификации нет, потому что в нём нет ни бизнес-правил, ни данных. Остальные правила (STR-2, STR-6, STR-7, DEP, ENF, TST, ERR) действуют. ADR-070 остаётся Accepted и не правится. Третий технический модуль требует своей записи.
3. **Пробы чарта.** `deploy/apps/backend/values.yaml`: `probes.path: /api/health`; `deploy/apps/frontend/values.yaml`: `probes.path: /healthz`. Чарт рендерит `httpGet` на именованный порт `http` (3000) для обеих проб, правки чарта не нужно. `scripts/charts.test.ts` проверяет, что значения `deploy/apps/<app>/` дают `httpGet` с этими путями на этот порт, и что без пути остаётся `tcpSocket`.
4. **Frontend.** `GET /healthz`: 200, `text/plain`, тело `ok`. Путь вне `/api`. Работает через `proxy.ts` (CSP-заголовок ставится и на него, это безвредно) и не меняет сборку.
5. **Access-лог.** Запись `request completed` не пишется для `/api/health` ровно (путь без строки запроса); остальные пути пишутся. Фильтр прода для прочего шума остаётся за OBS-2.
6. **Readiness растёт позже.** Когда у backend будет база, `readinessProbe` получит проверку БД (DEPLOY-2, SCHEMA-2) отдельным путём; liveness остаётся без внешних проверок.

## Consequences

- Плюс: остановленный или зависший процесс перестаёт быть `Ready` и перезапускается; проба не заваливает лог.
- Плюс: ни одно правило границ не ослаблено, новой зависимости нет.
- Минус: константный ответ не показывает, что приложение способно работать (БД, NATS): до DEPLOY-2 так и задумано.
- Минус: путь `/api/health` повторён в двух местах кода (контроллер строится из префикса и `health`, фильтр лога держит строку): `configure-app.ts` импортирует настройку логирования, импорт обратно дал бы цикл. Тест `logging.setup.test.ts` падает при расхождении.
- Минус: ещё одно исключение из STR-1, STR-9, PRG-1.
- Дальше: OBS-2 (фильтр прочего шума в проде), DEPLOY-2 и SCHEMA-2 (readiness с БД).

## Confirmation

- Тесты: `apps/backend/src/health/queries/check-liveness/check-liveness.controller.test.ts` (200 и тело, `/health` даёт 404), `apps/backend/src/logging/infrastructure/logging.setup.test.ts` (нет записи для пробы, запись для другого пути есть), `apps/frontend/app/healthz/route.test.ts`, `scripts/charts.test.ts` (`pnpm charts:test`).
- Машинно: `pnpm deps` и `pnpm deps:test`, `pnpm charts`.
- Сборка: `docker build` обоих образов и запуск (прогнано 2026-11-16, Context).
- Кластер: поды `Ready`; остановленный процесс перестаёт быть `Ready` (проверка после слияния, PROBE-1).

## Revisit when

- У backend появилась база или другая зависимость, без которой он не должен принимать трафик: п. 6, readiness с проверкой.
- Нужны разные пути для liveness и readiness или данные в ответе (версия, состояние): п. 1, п. 3.
- Появился третий технический модуль: п. 2, новая запись.
- OBS-2 вводит общий фильтр шума access-лога: п. 5 переходит в него.

## Related

ADR-019, ADR-038, ADR-063, ADR-066, ADR-070; STR-1, STR-2, STR-6, STR-7, STR-9, PRG-1, PRG-3, PRG-4, DEP-10; backlog PROBE-1, OBS-2, DEPLOY-2, SCHEMA-2.
