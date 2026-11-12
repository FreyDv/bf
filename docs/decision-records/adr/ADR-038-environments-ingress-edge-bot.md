# ADR-038: Окружения, адреса, ingress, заголовки на границе и бот для коммита тега

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-12 |
| **Author** | агент |
| **Decided by** | агент по поручению владельца (2026-11-12): владелец написал в чате «постарайся все делать сам без моих подтверждений»; варианты ниже выбрал агент, владелец их по отдельности не подтверждал |
| **Tags** | deploy, ingress, security, ci |

## Context

- Строка CI-1 держала пять развилок: окружения, адреса, ingress как компонент кластера, заголовки и IP клиента за балансировщиком, учётка бота для коммита тега (ADR-030). TLS ADR-037 уже решил: он завершается на DO Load Balancer, внутри VPC http.
- Один кластер `malinina` и одна база `bfdb` (ADR-017); компоненты кластера добавляются отдельными записями (ADR-019, раздел «ArgoCD»): эта запись и есть запись про ingress.
- В кластере стоит `ingress-nginx` 4.15.1 (контроллер v1.15.1), поставленный вручную 2026-11-03, не под ArgoCD (`docs/runbooks/malinina-kubernetes.md`). Проект [выведен из эксплуатации](https://github.com/kubernetes/ingress-nginx#retiring): best-effort до марта 2026, дальше ни релизов, ни исправлений уязвимостей; его описывает и [блог Kubernetes](https://www.kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/). Контроллер смотрит в интернет, трафика на нём ещё нет, заменить его сейчас дешевле всего.
- Защита `main` классическая: `enforce_admins`, обязательные проверки `ci`, `image`, `spec-guard`, `secret scan`; `gh api repos/FreyDv/bf/rulesets` вернул `[]` (2026-11-12). Список обхода у классической защиты (`bypass_pull_request_allowances`) относится к [требованиям PR](https://docs.github.com/en/rest/branches/branch-protection), не к обязательным проверкам, поэтому прямой push бота она не пропустит. В [ruleset](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets) обход получают роли, команды и GitHub Apps; `GITHUB_TOKEN` в этом списке не назван.
- Токен GitHub App, в отличие от `GITHUB_TOKEN`, запускает workflow. `ci.yml` стартует на любой push в `main`, а пункт 3 раздела «Тег образа» ADR-019 («сборочные workflow игнорируют изменения `image.yaml`») нигде не выполнен.
- Балансировщик DO в режиме HTTP [сам ставит](https://docs.digitalocean.com/products/networking/load-balancers/details/features/) `X-Forwarded-For`, `X-Forwarded-Proto` и `X-Forwarded-Port`; PROXY protocol есть только у регионального HTTP-балансировщика и требует настройки с обеих сторон.

## Options considered

| Развилка | Выбрано | Отклонено |
|---|---|---|
| Форма записи | один ADR, раздел на решение | ADR на каждый пункт: связанные решения (ingress, заголовки, IP клиента) разошлись бы |
| Окружения | одно, `production` | production плюс staging: две базы или схемы, вдвое больше значений и секретов, повод для продвижения версии (ADR-030) при одном разработчике; окружение на PR: ApplicationSet и динамические базы |
| Адреса | один хост `malinina.ca`, `/api` в backend | два хоста (`api.malinina.ca`): CORS и cookie между доменами, шире CSP |
| Ingress | Traefik по Ingress API под ArgoCD | оставить ingress-nginx: контроллер без патчей на границе, миграция всё равно придёт; Gateway API на Cilium (CRD и `GatewayClass cilium` в кластере есть): не проверено, включён ли Gateway в управляемом Cilium DOKS, в чарте `app` нет шаблона `HTTPRoute` |
| Заголовки | HSTS и базовые на ingress, CSP в Next.js, backend без helmet | всё в приложениях: helmet - новая зависимость, ответы ingress (404, 5xx) без заголовков; всё на ingress: CSP со знанием inline-скриптов Next.js там не выразить |
| Учётка бота | GitHub App, ruleset с App единственным обходом | `GITHUB_TOKEN`: не назван среди участников обхода, классическая защита обязательные проверки не обходит; бот пишет в отдельную ветку или репозиторий манифестов: суперсид ADR-030 и ADR-019, откат уже не `git revert` на `main` |

## Decision

1. **Окружение одно: `production`.** Namespace `bf`, одно ArgoCD-приложение на приложение репозитория (`deploy/apps/<app>/`, ADR-019), слоя окружений в `deploy/` нет. Проверка до выката - локальный compose и e2e на `bf_test` (ADR-033, ADR-036). Второе окружение - пункт «Revisit when».
2. **Один хост `malinina.ca`.** `/` - frontend, `/api` - backend, same-origin, CORS не нужен. Витрина и админка пока делят этот origin, а с ним cookie и лимиты; отдельный origin админки - «Revisit when». UI ArgoCD наружу не публикуется, доступ через `kubectl port-forward`. Префикс `/api` в backend - работа DEPLOY-1 (занесено в её DoD); у chart `app` для него путь `ingress.path`.
3. **Ingress-контроллер: Traefik по Ingress API.** Ставится ArgoCD-приложением из `deploy/argocd/`; chart `traefik/traefik` версии **42.3.0** (appVersion v3.7.17, опубликован 2026-11-03, к 2026-11-12 прошёл кулдаун ADR-005: 9 дней; 42.3.1 вышел 2026-11-06 и кулдаун не прошёл). Эта запись - запись о новой зависимости (ADR-005, красный флаг 3); версия обновляется по правилам ADR-005. Chart `app` меняется только значением `className` по умолчанию (с `nginx` на `traefik`, TRAEFIK-1). `ingress-nginx` выводится: замена - шаги владельца в [`malinina-kubernetes.md`](../../runbooks/malinina-kubernetes.md) (раздел «Миграция ingress»), строка TRAEFIK-1; ничего не ставит агент. Новый Service типа LoadBalancer создаёт новый балансировщик DO с новым IP: сертификат `malinina-ca` переносится аннотацией на новый Service, DNS правится вручную. Gateway API на Cilium отклонён сейчас и возвращается как «Revisit when».
4. **TLS не решается заново:** ADR-037, строка Transport, действует как записано (TLS на балансировщике, http в VPC, редирект http -> https на нём). Новая обязанность этой записи - срок и продление сертификата `malinina-ca` (до 2027-02-09, продление DO не проверено): строка CERT-1. Аннотации нового Service сохраняют id сертификата, протокол `http`, TLS-порт 443 и редирект.
5. **Заголовки на границе.**
   - Ingress: Traefik `Middleware` типа `headers`, подключённый на уровне entrypoint, чтобы заголовки получали и ответы без маршрута: `Strict-Transport-Security` (`stsSeconds=31536000`, без `preload` и без `includeSubDomains`, пока не проверено, что весь домен отдаётся по https), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` (запрет вставки страницы во frame; framing никому не нужен, значение пересматривается при появлении встроенной страницы).
   - HSTS от ingress уместен, хотя Traefik видит http: балансировщик редиректит http на https, поэтому в http-ответ клиент не попадает. У Traefik STS по умолчанию выставляется только на запросы по TLS; здесь нужен `forceSTSHeader: true`.
   - CSP задаёт Next.js (`headers()` в `next.config.ts`): ему известны inline-скрипты и nonce. Строка CSP-1.
   - У backend нет `helmet` и нет новой зависимости.
   - Точная форма подключения Middleware к entrypoint и настройка `websecure` для http от балансировщика (entrypoint в chart по умолчанию ждёт TLS, а порт 443 балансировщика отдаёт http) проверяются при установке (TRAEFIK-1), решение о значениях принято здесь.
6. **IP клиента.** Балансировщик DO в режиме HTTP добавляет `X-Forwarded-For`; PROXY protocol не включается. Traefik доверяет `X-Forwarded-*` только из CIDR VPC `default-tor1` (`10.118.0.0/20`): `forwardedHeaders.trustedIPs` на entrypoint. Лимиты частоты (INGRESS-1, ADR-037) считают по клиентскому адресу из этого заголовка. Что именно считает лимит (дописывает ли Traefik адрес балансировщика в `X-Forwarded-For`, какую глубину брать, нужен ли `notAppendXForwardedFor` из v3.7), проверяется на первом выкате: DoD INGRESS-1.
7. **Бот для коммита тега: GitHub App.** Права `contents: write` и только на репозиторий `FreyDv/bf`; токен выдаёт `actions/create-github-app-token` v3.3.0 (коммит `64ab729a6294000f5aa4a4bc0b73d1f32bc45510`, выпуск 2026-10-12, кулдаун пройден; action закрепляется по SHA, R21). Это новая зависимость, эта запись - её запись. В Actions лежат два секрета: идентификатор App и закрытый ключ (уточняет строку Secrets ADR-037). Защита `main` переносится из классической в **ruleset с теми же обязательными проверками** (`ci`, `image`, `spec-guard`, `secret scan`), PR обязателен, force-push и удаление запрещены; единственный участник обхода - этот App. Люди обход не получают: решение владельца 2026-11-11 «проверки не обходятся» остаётся. Порядок: ruleset создан и проверен, затем снимается классическая защита (иначе она блокирует бота). Создание App, секретов и ruleset - шаги владельца (`docs/runbooks/github-settings.md`, строка BOT-1). Условие ADR-030 п. 3 («проверить, подойдёт ли `GITHUB_TOKEN`») этим решено выбором, ADR-030 не заменяется.
8. **Защита от петли.** Коммит бота не должен запускать сборку, иначе `ci` -> `publish` -> новый тег -> новый коммит. `ci.yml`: триггер `push` получает `paths-ignore: deploy/apps/*/image.yaml` (ADR-019, «Тег образа», п. 3). ArgoCD узнаёт о коммите опросом Git, workflow на нём не нужен (ADR-030).

Эта запись уточняет строки ADR-037: Secrets (что лежит в GitHub Secrets), Transport and headers, Rate limiting and abuse (контроллер выбран). Остальное в ADR-037 не меняется.

## Consequences

- Плюс: на границе поддерживаемый контроллер до первого трафика; заголовки в одном месте; адрес для DEPLOY-1 и расположение `/api` определены.
- Плюс: бот получает настоящее исключение, а люди его не получают.
- Минус: в кластере два ingress-контроллера, пока не закончена миграция; новый балансировщик DO даёт новый IP, нужна правка DNS (A `@`, A `*`, AAAA `@`) и короткое окно, пока трафика нет, риск мал.
- Минус: Traefik - новая зависимость и новый CRD (`Middleware`), которого нет в chart `app`; настройки entrypoint (`websecure`, `trustedIPs`, Middleware) проверяются только на кластере.
- Минус: ruleset взамен классической защиты - ручная миграция владельца; пока она не сделана, DEPLOY-1 не может коммитить тег. Между созданием ruleset и снятием классической защиты действуют обе, строже, чем нужно, но не слабее.
- Минус: HSTS на ингрессе без `includeSubDomains` и `preload`: поддомены не защищены, пока их нет.
- Минус: бот пишет в `main` без обязательных проверок на этом коммите (ADR-030); подстраховка - `helm template` и проверка diff в job (DEPLOY-1). Закрытый ключ App - секрет, чья утечка даёт запись в `main`: он только в Actions и в менеджере паролей владельца.
- Минус: решения приняты агентом по общему поручению владельца, не по каждому пункту; любой пункт можно опровергнуть новой записью.
- Дальше: строки TRAEFIK-1, BOT-1, CERT-1, CSP-1; правки INGRESS-1, CHART-3, DEPLOY-1.

## Confirmation

- Петля: строка `paths-ignore` в `.github/workflows/ci.yml` видна в diff; поведение подтверждает первый коммит тега (DEPLOY-1): workflow `ci` на нём не стартует.
- Контроллер, заголовки, IP клиента: проверяются на кластере при TRAEFIK-1 и INGRESS-1 командами из runbook (`curl -sI` отдаёт заголовки; лимит не считает адрес балансировщика). До тех пор не подтверждено ничем.
- Бот: `gh api repos/FreyDv/bf/rulesets` показывает App в `bypass_actors` и четыре проверки; классическая защита снята (команды в `github-settings.md`). Не подтверждено, пока владелец не выполнил BOT-1.
- Версии: `scripts/self-verify.mjs` не проверяет; кулдаун сверяется по дате выпуска при каждом обновлении (ADR-005).

## Revisit when

- Появляется второе окружение (staging или preview): слой окружений в `deploy/`, продвижение версии между ними (ADR-030).
- Админке нужны свои cookie, лимиты или заголовки: отдельный origin.
- Проверка на кластере (TRAEFIK-1) показывает, что Traefik не получает клиентский IP или не отдаёт заголовки так, как записано.
- Проверка CERT-1 показывает, что продление сертификата не автоматическое, либо трафик выходит из частной сети (тогда пересматривается ADR-037, строка Transport).
- Gateway API на Cilium DOKS проверен и работает: переход на него вместо Ingress API.
- Появляется второй разработчик: бот и ruleset пересматриваются вместе с ADR-030.
- Traefik теряет поддержку или выходит уязвимость без исправления в разумный срок.

## Related

ADR-003, ADR-005, ADR-017, ADR-019, ADR-020, ADR-026, ADR-030, ADR-036, ADR-037; backlog CI-1 (закрыта этой записью), DEPLOY-1, INGRESS-1, CHART-3, TRAEFIK-1, BOT-1, CERT-1, CSP-1; `docs/runbooks/malinina-kubernetes.md`, `docs/runbooks/github-settings.md`.
