# ADR-066: Content-Security-Policy: nonce и `'strict-dynamic'` через `proxy.ts`, динамический рендеринг (заменяет пункты 1-2 ADR-055)

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-15 |
| **Author** | агент |
| **Decided by** | агент по поручению владельца, ADR-063; владелец задал механизм, область и форму записи, вправе оспорить любой пункт новой записью |
| **Tags** | security, frontend, csp |

## Context

- ADR-055 п. 1-2: статическая политика через `headers()` с `'unsafe-inline'` в `script-src`; п. 5: внедрённый инлайн-скрипт она не останавливает; п. 6: строгая политика до AUTH-2 и первой admin-страницы (строка CSP-2). ADR-040 опирается на CSP как на смягчение XSS при общем origin витрины и админки.
- Живой сайт до этой записи: `script-src 'self' 'unsafe-inline'`, страница пререндерена (`x-nextjs-cache: HIT`, `s-maxage=31536000`); 6 внешних и несколько инлайновых скриптов, `integrity=` нет. Простое снятие `'unsafe-inline'` ломает страницу.
- Страница теперь «Hello world» (`apps/frontend/app/page.tsx`), а не пустая, как в ADR-055; цена динамического рендеринга минимальна.
- Проверка `experimental.sri` в `next` 16.4.4 (`output: 'standalone'`, `script-src 'self'` без `'unsafe-inline'`, 2026-11-15): сборка проходит; из 6 внешних скриптов `integrity` получили 5, шестой (чанк `37j5jclhg7nn6.js`) нет; 3 инлайновых скрипта (загрузчик чанков Turbopack `<script id="_R_">`, `self.__next_f` инициализация, RSC-данные `self.__next_f.push([1,...])`) выходят без `integrity`, без nonce и без хеша. Правила CSP блокируют такой инлайн без `'unsafe-inline'`, страница не гидратируется. В браузере этот вариант не запускался: вывод сделан по выданному HTML и правилам CSP.
- Руководство Next 16.4.x (`content-security-policy.md`): nonce берётся из заголовка запроса `Content-Security-Policy`, который выставляет `proxy.ts`; Next ставит его на свои скрипты; нужен динамический рендеринг; PPR с nonce несовместим.

## Options considered

| Развилка | Выбрано | Отклонено |
|---|---|---|
| Механизм | A. nonce и `'strict-dynamic'` через `proxy.ts`, динамический рендеринг | C. `experimental.sri`: проверен первым, инлайновые скрипты Next остаются без хеша (см. Context), `'unsafe-inline'` не снять |
| `style-src` | A. `'self' 'unsafe-inline'` как в ADR-055 | nonce для стилей по руководству Next: вне объёма CSP-2 |
| Область nonce | A. matcher как в руководстве: без `_next/static`, `_next/image`, `favicon.ico` и prefetch-запросов | - |
| ADR-052 | A. сознательно отложен: страница «Hello world» не маршрут витрины с SSR (ADR-011) | - |

## Decision

1. **Политика строится по запросу в `apps/frontend/proxy.ts`.** Nonce - `Buffer.from(crypto.randomUUID()).toString('base64')`; `script-src 'self' 'nonce-<nonce>' 'strict-dynamic'`. Заголовок `Content-Security-Policy` выставляется и на запрос (из него Next берёт nonce), и на ответ. Заменяет п. 1 (статика через `headers()`) и п. 2 (`'unsafe-inline'` в `script-src`) ADR-055. Остальные директивы п. 2 без изменений: `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`. Причина каждой - комментарий рядом в `proxy.ts`.
2. **Динамический рендеринг везде.** Корневой `app/layout.tsx` ждёт `connection()`: ни одна страница не может остаться статической по забывчивости. Маршруты `/` и `/_not-found` в `next build` помечены `ƒ`.
3. **Область сужена.** Matcher пропускает `_next/static`, `_next/image`, `favicon.ico` и prefetch-запросы (`next-router-prefetch`, `purpose: prefetch`); на них заголовка CSP нет. Это сужение п. 1 ADR-055 («на каждый маршрут»): у ответов без документа CSP защищать нечего. Неизвестный путь (404) проходит через прокси и получает заголовок. `headers()` в `next.config.ts` держал только CSP, других заголовков там не было, поэтому он удалён; HSTS, `nosniff`, `Referrer-Policy` и `X-Frame-Options` по-прежнему даёт ingress на все маршруты (ADR-038 п. 5).
4. **`style-src` остаётся `'self' 'unsafe-inline'`.** Инлайн-стили Next.js и будущих UI-библиотек проходят. Внедрённый стиль CSP не останавливает (подмена вида, утечка через CSS-селекторы); принято до триггера в «Revisit when».
5. **Development и production.** `next dev`: та же политика с nonce плюс `'unsafe-eval'` в `script-src` (React refresh, ADR-055 п. 4). Production: плюс `upgrade-insecure-requests`. Различие задаёт `NODE_ENV`. Режим enforce без точки приёма отчётов (ADR-055 п. 3 в силе).
6. **ADR-055 остаётся Accepted, текст не правится** (R6; образцы - ADR-053 к ADR-033, ADR-058 к ADR-057). Его пп. 3, 4, 7 в силе; п. 5 (остаточный риск) для инлайн-скриптов снят, для стилей действует п. 4 этой записи; п. 6 исполнен. Фраза «`page.tsx` пуст» в его Context устарела, не правится.
7. **Автотеста нет.** Frontend-инструмент тестов не выбран (ADR-055 п. 7, TEST-4); как поймать ослабление политики - вместе с его выбором.
8. **ADR-052 отложен.** Триггер ADR-052 («первый публичный SSR-маршрут витрины», ADR-011) срабатывает на первой настоящей странице витрины, не на этой записи.

## Consequences

- Positive: `script-src` без `'unsafe-inline'`: внедрённый инлайн-скрипт без nonce не выполняется; условие AUTH-2 и первой admin-страницы (ADR-055 п. 6) выполнено; зависимостей не добавлено (ADR-005); `next` остаётся 16.4.4.
- Negative: цена динамического рендеринга. Каждый запрос рендерится на поде; ответ `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` вместо `s-maxage=31536000`, кэша на CDN и ISR нет; статической генерации публичных страниц (ADR-011 п. 2) нет, SSR остаётся. Frontend: 1 реплика, requests `cpu 50m`, `memory 128Mi` (`deploy/charts/app/values.yaml`); для «Hello world» нагрузка пренебрежима, при реальном трафике это изменится.
- Negative: PPR и Cache Components с nonce несовместимы (руководство Next); использовать их нельзя, пока политика на nonce.
- Negative: `'strict-dynamic'` доверяет скриптам, загруженным скриптом с nonce; XSS через сам доверенный скрипт он не закрывает. Браузеры без поддержки `'strict-dynamic'` опираются на `'self'`.
- Negative: SRI проверен только на `next` 16.4.4; на другой версии результат может отличаться.
- Negative: без автотеста политику можно ослабить незаметно; ловит ревью.
- Не проверено: заголовок за Traefik на кластере и `upgrade-insecure-requests` по реальному TLS - после слияния (оркестратор).
- Follow-ups: `blob:`, `data:`, Spaces и `media-src` - вместе с функцией курсов (ADR-042 п. 2, SPEC-2).

## Confirmation

Ревью и ручная проверка, без автотеста (п. 7). Проверено 2026-11-15 на `next start` из standalone-сборки: `pnpm build` (маршруты `ƒ`); `curl -sI` на `/` и на 404: `Content-Security-Policy` есть, `script-src` без `'unsafe-inline'`; в HTML из `/` 9 тегов `<script>`, все с `nonce`, равным nonce из заголовка; два запроса дают разные nonce; ответ статического чанка и prefetch-запрос заголовка не получают; `next dev`: nonce и `'unsafe-eval'`. Headless Chrome открыл `/` без нарушений CSP в консоли; контрольная страница с тем же заголовком и инлайн-скриптом без nonce получила «Executing inline script violates the following Content Security Policy directive». `pnpm lint`, `typecheck`, `format:check`, `deps` зелёные.

## Revisit when

- Реальный трафик на frontend: рендеринг на запрос стал заметной долей нагрузки пода (1 реплика, `cpu 50m`) или нужен кэш на CDN: пересмотреть цену (вернуть к SRI, если Next исправит инлайновые скрипты, либо кэш с хешами).
- Подъём `next`: проверить, получают ли инлайновые bootstrap-скрипты `integrity` при `experimental.sri`; если да, SRI снова вариант без динамического рендеринга.
- Появилась первая UI-библиотека или пользовательское содержимое на страницах: `style-src` на nonce вместо `'unsafe-inline'` (п. 4).
- Первая настоящая страница витрины с SSR: сработал триггер ADR-052 (п. 8).
- Нужны PPR или Cache Components: они несовместимы с nonce (Consequences).
- Выбран frontend-инструмент тестов (ADR-039 п. 7): добавляется тест политики (п. 7).
- Функции нужен `blob:`, `data:` или адрес Spaces (ADR-042 п. 2): расширение политики вместе с функцией, без новой записи, если сужения нет.

## Related

ADR-055 (пп. 1-2 заменены), ADR-038, ADR-040, ADR-011, ADR-052, ADR-063, ADR-005, ADR-042; backlog CSP-2, AUTH-2, SPEC-2.
