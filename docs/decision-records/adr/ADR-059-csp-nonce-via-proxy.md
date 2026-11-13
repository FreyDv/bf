# ADR-059: Content-Security-Policy: nonce через `proxy.ts` и динамический рендеринг, без `'unsafe-inline'` в `script-src` (заменяет ADR-055, уточняет п. 5 ADR-038)

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-13 |
| **Author** | агент |
| **Decided by** | агент по поручению владельца (2026-11-12): владелец написал в чате «постарайся все делать сам без моих подтверждений» и «Продолжай, не жди меня»; варианты ниже выбрал агент, владелец их по отдельности не подтверждал; владелец вправе оспорить любой пункт новой записью |
| **Tags** | security, frontend, csp |

## Context

- ADR-055 (CSP-1) ввёл статическую политику через `headers()` с `'unsafe-inline'` в `script-src` и `style-src`: она не останавливает внедрённый инлайн-скрипт. Пункт 6 ADR-055 требовал строгую политику до AUTH-2 и до первой admin-страницы; это строка CSP-2.
- ADR-040: общий origin витрины и админки повышает цену XSS, а CSP - одно из двух смягчений (второе - `HttpOnly`). До AUTH-2 это был принятый риск, дальше - нет.
- Страниц ещё нет: `apps/frontend/app` - пустой `page.tsx` и корневой layout. Переход на динамический рендеринг сейчас стоит меньше всего.
- ADR-055 оставил поведение `experimental.sri` в `next` 16.4.4 непроверенным. Здесь оно проверено на сборке (ниже).
- Next 16.4.4 переименовал `middleware` в `proxy`: файл `apps/frontend/proxy.ts`.

## Options considered

Спайк на `next` 16.4.4, production-сборка, `output: standalone`, запуск `server.js`, страница открыта в браузере.

| Развилка | Выбрано | Отклонено |
|---|---|---|
| Механизм | A. nonce через `proxy.ts`, все страницы рендерятся на запрос | B. `experimental.sri`: проверен и **не проходит**. Хеши (`integrity`) получают только скрипты с `src`; в `/` и в 404 остаются 5-6 inline-скриптов (`self.__next_f.push`, `<script id="_R_">`) без хеша. Политика `script-src 'self'` без `'unsafe-inline'` блокирует все 6 в браузере (6 ошибок `Executing inline script violates ...`), `self.__next_f` не создаётся, страница не гидратируется. Чтобы SRI заработал, пришлось бы вернуть `'unsafe-inline'` или вписывать хеш каждого inline-скрипта в политику вручную (он меняется со сборкой). C. смешанная политика по маршрутам: не описана в документации Next, общий origin витрины и админки (ADR-040) делает защиту только админки неполной |
| Динамика | A. `await connection()` в корневом layout: все страницы, включая `_not-found`, рендерятся на запрос | B. `connection()` в каждой странице: новая страница без него молча уходит в prerender, и её inline-скрипты остаются без nonce |
| Форма `script-src` | A. `'self' 'nonce-<значение>' 'strict-dynamic'` (форма из документации Next), в development плюс `'unsafe-eval'` | B. только nonce: старый браузер без `strict-dynamic` не загрузит чанки. `'self'` остаётся запасом для него; браузер с `strict-dynamic` `'self'` игнорирует |
| `style-src` | A. остаётся `'self' 'unsafe-inline'` | B. nonce для стилей: Next и будущие UI-библиотеки вставляют `<style>` без nonce, проверить нечем (страниц нет) |
| Запись | A. полная замена ADR-055: всё живое повторено здесь, у политики один дом (R4) | B. частичная замена пунктов 1, 2 и 6: читателю пришлось бы склеивать две записи |

## Decision

1. **Политику собирает `apps/frontend/proxy.ts`.** На каждый запрос он создаёт nonce (`crypto.randomUUID()` в base64), собирает политику, кладёт её в заголовок запроса (из него Next берёт nonce и ставит на свои скрипты) и в заголовок ответа. `headers()` в `next.config.ts` больше не задаёт CSP. Это уточняет п. 5 ADR-038 (CSP задаёт Next.js там, где известен nonce); сам ADR-038 не правится.
2. **Динамический рендеринг всех страниц.** `await connection()` в `apps/frontend/app/layout.tsx`. Prerender-страниц нет: `/` и `/_not-found` в таблице маршрутов сборки - `ƒ`. Ответ 500 при ошибке рендера (в том числе при падении корневого layout, `global-error`) тоже рендерится на запрос и получает nonce; предсобранный `_global-error.html` в этих случаях не отдаётся.
3. **Директивы.** `default-src 'self'; script-src 'self' 'nonce-<значение>' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`, в production плюс `upgrade-insecure-requests`. Причина каждой директивы записана рядом с ней в `proxy.ts`. `blob:`, `data:`, адрес Spaces (`connect-src`, `media-src`) добавляет функция, которой они нужны (ADR-042 п. 2), правкой `proxy.ts`, без новой записи, если политика не ослабляется.
4. **Matcher.** Все маршруты страниц, включая 404; не входят `_next/static`, `_next/image`, `favicon.ico` и prefetch-запросы (заголовки `next-router-prefetch`, `purpose: prefetch`), как в документации Next. `/api` не исключён: его обслуживает backend (ADR-038 п. 2), в Next маршрутов `/api` нет, а исключение оставило бы будущий route handler без политики.
5. **Enforce, без отчётов** (как в ADR-055): заголовок `Content-Security-Policy`, не report-only; точки приёма отчётов нет.
6. **Development.** `script-src` получает `'unsafe-eval'` (React refresh), `upgrade-insecure-requests` не выдаётся; различие задаёт `NODE_ENV` в `proxy.ts`.
7. **`style-src` с `'unsafe-inline'` - известный остаточный риск.** Строгим стал только `script-src`. Внедрённая разметка со стилями (CSS-инъекция, утечка через селекторы атрибутов) не остановлена; она заметно слабее внедрённого скрипта.
8. **Образ.** `proxy.ts` попадает в standalone-вывод (`.next/server/middleware.js`) без правок `Dockerfile`; проверено сборкой образа и запуском.
9. **Тест.** Автотеста политики нет: frontend-инструмент не выбран (ADR-039 п. 7, TEST-4). Подтверждение ручное (раздел Confirmation).

## Consequences

- Positive: внедрённый `<script>` без nonce и inline-обработчик события (`onerror=...`) блокируются браузером: проверено в браузере на собранном образе (обработчик отклонён с нарушением `script-src-attr`, вставленный парсером inline-скрипт не выполнен). Закрыт пункт 6 ADR-055 и условие ADR-040 до AUTH-2.
- Positive: ничего не добавлено в зависимости; `next` остаётся 16.4.4 (спайк не нашёл дефекта, исправленного позже).
- Negative: нет статической выдачи, ISR и кэша на CDN, выше нагрузка на pod: каждый запрос страницы рендерится и проходит `proxy.ts`. Один pod (ADR-022, ADR-023), бюджета производительности нет (ADR-052), нагрузку измерить нельзя до деплоя (DEPLOY-1). Ответ страницы с `Cache-Control: private, no-cache, no-store`. Несовместимо с PPR; следующая запись о кэше страниц должна исходить из этого.
- Negative: `'strict-dynamic'` доверяет скриптам, которые создал уже доверенный скрипт. Скрипт, вставленный из доверенного кода, выполнится; блокируется внедрение из разметки. Это свойство механизма, а не дефект настройки.
- Negative: `style-src 'unsafe-inline'` (п. 7).
- Negative: без автотеста политику можно ослабить незаметно; ловит только ревью (TEST-4).
- Negative: в production `upgrade-insecure-requests` не проверен на кластере (кластера нет): локально образ проверен по http на `localhost`.
- Negative: форма ADR-038 п. 5 (`headers()`) во второй раз не исполнена; читатель ADR-038 и ADR-055 видит прежний текст, связь - через эту запись и README. Строка `docs/runbooks/spaces.md` про `media-src` указывала на `next.config.ts`: теперь на `proxy.ts`.
- Follow-ups: автотест политики (TEST-4); проверка CSP и `upgrade-insecure-requests` за ingress на кластере (TRAEFIK-2, DEPLOY-1); адрес Spaces и `media-src` - спека курсов (SPEC-2).

## Confirmation

Пока ревью и ручная проверка: `pnpm build` (в таблице маршрутов `/` и `/_not-found` с `ƒ`, строка `Proxy (Middleware)`); `docker build -f apps/frontend/Dockerfile -t bf-frontend:csp2 .` и `docker run`; `curl -sI` на `/` и на несуществующий путь показывает `content-security-policy` с `script-src 'self' 'nonce-...' 'strict-dynamic'` и без `'unsafe-inline'`; `curl -s` - каждый `<script>` несёт `nonce`, значение разное в разных ответах; страница `/` и страница 404 в браузере без нарушений CSP в консоли; на `_next/static/*` заголовка нет. Когда выбран frontend-инструмент тестов (ADR-039 п. 7, TEST-4): тест на вывод `proxy.ts`.

## Revisit when

- Первая UI-библиотека или первая страница с пользовательским содержимым: `style-src` без `'unsafe-inline'` (nonce для стилей) отдельной записью.
- Появился CDN или кэш страниц перед frontend, либо измерение показало, что динамика не укладывается в критерий задержки (ADR-052, первый публичный SSR-маршрут): статическая выдача и хеши вместо nonce, если `experimental.sri` к тому времени покроет inline-скрипты.
- Выбран frontend-инструмент тестов (ADR-039 п. 7): автотест политики.
- Найден XSS на витрине, который политика не гасит (триггер ADR-040).
- Функции нужен `blob:`, `data:` или адрес Spaces (ADR-042 п. 2): расширение политики правкой `proxy.ts` без новой записи, если ослабления нет.

## Related

Заменяет ADR-055 целиком. Уточняет п. 5 ADR-038 (где задаётся CSP), ADR-038 не правится. ADR-040, ADR-042, ADR-052, ADR-039, ADR-011; backlog CSP-2, AUTH-2, TRAEFIK-2, DEPLOY-1, SPEC-2, TEST-4.
