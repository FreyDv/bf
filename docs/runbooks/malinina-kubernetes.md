# Runbook: malinina (DO Kubernetes)

Serves: владелец-оператор и агент, действующий за него. Снимок состояния на 2026-11-11, вход в кластер обновлён 2026-11-14 (TRAEFIK-2) - чтобы кластер можно было
сверить и восстановить (ADR-017, backlog RUNBOOK-1). База - отдельно: [bfdb-postgres.md](bfdb-postgres.md); хранилище -
[spaces.md](spaces.md); ArgoCD - [argocd.md](argocd.md); потеря кластера - [recovery.md](recovery.md).

Источники: `doctl kubernetes | compute | projects | registry` и `kubectl get` / `helm list` (контекст `do-tor1-malinina`),
только чтение; содержимое Secret не читалось.

## Снимок

| Что | Значение |
|---|---|
| Кластер | `malinina`, id `6269b383-1fee-4f12-b7b2-6b49f4264c26`, создан 2026-11-03, состояние `running` |
| Версия | Kubernetes 1.37.0-do.2; автообновление выключено, surge-обновление включено |
| Control plane | не HA (`ha` не включён) |
| Окно обслуживания | ежедневно с 03:00, 4 часа (UTC не проверялся) |
| Узлы | пул `pool-frei`, 3 x `s-2vcpu-4gb`, без автомасштабирования; Debian 13, containerd 2.3.3, у узлов публичные IP |
| Сеть | VPC `default-tor1` (`6ebd4d4a-...`, 10.118.0.0/20), pod 10.108.0.0/16, service 10.109.0.0/19; CNI Cilium (с Hubble), CRD Gateway API и `GatewayClass cilium` есть |
| Хранилище | StorageClass `do-block-storage` (по умолчанию, Delete), `-retain`, `-xfs`, `-xfs-retain`; томов и PVC нет |
| Реестр образов | DO Container Registry не используется (образы - GHCR, ADR-026) |
| Проект DO | `first-project` (`6859e6e4-...`, по умолчанию), в нём же `bfdb` |
| Cloud firewall | `k8s-6269b383-...-worker`: вход только из частных сетей (10/8, 172.16/12, 192.168/16); `k8s-public-access-...`: входящих правил нет |
| Metrics API | недоступен (нет metrics-server): `kubectl top` и HPA не работают |

### Вход в кластер: Load Balancer, сертификат, DNS

Состояние на 2026-11-14, после TRAEFIK-2 (ADR-038). Старый балансировщик `ingress-nginx` (`c2cd5d8d-...`, `209.38.12.89`) удалён.

| Что | Значение |
|---|---|
| Load Balancer | id `77882fbb-5a96-4620-bacf-549e1dba0bee`, тип `REGIONAL` (HTTP-балансировщик), `active`, IPv4 `209.38.0.223`, IPv6 `2604:a880:cad:d0:0:1:d312:8001`; создан Service `traefik` в namespace `traefik` при синке Application `traefik` |
| Правила | 80 http -> http, 443 https -> http с сертификатом `b6041d52-2a99-4f99-bcc9-9060e58eff45` (это `malinina-ca`, найден по имени), редирект http -> https включён (`redirect_http_to_https: true`) |
| Сертификат | `malinina-ca`: `malinina.ca`, `*.malinina.ca`, Let's Encrypt, CN `malinina.ca`, до 2027-02-09; продление DO не проверялось (CERT-1); в аннотации Service задан по имени, не по id |
| DNS | зона `malinina.ca` на DO (NS `ns1-3.digitalocean.com`), TTL каждой записи - 300: A `@` (`1837993633`) и A `*` (`1837993634`) на `209.38.0.223`, AAAA `@` (`1838012116`) на `2604:a880:cad:d0:0:1:d312:8001`; AAAA для `*` нет; дубль A `@` (`1838012115`) удалён. `dig` через `ns1.digitalocean.com`, `1.1.1.1`, `8.8.8.8` отдаёт эти адреса |
| Ingress | Traefik: chart `traefik/traefik` 42.3.1 (с 2026-11-16, TRAEFIK-3: PDB, разнос по узлам, лог JSON; метрики включены в MON-1, ADR-083), образ `traefik:v3.7.17`, 2 пода в namespace `traefik`, Application `traefik` `Synced` и `Healthy` с 2026-11-14 (ArgoCD, `deploy/argocd/traefik.yaml`) |
| Проверка | `curl --resolve` на `209.38.0.223`: `:443` на любой путь - `404 page not found` от Traefik (приложений за ним ещё нет, DEPLOY-1); `:80` - 307 на `https://malinina.ca/` (делает балансировщик). Браузер владельца показывает `404 page not found` на `https://malinina.ca/` |

#### Что записано в Service Traefik (ADR-038)

| Что | Значение |
|---|---|
| Аннотации | сертификат `malinina-ca` по имени (`do-loadbalancer-certificate-name`, не по id: id Let's Encrypt меняется при продлении), тип `do-loadbalancer-type: REGIONAL`, протокол `http`, TLS-порт 443, редирект http -> https (ADR-038 п. 4; точные имена - в `deploy/argocd/traefik.yaml`); `do-loadbalancer-hostname: malinina.ca` с MON-1 (ADR-083 п. 5, проверка - раздел «Мониторинг») |
| Порты Service | только 80 и 443; порт метрик 9100 (с MON-1) есть в поде и не в Service, балансировщик его не пересылает |
| Доверенные адреса | `forwardedHeaders.trustedIPs` = `10.118.0.0/20` (VPC `default-tor1`), IP клиента из `X-Forwarded-For` (ADR-038 п. 6; что видит Traefik на деле - раздел «Лимит частоты и IP клиента») |
| TLS | завершается на балансировщике, внутри кластера http (ADR-037, Transport); срок и продление сертификата - CERT-1 |

#### Лимит частоты и IP клиента (INGRESS-1)

Лимит - Middleware `rateLimit` из чарта `app`, включается в `ingress.rateLimit` приложения; значения и их причина - в `deploy/apps/<app>/values.yaml`. Счёт по IP клиента и отдельно в каждом поде Traefik (ADR-037): при двух репликах клиент проходит примерно вдвое больше заданного. Пробы kubelet идут в под напрямую и в лимит не попадают. Ответ сверх лимита - `429` от Traefik.

Проверено 2026-11-17 до выката, на временном `traefik/whoami` в namespace `ingress-check` (удалён) за Middleware `ipAllowList` с тем же `ipStrategy`, что у лимита (Traefik берёт IP одним и тем же кодом):

| Allowlist маршрута | Запрос | Ответ | Вывод |
|---|---|---|---|
| только адрес владельца, `depth: 1` | обычный | 200 | `depth: 1` - адрес клиента |
| только VPC `10.118.0.0/20`, `depth: 1` | обычный | 403 | на `depth: 1` нет адреса узла или балансировщика |
| только `203.0.113.7/32`, `depth: 1` | с `X-Forwarded-For: 203.0.113.7` | 403 | свой `X-Forwarded-For` клиента ключ не меняет: балансировщик дописывает настоящий адрес правее |
| VPC и поды, без `ipStrategy` (адрес соединения) | обычный | 200 | соединение приходит с внутреннего адреса узла (`10.118.0.3`-`.5`, `externalTrafficPolicy: Cluster`) - внутри `trustedIPs` |

Что доходит до приложения: `X-Forwarded-For: <клиент>, <узел>` и `X-Real-Ip: <узел>`. Адрес узла Traefik дописывает при проксировании, после middleware, поэтому лимит берёт `depth: 1`, а `notAppendXForwardedFor` не нужен. Приложение, которому понадобится IP клиента, берёт вторую запись справа в `X-Forwarded-For` (два доверенных прокси: балансировщик и Traefik), не `X-Real-Ip`.

Проверка после выката, с ноутбука: `seq 1 300 | xargs -P 60 -I{} curl -s -o /dev/null -w '%{http_code}\n' https://malinina.ca/api/health | sort | uniq -c` - среди ответов есть `429`; та же команда с `-H 'X-Forwarded-For: 203.0.113.{}'` - тоже есть `429`; через несколько секунд одиночный запрос снова `200`.

Выполнено 2026-11-17 после выката (оба Middleware в `bf`, приложения `Synced` и `Healthy`): `/api/health` - 84 `200` и 216 `429` из 300; с подделанным `X-Forwarded-For` - 82 и 218; через 6 секунд снова `200`. `/` (600 запросов, 80 параллельно) - 595 `200` и 5 `429`: у frontend запас больше, а страницы отвечают медленнее.

#### Находки миграции TRAEFIK-2 (2026-11-13..14)

1. **Тип балансировщика.** DOKS с 1.33.1-do.0 по умолчанию создаёт для нового Service `LoadBalancer` тип `REGIONAL_NETWORK`: TCP pass-through (tcp-правила 80 и 443), без сертификата, без редиректа, без IPv6. Первый балансировщик (`8acd35ac-6328-4b5b-8304-a722a8b191ca`, `146.190.191.49`) был именно такого типа. Тип существующего балансировщика не меняется: после #53 (аннотация `do-loadbalancer-type: REGIONAL`) ArgoCD применил её, а cloud-controller-manager DO за секунды вернул `REGIONAL_NETWORK`. Лечение: `kubectl -n traefik delete svc traefik` (DO удалил тот балансировщик), синк ArgoCD пересоздал Service, и создался новый нужного типа. С аннотацией в файле на новом кластере тип верный сразу.
2. **Заголовки только на запросах с маршрутом.** Traefik применяет middleware точки входа лишь к запросу, который совпал с каким-то роутером: безмаршрутный 404 не получает заголовков безопасности (на нём только `x-content-type-options`). Проверено через временный диагностический `IngressRoute` (путь `/__diag` -> `noop@internal`, сразу удалён): пришли все четыре заголовка со значениями ADR-038: `strict-transport-security: max-age=31536000`, `x-content-type-options: nosniff`, `referrer-policy: strict-origin-when-cross-origin`, `x-frame-options: DENY`. Решение владельца 2026-11-14: принято как поведение Traefik; заголовки проверяются на запросе с маршрутом (DoD DEPLOY-1: `curl -sI https://malinina.ca/`).
3. **DNS-записи от DO.** Когда к новому балансировщику цепляется сертификат Let's Encrypt, DO сам добавляет записи A `@` и AAAA `@` на него (были `1838457238` A `@` и `1838457239` AAAA `@`, TTL 3600; оттуда же взялся старый дубль A `@`). Лишние записи удаляются, а `doctl compute domain records update` без `--record-ttl` сбрасывает TTL в 3600: TTL указывать всегда.

Проверки владельца (RUNBOOK-2), только чтение:

- Тип сертификата и полный id: `doctl compute certificate list --format ID,Name,Type,DNSNames,NotAfter,State` (колонка `Type` отличает `lets_encrypt` от `custom`). Верен ли вывод о продлении - CERT-1.
- Балансировщик: `doctl compute load-balancer get 77882fbb-5a96-4620-bacf-549e1dba0bee -o json` - тип, правила, сертификат, редирект совпадают с таблицей выше.
- DNS: `doctl compute domain records list malinina.ca --format ID,Type,Name,Data,TTL` - ровно одна A `@`, одна A `*`, одна AAAA `@`.
- Делегирование зоны у регистратора: `dig NS malinina.ca +short` - `ns1-3.digitalocean.com`.
- Кластер: `doctl kubernetes cluster get 6269b383-1fee-4f12-b7b2-6b49f4264c26 -o json` - автообновление, окно обслуживания и его часовой пояс.

### Что работает в кластере

| Namespace | Содержимое |
|---|---|
| `traefik` | Traefik (2 пода, chart 42.3.1) с 2026-11-14 под ArgoCD, Service `traefik` держит балансировщик (TRAEFIK-2); namespace `ingress-nginx` удалён 2026-11-14 |
| `kube-system` | компоненты DO: Cilium, CoreDNS, Hubble, CSI, konnectivity, агенты - работают |
| `argocd` | ArgoCD работает с 2026-11-11: Helm-релиз `argocd` (chart argo-cd 10.11.6, app v3.5.6) `deployed`; Deployment: server 2, repo-server 2, applicationset-controller, dex-server, notifications-controller, redis; StatefulSet application-controller; есть только `AppProject default`; с 2026-11-13 управляет собой и Application из `deploy/argocd/` (`root`, `argo-cd`, `sealed-secrets`, `nats`, с 2026-11-14 `traefik`; ARGOCD-2, TRAEFIK-2), UI - через port-forward |
| `bf` | NATS JetStream с 2026-11-13: `nats-0` (2/2; с MON-1 3/3 с exporter), `nats-box`, PVC `nats-js-nats-0` 10Gi, стрим `BF` (NATS-2) |
| `monitoring` | Prometheus, kube-state-metrics, node-exporter, blackbox_exporter, Grafana; работают с 2026-11-18 (MON-1, ADR-083), живые проверки - раздел «Мониторинг» |
| `default` | пусто |

Контроллер Sealed Secrets работает в `kube-system` с 2026-11-13, ключ один, сертификат в `deploy/sealed-secrets/pub-cert.pem` и копия ключа в менеджере паролей с 2026-11-14 (SEALED-2). Приложений за Traefik ещё нет (DEPLOY-1). Не установлено: Debezium (CDC-2), Loki и Alloy (OBS-2; Grafana стоит с MON-1), чарт `app` (CHART-1), приложения.

## Что видно и требует решения

| # | Находка | Почему важно | Куда |
|---|---|---|---|
| 1 | ArgoCD был в `pending-install`; исправлено 2026-11-11 (ниже) | ArgoCD с 2026-11-13 управляет собой и Application из `deploy/argocd/` (ADR-019 п. 1, ARGOCD-2); UI - через port-forward; начальный пароль `argocd-initial-admin-secret` не сменён | пароль - [argocd.md](argocd.md) (RUNBOOK-2) |
| 2 | У `bfdb` не было доверенных источников; с 2026-11-11 разрешены кластер и адрес владельца | узлы кластера имеют публичные IP, но база пускает их по правилу `k8s` | DBSEC-1 закрыт ([bfdb-postgres.md](bfdb-postgres.md)) |
| 3 | Control plane без HA, 3 узла без автомасштабирования | сбой control plane останавливает управление кластером, работающие поды живут; при росте нагрузки узлы не добавятся | решение при росте |
| 4 | Автообновление выключено | версия кластера устареет, обновление - ручное в окно обслуживания | решено: остаётся выключенным, процедура ниже («Обновление кластера вручную») |
| 5 | Нет metrics-server | не работают `kubectl top` и автомасштабирование подов; потребление CPU и памяти по namespace, подам и узлам показывает дашборд «Потребление» в Grafana (ADR-083) | автомасштабирование - при появлении нагрузки |
| 6 | Дубль A-записи `@` в DNS | был безвреден, но лишний | сделано 2026-11-14 (TRAEFIK-2): удалён; DO сам добавляет A и AAAA при подключении сертификата, см. находку 3 выше |
| 7 | TLS завершается на балансировщике, внутри кластера http | трафик LB -> узел внутри VPC без шифрования; риск принят в ADR-037; ingress-контроллер, заголовки и IP клиента решены в ADR-038: `ingress-nginx` снят с поддержки и заменён Traefik 2026-11-14 (миграция ниже), срок сертификата - CERT-1 | ADR-037, ADR-038, TRAEFIK-1, CERT-1 |
| 8 | Spaces не видны через `doctl` | нужны отдельные ключи Spaces; состояние бакетов не проверено | ADR-042 (решение), [spaces.md](spaces.md), проверки - RUNBOOK-2 |

## Не проверено

- Spaces: имена бакетов, регион, права, ключи ([spaces.md](spaces.md), проверки владельца, RUNBOOK-2).
- Автопродление сертификата (CERT-1) и делегирование зоны у регистратора домена (проверки владельца в разделе «Вход в кластер»).
- Часовой пояс окна обслуживания, расход ресурсов узлов (нет metrics-server; после MON-1 - дашборд «Потребление», замеры - MON-2).
- Мониторинг (MON-1): ничего из установки на кластере не проверено до слияния, список проверок - раздел «Мониторинг», «Проверки после синка»; алерт на WAL не проверен и не работает до CDC-2 и CDC-3.
- Sealed Secrets: установлен и проверен 2026-11-13..14 (SEALED-2); после перезапуска ключ один. Не проверено: восстановление из копии ключа и ротация (шаги разделов ниже взяты из README апстрима, на кластере не выполнялись).
- NATS: установлен и проверен 2026-11-13 (NATS-2), под с `drop: [ALL]` и без `runAsNonRoot` на томе DO работает; размеры стрима и requests - допущения без замеров.
- Traefik: поставлен и проверен 2026-11-14 (TRAEFIK-2): синк без повтора, http с балансировщика доходит до `websecure` при `tls.enabled=false`. IP клиента проверен 2026-11-17 (раздел «Лимит частоты и IP клиента»). Не проверено: заголовки на ответе настоящего приложения (DEPLOY-1; на временном маршруте все четыре пришли, находка 2); requests подов - допущение без замеров.

## Разбор: почему ArgoCD не установился (2026-11-11, только чтение)

Источники: `helm status | history | get values | get hooks | get manifest argocd -n argocd`, `kubectl get` по каждому объекту манифеста.

| Факт | Значение |
|---|---|
| Релиз | `argocd`, chart `argo-cd` 10.11.6 (app v3.5.6), ревизия 1, `pending-install` ("Initial install underway"), запись создана 2026-11-03 07:10:52; пользовательские значения: `repoServer.replicas=2`, `server.replicas=2` и `ARGOCD_API_SERVER_REPLICAS=2` |
| Клиент Helm | v4.3.1 |
| Хук | `argocd-redis-secret-init` (pre-install) отработал: Secret `argocd-redis` создан 07:11:19 |
| Объекты | в манифесте 55; создано 24 (NetworkPolicy, ServiceAccount, Secret, ConfigMap, CRD `applications` и `appprojects`), не создано 31 (CRD `applicationsets`, 3 ClusterRole, 3 ClusterRoleBinding, 6 Role, 6 RoleBinding, 5 Service, 6 Deployment, 1 StatefulSet) |
| Где оборвалось | на CRD `applicationsets.argoproj.io`: он первый из несозданных в порядке установки Helm; CRD `applications` и `appprojects` созданы 07:11:22 |
| Размер CRD в манифесте | `applicationsets` 1 394 982 байта, `applications` 406 086, `appprojects` 19 592 |
| Событий в namespace | нет |

Вероятная причина (не подтверждена, текст ошибки не сохранился): CRD `applicationsets` почти 1,4 МБ, у etcd и API-сервера предел на размер объекта около 1,5 МБ; Helm 4 применяет объекты серверным применением, которое добавляет `managedFields`, и объект выходит за предел. Установка прервалась с ошибкой или была остановлена клиентом, а запись релиза осталась в `pending-install`.

Исправлено 2026-11-11 с явного разрешения владельца (три записи в кластер, порядок важен):
1. `helm uninstall argocd -n argocd` убрал зависший релиз; CRD `applications` и `appprojects` остались (`helm.sh/resource-policy: keep`).
2. CRD `applicationsets` применён серверным применением из того же chart: `helm template argocd <chart> -n argocd --show-only templates/crds/crd-applicationset.yaml > crd.yaml`, затем `kubectl apply --server-side --force-conflicts -f crd.yaml` - прошёл без ошибок (`Established=True`).
3. `helm install argocd <chart> -n argocd -f deploy/argocd/argocd-values.yaml --set crds.install=false --wait --timeout 10m` - релиз `deployed`, все поды Running за 47 секунд.

Chart берётся командами `helm repo add argo https://argoproj.github.io/argo-helm` и `helm pull argo/argo-cd --version 10.11.6 --untar`. Значения (`repoServer.replicas=2`, `server.replicas=2`, `ARGOCD_API_SERVER_REPLICAS=2`) лежат в `deploy/argocd/argocd-values.yaml`. CRD ставятся отдельно от Helm: при обновлении chart повторять шаг 2 до `helm upgrade`. С ARGOCD-1 файл значений содержит ещё `crds.install=false` и `configs.secret.createSecret=false`, а установка с нуля и самоуправление описаны в [argocd.md](argocd.md); после ARGOCD-2 `helm upgrade`, `helm rollback` и `helm uninstall` для `argocd` запрещены.
Гипотеза о размере CRD подтверждена косвенно: тот же объект kubectl применил без ошибок, а Helm 4 при первой установке на нём оборвался; точная причина сбоя Helm не доказана.

## Миграция ingress: ingress-nginx -> Traefik (ADR-038, TRAEFIK-2)

Выполнена агентом 2026-11-13..14 (ADR-059). Результат: Application `traefik` `Synced` и `Healthy` с первого синка, Middleware `security-headers` создан без повтора из-за порядка CRD, 2 пода `Running` (chart 42.3.0, `traefik:v3.7.17`); балансировщик `77882fbb-5a96-4620-bacf-549e1dba0bee`, `REGIONAL`, `active`, IPv4 `209.38.0.223`; DNS на нём. Старый `ingress-nginx` (Helm-релиз ревизия 3, chart 4.15.1) снят `helm uninstall`, старый балансировщик `c2cd5d8d-b9b0-4010-9e79-14e8714bd702` (`209.38.12.89`) удалён DO, namespace `ingress-nginx` удалён. Фактический порядок: TTL AAAA `@` 3600 -> 300 (2026-11-13), `helm uninstall` (2026-11-14) до того, как ArgoCD подхватил #52, слияние #52 (сертификат по имени, `traefik.yaml` убран из исключения корня), на шаге 4 первый балансировщик оказался типа `REGIONAL_NETWORK` (находка 1), слияние #53 (`do-loadbalancer-type: REGIONAL`), пересоздание Service, DNS. Находки 1-3 - выше, в «Вход в кластер». Сайт не отвечал между `helm uninstall` и переключением DNS (простой допустим: приложений за ним не было).

Ниже процедура для повтора на новом кластере (восстановление, [recovery.md](recovery.md)); там `ingress-nginx` уже нет, шаги 1-3 пропускаются, а с аннотацией типа в файле Service создаётся нужного типа сразу.

Балансировщик одновременно один (решение владельца 2026-11-13): сначала удаляется `ingress-nginx` вместе со старым балансировщиком, потом слияние в `main` создаёт новый. Шаги выполняет агент (ADR-059): `kubectl`, `helm`, `doctl compute` на чтение и запись DNS; владелец только подтверждает запрос разрешения.

Файлы: ArgoCD-приложение `deploy/argocd/traefik.yaml` (chart `traefik/traefik` 42.3.1, ADR-038 п. 3; namespace `traefik`, 2 реплики; Middleware `security-headers`; `websecure` принимает http от балансировщика; `trustedIPs` = `10.118.0.0/20`). Сертификат задан по имени: аннотация `service.beta.kubernetes.io/do-loadbalancer-certificate-name: malinina-ca`. Id подставлять не нужно, и `certificate-id` в файле быть не должно: при двух аннотациях DO берёт id, а id сертификата Let's Encrypt меняется при каждом продлении (CERT-1). Остальные аннотации (тип `REGIONAL`, протокол `http`, TLS-порт 443, редирект) уже в файле. `traefik.yaml` не входит в `directory.exclude` корня (ADR-046), поэтому слияние файла в `main` создаёт Application, а он создаёт балансировщик.

1. Подготовка, только чтение и DNS: сертификат на месте под точным именем `malinina-ca` и в состоянии `verified`: `doctl compute certificate list --format ID,Name,DNSNames,NotAfter,State` (имя - то, что в аннотации; id не нужен). Записи DNS: `doctl compute domain records list malinina.ca --format ID,Type,Name,Data,TTL`; у AAAA `@` снизить TTL до 300: `doctl compute domain records update malinina.ca --record-id <id> --record-ttl 300` (`--record-ttl` указывать всегда, иначе TTL станет 3600), и дождаться старого TTL, чтобы клиенты не держали адрес старого балансировщика дольше пяти минут.
2. Убедиться, что корень применён: `kubectl -n argocd get applications` (`root`, `argo-cd`, `sealed-secrets`, `nats`). Если `ingress-nginx` ещё стоит, `traefik` до его удаления синкаться не должен (два балансировщика сразу не нужны).
3. Убрать старый контроллер (если он есть): `helm -n ingress-nginx uninstall ingress-nginx`; DO удалит старый балансировщик, проверка: `doctl compute load-balancer list` его не содержит. Namespace `ingress-nginx` удалить, когда пуст. Назад к `ingress-nginx` пути нет.
4. Слить PR с `traefik.yaml` в `main`: синк корня создаёт Application `traefik`, `kubectl -n argocd get application traefik` до `Synced` и `Healthy`, `kubectl -n traefik get pods` - два пода `Running`. На `malinina` Middleware создался без повтора; если синк всё же упал на `Middleware` раньше CRD chart, повторить синк, а если не проходит - перенести заголовки в `providers.file` в том же файле (решение владельца 2026-11-12, нового ADR не нужно). Сразу проверить тип балансировщика (шаг 5): при `REGIONAL_NETWORK` - `kubectl -n traefik delete svc traefik` и синк (находка 1).
5. Новый адрес: `kubectl -n traefik get svc traefik` (поле `EXTERNAL-IP`), `doctl compute load-balancer list --format ID,Name,IP,Status`; дождаться `active`; `doctl compute load-balancer get <id> -o json`: тип `REGIONAL`, правила 80 и 443 в режиме `http`, сертификат `malinina-ca` на 443, редирект включён, есть ли IPv6.
6. Проверка до DNS, мимо него: `curl -sI --resolve malinina.ca:443:<новый IP> https://malinina.ca/` - 404 от Traefik (пока приложений нет). Это доказывает, что http с балансировщика доходит до `websecure` при `tls.enabled=false`. Заголовков безопасности на безмаршрутном 404 нет (находка 2): их видно на запросе с маршрутом. `curl -sI --resolve malinina.ca:80:<новый IP> http://malinina.ca/` вернёт редирект на https, но его делает сам балансировщик, и до Traefik запрос не доходит, поэтому доказательством он не служит.
7. DNS: подключение сертификата к балансировщику добавляет в зону записи A `@` и AAAA `@` от самого DO (находка 3). Оставить по одной A `@`, A `*` и AAAA `@`, лишние удалить; для оставшихся `doctl compute domain records update malinina.ca --record-id <id> --record-data <новый адрес> --record-ttl 300`. Если у балансировщика нет IPv6, AAAA `@` удалить.
8. Дождаться TTL и сверить: `dig +short malinina.ca`, `dig +short anything.malinina.ca` отдают новый IP, `dig +short AAAA malinina.ca` - новый IPv6 или пусто; проверить через `ns1.digitalocean.com`, `1.1.1.1`, `8.8.8.8`.

Отката к `ingress-nginx` нет. При сбое Traefik чинится вперёд правкой `deploy/argocd/traefik.yaml` и слиянием.

## Sealed Secrets: установка, копия ключа, ротация (ADR-020, ADR-045)

Установка выполнена 2026-11-13..14 (SEALED-2): шаги 1-5 - агент (ADR-059), шаги 6 и 7 - владелец. Файлы: `deploy/argocd/sealed-secrets.yaml` (чарт `sealed-secrets` 2.22.0, appVersion 0.41.2, `kube-system`, имя `sealed-secrets-controller`, автообновление ключа выключено), открытый сертификат - `deploy/sealed-secrets/pub-cert.pem`. Ключи контроллера - Secret в `kube-system` с меткой `sealedsecrets.bitnami.com/sealed-secrets-key` (значения метки у апстрима `active` и `compromised`).

| Что | Значение |
|---|---|
| Контроллер | работает с 2026-11-13, образ `bitnami/sealed-secrets-controller:0.41.2`, `1/1`; аргументы содержат `--key-renew-period 0` |
| Ключ | один: `sealed-secrets-key296td`, метка `active`, создан 2026-11-13 21:20:44 UTC (через 6 с после CRD, то есть самим контроллером: чужих ключей не было); после `rollout restart` 2026-11-14 контроллер подхватил его же («registered private key»), новый не создал |
| Сертификат | `deploy/sealed-secrets/pub-cert.pem`, действует 2026-11-13 21:20:44 - 2036-11-10 21:20:44 UTC, subject пустой (самоподписанный), SHA-256 `51:BE:86:BC:A6:4E:B6:9E:FA:AB:E8:94:7A:D6:37:5B:D1:C0:03:53:E2:31:15:55:7D:FA:74:96:4D:B5:8F:E0`; срок сертификата не срок ротации |
| Копия ключа | в менеджере паролей владельца с 2026-11-14 (1 ключ) |
| `kubeseal` | 0.41.2 (Homebrew) |
| Последняя ротация ключа | не было; ключ создан при установке |
| Следующая ротация | не позднее 2027-11-13 (SEALED-3) |

Агент не может создать, прочитать или проверить `deploy/sealed-secrets/pub-cert.pem`: запрет `Read(**/*.pem)` в `.claude/settings.json` закрывает и открытый сертификат, а разрешение запрет не снимает. Поэтому шаг 6 установки и шаг 4 ротации выполняет владелец (команда целиком - в шаге 6); остальные команды раздела агент выполняет сам (ADR-059).

### Установка (SEALED-2)

1. Предусловия, всё только чтение: `kubectl -n kube-system get secret -l sealedsecrets.bitnami.com/sealed-secrets-key` - пусто (если ключи есть, контроллер подхватит их; не ставить и сообщить агенту: ADR-020 говорит о «существующей паре»); `kubectl -n kube-system get deploy,svc,sa sealed-secrets-controller` - `NotFound` (имя не занято компонентом DO).
2. Ручного шага нет: Application применяет корневое (ADR-046); на `malinina` его развернул первый синк корня 2026-11-13 (ARGOCD-2). На кластере без корня - `kubectl apply -n argocd -f deploy/argocd/sealed-secrets.yaml`.
3. Дождаться: `kubectl -n argocd get application sealed-secrets` - `Synced` и `Healthy`; `kubectl -n kube-system rollout status deploy/sealed-secrets-controller`; `kubectl get crd sealedsecrets.bitnami.com`.
4. Автообновление выключено: `kubectl -n kube-system get deploy sealed-secrets-controller -o jsonpath='{.spec.template.spec.containers[0].args}'` содержит `--key-renew-period` и `0`.
5. Ключ создан: `kubectl -n kube-system get secret -l sealedsecrets.bitnami.com/sealed-secrets-key --no-headers` - одна строка. Перезапустить `kubectl -n kube-system rollout restart deploy/sealed-secrets-controller`, дождаться `rollout status` и посчитать снова: должна остаться одна. Если стало две - апстрим создаёт ключ при каждом старте, сообщить агенту (меняется ADR-045 и порядок копии).
6. Сертификат: поставить `kubeseal` (минорная версия как appVersion контроллера, 0.41; `kubeseal --version`; через Homebrew или из релизов апстрима), затем владелец (не агент, см. выше): `mkdir -p deploy/sealed-secrets && kubeseal --fetch-cert > deploy/sealed-secrets/pub-cert.pem && openssl x509 -in deploy/sealed-secrets/pub-cert.pem -noout -subject -dates -fingerprint -sha256 && git add deploy/sealed-secrets/pub-cert.pem`; вывод `openssl` можно показать агенту, коммит делает он (это открытый сертификат). Имя и namespace контроллера - умолчания `kubeseal`, флаги `--controller-*` не нужны.
7. Копия закрытого ключа, **только** в менеджер паролей, на диск и в чат не попадает: `kubectl -n kube-system get secret -l sealedsecrets.bitnami.com/sealed-secrets-key -o yaml | pbcopy`, вставить запись в менеджер паролей, затем `pbcopy < /dev/null`. Копия содержит все ключи с меткой, не только новейший.
8. Сообщить результат (шаги 1-7, число ключей, дата) в строке SEALED-2: по нему строка закрывается, SECRETS-1 разблокируется.

### Восстановление после потери кластера

Контроллер ставится тем же Application. Ключи кладутся до первого запечатанного секрета: вставить копию из менеджера паролей в `kubectl apply -f -` (через `pbpaste`), затем `kubectl -n kube-system delete pod -l app.kubernetes.io/name=sealed-secrets` (по README апстрима: ключи вернуть и перезапустить контроллер). Затем `kubectl -n kube-system get secret -l sealedsecrets.bitnami.com/sealed-secrets-key` - те же ключи. Копия, снятая до ротации, не расшифрует то, что запечатано новым ключом: тогда значения перевыпускаются из первоисточников (ADR-020).

### Ротация: раз в год и при подозрении на утечку (ADR-045)

Автообновления нет, ключ меняется только так. При утечке закрытого ключа сначала поменять сами значения (пароль БД, ключ OpenAI, ключи Spaces: ADR-020), иначе новый ключ запечатает старые, уже скомпрометированные значения.

1. Число ключей до: `kubectl -n kube-system get secret -l sealedsecrets.bitnami.com/sealed-secrets-key --no-headers | wc -l`.
2. Новый ключ (по README апстрима, «Early key renewal»): `kubectl -n kube-system set env deploy/sealed-secrets-controller SEALED_SECRETS_KEY_CUTOFF_TIME="$(date -R)"`, дождаться `rollout status`; ключей стало на один больше. Не проверено на кластере.
3. Убрать переменную: `kubectl -n kube-system set env deploy/sealed-secrets-controller SEALED_SECRETS_KEY_CUTOFF_TIME-`, дождаться `rollout status`; число ключей не изменилось (старые остаются и продолжают расшифровывать).
4. Сертификат: владелец - той же командой, что шаг 6 установки; закоммитить.
5. Перешифровать секреты каждого приложения новым сертификатом: `pnpm secrets:seal` из корня (скрипт каждого приложения читает его `.env.production` и `.env.<имя>.production` и переписывает `deploy/apps/<app>/secrets.yaml`, ADR-060), закоммитить `secrets.yaml`. Секреты сторонних чартов (NATS и другие) - `node scripts/seal-secret.ts --env <файл> --name <секрет> --namespace <ns> --out <путь>`; файл `.env` должен быть в `.gitignore`.
6. Обновить копию в менеджере паролей, как шаг 7 установки: все ключи, заменить старую запись целиком.
7. Вписать дату в таблицу выше и завести строку на следующую ротацию.

## NATS JetStream: установка, стрим, проверка (ADR-022)

Команды ниже выполнены владельцем на `malinina` 2026-11-13 (NATS-2); для нового кластера - тот же порядок. Файл: `deploy/argocd/nats.yaml` (чарт `nats` 2.15.2 из `https://nats-io.github.io/k8s/helm/charts`, appVersion 2.15.2, образ `nats:2.15.2-alpine`, namespace `bf`). Адрес для Debezium и приложения: `nats://nats.bf.svc:4222`.

| Что | Значение |
|---|---|
| Сервер | работает с 2026-11-13, NATS 2.15.2, `nats-0` (NATS-2) |
| Состав | StatefulSet `nats` (1 под: сервер и reloader), Service `nats` (ClusterIP, 4222), Deployment `nats-box` (клиент `nats`), PodDisruptionBudget; кластера NATS нет; метрики - sidecar `prom-exporter` на 7777 (MON-1, ADR-083) |
| Образы | `nats:2.15.2-alpine`; `natsio/nats-server-config-reloader` и `natsio/nats-box` - теги, которые несёт чарт 2.15.2; при смене чарта меняются вместе |
| Том | PVC `nats-js-nats-0`, 10Gi, StorageClass `do-block-storage-retain`, без снимков и бэкапа |
| Стрим | `BF` создан владельцем 2026-11-13 (шаг 5); создание из git - NATS-5 |
| Вход | NetworkPolicy `nats` (NATS-4, ADR-081): на 4222/TCP пускает поды `backend`, `debezium` и `nats-box`; аутентификации нет (ADR-082) |

### Что принято

- **Данные.** Стрим - транзитный буфер между Debezium и потребителями. Бэкапа нет; потеря тома - потеря ещё не прочитанных событий (ADR-022, «Revisit when»). Строки `domain_event_outbox` остаются в `bfdb` (ADR-025), но повторная выдача их в стрим не описана ни в одной записи; в NATS-2 это не проверяется.
- **Шифрование тома.** В ответ на строку «Data at rest» ADR-037 (там сказано, что ответ даёт запись, которая ставит NATS): шифрование блочных томов DO в найденной документации не заявлено, считается непроверенным; проверка - BACKUP-1. Класс `-retain` защищает от удаления тома вместе с PVC, а не от чтения данных.
- **Нет аутентификации.** Любой, кто дошёл до порта 4222, может публиковать, читать и удалять стрим. Service только ClusterIP, наружу порт не выставлен. Риск принят владельцем: сервис внутренний, паролей не будет (ADR-082). Кто до порта доходит - ниже, «Кто может подключаться».
- **Namespace `bf`.** Логи NATS входят в охват сборщика ADR-043 (`bf`), окружение одно (ADR-038).
- **Requests** 100m / 256Mi без limits и 10Gi тома - допущения: metrics-server нет. Замена замерами - MON-2 (замер по дашборду «Потребление»).
- **Жёсткость пода.** У чарта нет значения `securityContext`, поэтому `allowPrivilegeEscalation: false`, `drop: [ALL]`, `seccompProfile: RuntimeDefault` и отказ от токена ServiceAccount заданы через `merge` чарта. `runAsNonRoot` и read-only root не заданы: пользователь образа и владелец тома без кластера не проверены.

### Кто может подключаться (NATS-4, ADR-081)

Политика лежит в `extraResources` файла `deploy/argocd/nats.yaml`, объект `NetworkPolicy` `nats` в `bf`. Cilium применяет её (проверено на NetworkPolicy чарта `app`, `argocd.md`, «Проверки владельца на первом выкате», п. 5).

- Ограничен только вход (`Ingress`); выход пода NATS не ограничен (ADR-082).
- Порт 4222/TCP принимает поды `bf` с меткой `app.kubernetes.io/name` из списка `backend`, `debezium` и под `nats-box` (`name=nats`, `component=nats-box`). Поды релиза `backend` (миграции и CronJob несут те же метки) тоже входят.
- Порт 7777/TCP (метрики) принимает только namespace `monitoring` (MON-1, ADR-083). Остальные порты пода (монитор 8222, 6222) для других подов закрыты; пробы kubelet идут с узла и проходят.
- Новый клиент: добавить имя его релиза (метка `app.kubernetes.io/name` его подов) в список `values` у `matchExpressions` политики в `deploy/argocd/nats.yaml`, слить в `main`; ArgoCD применит. Debezium (CDC-2) обязан работать в `bf` с меткой `app.kubernetes.io/name=debezium`.
- Удаление политики из значений не удаляет её в кластере (`prune: false` у Application): убрать вручную, `kubectl -n bf delete networkpolicy nats`.

#### Проверка (NATS-4)

1. Политика на месте: `kubectl -n bf get networkpolicy nats`.
2. Под вне списка не подключается (должно завершиться ошибкой, код выхода не 0):
   `kubectl -n bf run np-probe --rm -i --restart=Never --image=busybox:1.37 -- nc -z -w 3 nats 4222`
3. `nats-box` подключается (должно пройти):
   `kubectl -n bf exec deploy/nats-box -- nats server check connection --server nats://nats:4222`
   (или `kubectl -n bf exec deploy/nats-box -- nats stream ls`).
4. `nats-0` остаётся `Ready` (`2/2`): `kubectl -n bf get pod nats-0`.

Проверено 2026-11-16 (политика применена `kubectl apply` до мержа, ADR-059, затем её принял ArgoCD): `busybox` вне списка не подключился ни к `nats:4222`, ни к `nats-headless:8222`, при этом DNS у него работал; `nats-box` прошёл `server check connection`; под `backend` открыл TCP на `nats:4222`; `nats-0` `Ready` без перезапусков через минуту после применения; `cilium-dbg endpoint list` показывает у `nats-0` `POLICY (ingress) Enabled`; `kubectl port-forward pod/nats-0 18222:8222` отдал `/healthz` 200.

### Стрим `BF`

Один стрим на события и задачи воркеров (ADR-022 п. 2), отдельного стрима для задач пока нет. Subjects: `BF.>` (формат ADR-025 п. 10: `BF.<AGG>.<LIFECYCLE>.<EVENT>`) и `bf.>` (локальный Debezium без роутинга пишет в `bf.<схема>.<таблица>`, ADR-033). Узкий набор и то, как строка outbox попадает в нужный subject, определяет CDC-2: тогда стрим сужается до одного случая.

| Параметр | Значение | Заметка |
|---|---|---|
| Хранение | `limits`, `file`, 1 реплика | ADR-022 |
| `max_age` | 7 дней | допущение, пока нет замеров потока |
| `max_bytes` | 6GiB | допущение; том 10Gi, запас под служебные данные и файловую систему |
| `discard` | `old` | при переполнении старые события удаляются молча; доставка «как минимум один раз» (ADR-025 п. 11) защищает от повторов, но не от такой потери |

### Установка (NATS-2)

1. Предусловия, только чтение: `kubectl -n bf get sts,svc,pvc -l app.kubernetes.io/name=nats` - пусто; `kubectl get sc do-block-storage-retain` существует. Контроллер Sealed Secrets для NATS не нужен.
2. Ручного шага нет: Application применяет корневое (ADR-046); на `malinina` его развернул первый синк корня 2026-11-13 (ARGOCD-2). На кластере без корня - `kubectl apply -n argocd -f deploy/argocd/nats.yaml`. Namespace `bf` создаётся, если его нет.
3. Дождаться: `kubectl -n argocd get application nats` - `Synced` и `Healthy`; `kubectl -n bf rollout status sts/nats`; `kubectl -n bf get pods,pvc -l app.kubernetes.io/name=nats` - под `nats-0` в `2/2 Running`, PVC `Bound` (10Gi, `do-block-storage-retain`), под `nats-box` в `Running`. Если под в `CrashLoopBackOff`: `kubectl -n bf logs nats-0 -c nats`; вероятная причина - права на том (см. «Что принято», жёсткость пода): сообщить агенту, не править руками.
4. JetStream включён: `kubectl -n bf exec deploy/nats-box -- nats account info` - есть раздел `JetStream Account Information`. Лимит 10 GiB задан на сервере (`max_file_store` в ConfigMap `nats-config`), а у аккаунта `$G` `Storage` показан как `Unlimited` - это ожидаемо (контекст `default` смотрит на сервис `nats`; если нет - `nats -s nats://nats:4222 ...`).
5. Создать стрим (значения через `=`: с пробелом CLI принимает `-1` за флаг и падает с `expected argument for flag '--max-msgs'`):
   `kubectl -n bf exec deploy/nats-box -- nats stream add BF --subjects='BF.>,bf.>' --storage=file --retention=limits --replicas=1 --max-age=7d --max-bytes=6GiB --max-msgs=-1 --max-msg-size=-1 --max-msgs-per-subject=-1 --max-consumers=-1 --discard=old --defaults`
   Команда сама печатает конфигурацию стрима (или `nats stream info BF`): subjects `BF.>`, `bf.>`, `Replicas: 1`, `File`, `Limits`, `Old`, 7 дней, 6.0 GiB, остальное без ограничений.
6. Публикация и чтение: `kubectl -n bf exec deploy/nats-box -- nats pub BF.TEST.SMOKE.OK hello`, затем `kubectl -n bf exec deploy/nats-box -- nats stream get BF --last-for BF.TEST.SMOKE.OK` - то же сообщение.
7. Перезапуск не теряет данные: `kubectl -n bf delete pod nats-0`, дождаться `kubectl -n bf rollout status sts/nats`, повторить `nats stream get` из шага 6 - сообщение на месте.
8. Убрать пробу: `kubectl -n bf exec deploy/nats-box -- nats stream purge BF --subject BF.TEST.SMOKE.OK -f`.
9. Сообщить результат (шаги 1-8, версия, размер тома) агенту: на `malinina` выполнено 2026-11-13, NATS-2 закрыта.

### Откат и сопровождение

- Удаление Application (`kubectl -n argocd delete application nats`) удаляет StatefulSet и Service. PVC от `volumeClaimTemplates` и том остаются: класс `-retain` не удаляет том вместе с PVC; он продолжает тарифицироваться, пока владелец его не удалит (`kubectl -n bf delete pvc nats-js-nats-0`, затем том в консоли DO или `doctl compute volume delete`). События на нём не прочитаны: решить, нужны ли они, до удаления.
- Смена лимитов стрима: `nats stream edit BF ...`; смена размера тома или requests - значения в `deploy/argocd/nats.yaml` и повторное применение. Сужение subjects - CDC-2.
- Обновление: чарт и образ - новая версия в `targetRevision` и `container.image.tag` одним коммитом, не раньше чем через 7 дней после выхода (ADR-005); данные на томе остаются, пока под перезапускается (простой, пока он не поднялся: Debezium стоит, слот копит WAL, ADR-021).

## Мониторинг: Prometheus, Grafana, алерты в Telegram (ADR-083, MON-1)

Что это и зачем простыми словами - в ADR-083, «Что есть что». Файлы: `deploy/argocd/{prometheus,blackbox-exporter,grafana}.yaml`, значения `deploy/monitoring/{prometheus,grafana}-values.yaml`, секрет `deploy/monitoring/grafana-secret/` (создаётся шагом ниже). Размеры, версии, пороги алертов и цена - только в ADR-083, здесь не повторяются (R4). Состояние на 2026-11-18: всё стоит и проверено на кластере (ниже, «Проверки после синка»).

| Что | Значение |
|---|---|
| Namespace | `monitoring`, создают сами Application (`CreateNamespace=true`) |
| Application | `prometheus` (с kube-state-metrics и node-exporter), `blackbox-exporter`, `grafana`; автосинк без prune |
| Тома | PVC Prometheus и PVC Grafana, класс `do-block-storage-retain`: переживают удаление Application и тарифицируются, пока владелец не удалит том вручную (как у NATS, «Откат и сопровождение») |
| Grafana | `https://log.malinina.ca`, вход только Google; Prometheus и blackbox - только `port-forward` |
| Алерты | Telegram-бот владельцу; правила, contact point и политика - файлы в `deploy/monitoring/grafana-values.yaml` |

### Доступ

- **Grafana**: открыть `https://log.malinina.ca` и войти через Google. Допущен один пользователь, создан по шагу «Первый пользователь» ниже; любой другой аккаунт Google получает отказ. Формы пароля нет.
- **Крайний случай** (Google недоступен или пользователь утерян): пароль администратора из менеджера паролей, только API через порт, не наружу:
  `kubectl -n monitoring port-forward svc/grafana 3000:80`, затем `curl -u admin:<пароль> http://127.0.0.1:3000/api/org`. Тот же пароль принимает и публичный `/api` (форма скрыта, базовая аутентификация API включена, ADR-083 п. 9): пароль длинный, и его не вводят нигде, кроме этого порта.
- **Prometheus**: `kubectl -n monitoring port-forward svc/prometheus-server 9090:80`, затем `http://127.0.0.1:9090` (цели - `/targets`).
- **blackbox**: `kubectl -n monitoring port-forward svc/blackbox-exporter 9115:9115`, затем `http://127.0.0.1:9115/probe?module=tls_expiry&target=malinina.ca:443`.

### Что делает владелец до слияния (деньги и аккаунты)

1. **Telegram-бот.** В `@BotFather` команда `/newbot`, токен бота - в менеджер паролей. Написать боту любое сообщение с аккаунта, куда должны приходить алерты; `chat id` агент берёт сам из `getUpdates` бота (токен и id в чат не вставляются, только в файл ниже).
2. **Клиент Google OAuth** (Google Cloud Console, «Credentials», «OAuth client ID», тип Web application): authorized redirect URI ровно `https://log.malinina.ca/login/google`; экран согласия в режиме Testing, единственный тестовый пользователь - сам владелец (второй замок). Client ID и client secret - в менеджер паролей.
3. **Пароль администратора Grafana**: длинный случайный, в менеджер паролей.
4. **Тома**: расход на два тома одобрен владельцем 2026-11-18 (сумма - ADR-083 п. 8).

### Секрет Grafana: запечатать до слияния

Корень репозитория, `kubeseal` в `PATH`, сертификат `deploy/sealed-secrets/pub-cert.pem` (ADR-020, ADR-060 п. 5). Файл `deploy/monitoring/.env.grafana.production` не коммитится (`.env.*` в `.gitignore`, скрипт откажется работать с неигнорируемым):

```
GF_AUTH_GOOGLE_CLIENT_ID=...
GF_AUTH_GOOGLE_CLIENT_SECRET=...
GF_SECURITY_ADMIN_PASSWORD=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

Значения - строго по ADR-060 п. 3: без пустых, без повторов, `#` в значении только в кавычках. Затем:

```
node scripts/seal-secret.ts --env deploy/monitoring/.env.grafana.production --name grafana-env --namespace monitoring --out deploy/monitoring/grafana-secret/grafana-env.yaml
```

Имя `grafana-env` и namespace `monitoring` нельзя менять: шифртекст привязан к ним (строгая область), а Grafana читает секрет по этому имени. Пока каталога `deploy/monitoring/grafana-secret/` нет, Application `grafana` не синхронизируется (это нарочно: Grafana без секрета не стартует); так и было между слиянием MON-1 (#97) и секрета (#98). `pnpm charts:test` проверяет, что значения в файле - шифртекст. gitleaks пропускает в этом файле и в `deploy/apps/*/secrets.yaml` только строки целиком в форме шифртекста kubeseal (исключение в `.gitleaks.toml`, запись в `exceptions` манифеста, ADR-060): без него правило `generic-api-key` принимает шифртекст под именем вроде `GF_AUTH_GOOGLE_CLIENT_SECRET` за ключ. Смена любого значения - правка `.env`, повтор команды, коммит; под Grafana перезапустится по новому секрету вручную (`kubectl -n monitoring rollout restart deploy/grafana`).

### Первый пользователь Grafana (после первого синка)

С `allow_sign_up=false` вход через Google работает только для пользователя, который уже есть. Адрес владельца в репозиторий не записывается: он берётся из окружения команды и нигде не сохраняется.

```
kubectl -n monitoring port-forward svc/grafana 3000:80 &
export GF_ADMIN_PASSWORD=<пароль администратора>
export OWNER_EMAIL=<адрес Google владельца>
curl -s -u admin:"$GF_ADMIN_PASSWORD" -H 'Content-Type: application/json' \
  -d "{\"name\":\"owner\",\"email\":\"$OWNER_EMAIL\",\"login\":\"owner\",\"password\":\"$(openssl rand -base64 33)\"}" \
  http://127.0.0.1:3000/api/admin/users
# ответ содержит "id"; дать роль Admin в организации 1:
curl -s -u admin:"$GF_ADMIN_PASSWORD" -X PATCH -H 'Content-Type: application/json' \
  -d '{"role":"Admin"}' http://127.0.0.1:3000/api/orgs/1/users/<id>
```

Пароль созданного пользователя случайный и нигде не нужен (входят через Google). Первый вход - `https://log.malinina.ca`, кнопка Google, тот же адрес.

### Проверки после синка (живые)

1. `kubectl -n argocd get applications prometheus grafana blackbox-exporter`: `Synced` и `Healthy`; `kubectl -n monitoring get pods,pvc`: поды `Running`, оба PVC `Bound`.
2. Данные переживают перезапуск: запомнить в Prometheus `count(up)` и самую раннюю точку (`/graph`, диапазон 1 час), `kubectl -n monitoring delete pod -l app.kubernetes.io/name=prometheus,app.kubernetes.io/component=server`, дождаться пода и убедиться, что точки старше удаления остались. То же у Grafana: правило и дашборд на месте, пользователь не потерян.
3. Цели: `/targets` Prometheus, все `up`; `up == 0` пусто.
4. Сертификат: `(probe_ssl_earliest_cert_expiry - time()) / 86400` около числа дней до 2027-02-09, и **это не самоподписанный сертификат**. Если пробы нет или даты не те - проба видит не балансировщик: аннотация `do-loadbalancer-hostname` не помогла (ADR-083 п. 5, Revisit when); проверить вручную `kubectl run` с `curl -v https://malinina.ca` из пода и сравнить с `doctl compute certificate list --format ID,Name,NotAfter,State`.
5. Порт 9100 Traefik не на балансировщике: `kubectl -n traefik get svc traefik` (порты 80 и 443), `curl --max-time 5 http://209.38.0.223:9100/metrics` не отвечает.
6. NATS-exporter не виден из чужого namespace: `kubectl -n default run np-probe --rm -i --restart=Never --image=busybox:1.37 -- nc -z -w 3 nats.bf.svc 7777` завершается ошибкой, а из `monitoring` (`kubectl -n monitoring run ...`) проходит.
7. Telegram: Grafana, «Alerting» -> «Contact points» -> `telegram-owner` -> «Test»; сообщение приходит. Через API (Grafana 13; старый `/api/alertmanager/grafana/config/api/v1/receivers/test` удалён): `GET /apis/notifications.alerting.grafana.app/v1beta1/namespaces/default/receivers/<имя>` и `POST .../<имя>/test` с телом `{"integration": <spec.integrations[0] из ответа GET>}`; `secureFields` в нём заставляет Grafana взять сохранённый токен.
8. Правило срабатывает: временно понизить порог критичного правила срока сертификата в `deploy/monitoring/grafana-values.yaml` (например, `lt` 14 на `lt` 1000), слить, дождаться срабатывания и сообщения, вернуть значение и слить; либо проверить состояние правил в Grafana, «Alerting» -> «Alert rules» (все шесть видны, `Normal`).
9. Вход: Google пускает владельца; чужой аккаунт Google получает отказ; формы пароля на странице нет; `https://log.malinina.ca` отвечает заголовками безопасности, а повтор запросов быстрее лимита - `429`.

Выполнено 2026-11-18 (Prometheus и blackbox после #97, Grafana после #98):

| # | Результат |
|---|---|
| 1 | три Application `Synced` и `Healthy`; поды `Running`; PVC `prometheus-server` 10Gi и `grafana` 1Gi `Bound` |
| 2 | Prometheus: точки до удаления пода остались. Grafana: после удаления пода на месте пользователь `owner` (Admin), 6 правил, дашборд «Потребление», источник Prometheus |
| 3 | 15 целей, все `up` |
| 4 | `probe_ssl_earliest_cert_expiry` = 2027-02-09 00:21:48 UTC, сертификат балансировщика (не самоподписанный); статус Service Traefik - `hostname: malinina.ca` |
| 5 | у Service только 80 и 443; `209.38.0.223:9100` не отвечает |
| 6 | 7777 закрыт из `bf`, открыт из `monitoring` |
| 7 | тест контакта `success`, сообщение пришло владельцу; `**Firing**` в нём буквально: шаблон Grafana по умолчанию с разметкой, Telegram её не разбирает (косметика) |
| 8 | все шесть правил `ok`, `inactive`; срабатывание с пониженным порогом не проверялось |
| 9 | `/` -> 302 на `/login`, форма пароля скрыта (`disableLoginForm: true`), единственная кнопка - Google; `/login/google` ведёт на `accounts.google.com` с `redirect_uri=https://log.malinina.ca/login/google`, PKCE S256; аноним на `/api/user` - 401; четыре заголовка безопасности есть; 400 запросов `/api/health` по 100 параллельно - 158 `200`, 222 `429`, 20 обрывов на стороне клиента; сертификат `*.malinina.ca`. Вход владельца через Google и отказ чужому аккаунту проверяет владелец в браузере |

Пользователь `owner` создан 2026-11-18 шагом «Первый пользователь Grafana».

### Откат и сопровождение

- Удаление Application не удаляет тома (`-retain`). Чтобы убрать том совсем: `kubectl -n monitoring delete pvc <имя>`, затем том в консоли DO или `doctl compute volume delete`. История метрик Prometheus не восстановится; состояние Grafana (пользователи, алерты, молчания) - тоже.
- Обновление: версия чарта в `targetRevision` Application, не раньше чем через 7 дней после выхода (ADR-005); данные на томах остаются. Подчарты kube-state-metrics и node-exporter приходят с версией чарта `prometheus`.
- Требования и размеры пересматривает MON-2 по дашборду «Потребление»; сюда числа не копируются.
- Алерт на удерживаемый WAL - CDC-3 (ADR-083 п. 10): до тех пор его нет.

## Обновление кластера вручную

Автообновление остаётся выключенным (решение владельца 2026-11-12): control plane без HA и нет проверенного восстановления
([recovery.md](recovery.md)), поэтому версию меняет человек в окно обслуживания. Команды ниже не выполнялись.

1. Раз в месяц: `doctl kubernetes cluster get malinina --format Name,Version` и `doctl kubernetes options versions` - есть ли более новая
   патч-версия или конец поддержки текущей; смотреть заметки к выпуску DO.
2. Перед обновлением: `kubectl get pods -A` без ошибок; если на кластере появились тома или состояние (NATS), решить, что случится
   с ними при замене узлов (surge-обновление включено, узлы заменяются по одному).
3. `doctl kubernetes cluster upgrade malinina --version <версия>`; на время обновления control plane API кластера может быть недоступен
   (HA нет, длительность не проверена), работающие поды живут.
4. После: `kubectl get nodes -o wide` (все узлы `Ready` на новой версии), `kubectl -n argocd get applications`, `helm list -A`.
5. Решение о включении автообновления - отдельная запись, после BACKUP-1.

## Diagnose

- Кластер: `doctl kubernetes cluster get malinina`; узлы: `kubectl get nodes -o wide`.
- Релизы: `helm list -A`; поды: `kubectl get pods -A`.
- Вход: `doctl compute load-balancer get 77882fbb-5a96-4620-bacf-549e1dba0bee`, `kubectl -n traefik get svc,pods`.
- Мониторинг: `kubectl -n monitoring get pods,pvc,ingress`, `kubectl -n argocd get applications prometheus grafana blackbox-exporter`.
- NATS: `kubectl -n bf get pods,pvc -l app.kubernetes.io/name=nats`; логи `kubectl -n bf logs nats-0 -c nats`; состояние JetStream - `kubectl -n bf exec deploy/nats-box -- nats stream info BF` и `nats server report jetstream`; монитор сервера - `kubectl -n bf port-forward pod/nats-0 8222:8222`, затем `curl -s localhost:8222/jsz`.
- Три вероятные причины недоступности сайта, по убыванию: контроллер ingress или его Service (LB без здоровых узлов); сертификат или DNS; недоступны узлы.

## Rollback

Для кластера отката нет: изменения идут через Helm и ArgoCD (ADR-019), откат - предыдущая ревизия в git. Что делать при потере кластера - порядок восстановления в [recovery.md](recovery.md).
