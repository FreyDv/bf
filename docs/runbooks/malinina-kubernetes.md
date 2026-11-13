# Runbook: malinina (DO Kubernetes)

Serves: владелец-оператор и агент, действующий за него. Снимок состояния на 2026-11-11 - чтобы кластер можно было
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

| Что | Значение |
|---|---|
| Load Balancer | id `c2cd5d8d-b9b0-4010-9e79-14e8714bd702`, REGIONAL, `size_unit=1`, IP `209.38.12.89` (и IPv6), создан сервисом `ingress-nginx-controller`; цели - 3 узла |
| Правила | 80 -> NodePort 31340 (http), 443 -> NodePort 31251 (TLS завершается на LB, дальше http); редирект http -> https включён; проба `:10256/healthz` |
| Сертификат | `malinina-ca` (`b6041d52-...`): `malinina.ca`, `*.malinina.ca`, Let's Encrypt, `verified`, до 2027-02-09; продление DO не проверялось |
| DNS | зона `malinina.ca` на DO (NS `ns1-3.digitalocean.com`): A `@` и A `*` на `209.38.12.89`, ещё один A `@` на тот же адрес (дубль), AAAA `@` на IPv6 балансировщика; AAAA для `*` нет |
| Ingress | `ingress-nginx` 4.15.1 (контроллер v1.15.1, 2 реплики, `IngressClass nginx`), Helm-релиз ревизия 3, `deployed`, поставлен 2026-11-03; снят с поддержки, заменяется Traefik (ADR-038) |

Эта таблица - снимок 2026-11-11 **до TRAEFIK-2**. Миграция создаёт новый балансировщик (новые id, IP и NodePort) и удаляет старый, после
неё таблица устарела и заменяется состоянием ниже (в DoD TRAEFIK-2: «runbook обновлён»).

#### Целевое состояние после TRAEFIK-2 (ADR-038)

| Что | Значение |
|---|---|
| Балансировщик | создаёт Service Traefik; id и IP новые, записываются после миграции |
| Аннотации Service | id сертификата `malinina-ca`, протокол `http`, TLS-порт 443, редирект http -> https (ADR-038 п. 4; точные имена аннотаций - в `deploy/argocd/traefik.yaml`) |
| Доверенные адреса | `forwardedHeaders.trustedIPs` = `10.118.0.0/20` (VPC `default-tor1`), IP клиента из `X-Forwarded-For` (ADR-038 п. 6) |
| TLS | завершается на балансировщике, внутри кластера http (ADR-037, Transport); срок и продление сертификата - CERT-1 |
| DNS | A `@` и A `*` на новый IP, дубль A `@` удаляется на шаге 4 миграции (ниже), AAAA `@` - на новый IPv6 или удаляется |

Проверки владельца (RUNBOOK-2), только чтение; результат - в строку RUNBOOK-2 и, после миграции, в таблицу выше:

- Тип сертификата и полный id: `doctl compute certificate list --format ID,Name,Type,DNSNames,NotAfter,State` (колонка `Type` отличает `lets_encrypt` от `custom`). Верен ли вывод о продлении - CERT-1.
- Балансировщик: `doctl compute load-balancer get c2cd5d8d-b9b0-4010-9e79-14e8714bd702 -o json` - правила, цели, проба, редирект совпадают с таблицей выше.
- DNS: `doctl compute domain records list malinina.ca --format ID,Type,Name,Data,TTL` - дубль A `@` на месте.
- Делегирование зоны у регистратора: `dig NS malinina.ca +short` - `ns1-3.digitalocean.com`.
- Кластер: `doctl kubernetes cluster get 6269b383-1fee-4f12-b7b2-6b49f4264c26 -o json` - автообновление, окно обслуживания и его часовой пояс.

### Что работает в кластере

| Namespace | Содержимое |
|---|---|
| `ingress-nginx` | контроллер (2 пода) - работает |
| `kube-system` | компоненты DO: Cilium, CoreDNS, Hubble, CSI, konnectivity, агенты - работают |
| `argocd` | ArgoCD работает с 2026-11-11: Helm-релиз `argocd` (chart argo-cd 10.11.6, app v3.5.6) `deployed`; Deployment: server 2, repo-server 2, applicationset-controller, dex-server, notifications-controller, redis; StatefulSet application-controller; есть только `AppProject default`, приложений нет, репозиторий и доступ к UI не настроены |
| `default` | пусто |

Не установлено: Sealed Secrets (файлы готовы, установка - SEALED-2), NATS (файлы готовы, установка - NATS-2), Debezium (CDC-2), Loki и Grafana (OBS-2), чарт `app` (CHART-1), приложения.

## Что видно и требует решения

| # | Находка | Почему важно | Куда |
|---|---|---|---|
| 1 | ArgoCD был в `pending-install`; исправлено 2026-11-11 (ниже) | ArgoCD с 2026-11-13 управляет собой и Application из `deploy/argocd/` (ADR-019 п. 1, ARGOCD-2); UI - через port-forward; начальный пароль `argocd-initial-admin-secret` не сменён | пароль - [argocd.md](argocd.md) (RUNBOOK-2) |
| 2 | У `bfdb` не было доверенных источников; с 2026-11-11 разрешены кластер и адрес владельца | узлы кластера имеют публичные IP, но база пускает их по правилу `k8s` | DBSEC-1 закрыт ([bfdb-postgres.md](bfdb-postgres.md)) |
| 3 | Control plane без HA, 3 узла без автомасштабирования | сбой control plane останавливает управление кластером, работающие поды живут; при росте нагрузки узлы не добавятся | решение при росте |
| 4 | Автообновление выключено | версия кластера устареет, обновление - ручное в окно обслуживания | решено: остаётся выключенным, процедура ниже («Обновление кластера вручную») |
| 5 | Нет metrics-server | не работают `kubectl top` и автомасштабирование подов | при появлении нагрузки |
| 6 | Дубль A-записи `@` в DNS | безвреден, но лишний; удалять - действие в консоли DO | решено: удаляется на шаге 4 миграции TRAEFIK-2, не раньше |
| 7 | TLS завершается на балансировщике, внутри кластера http | трафик LB -> узел внутри VPC без шифрования; риск принят в ADR-037; ingress-контроллер, заголовки и IP клиента решены в ADR-038: `ingress-nginx` снят с поддержки и заменяется Traefik (миграция ниже), срок сертификата - CERT-1 | ADR-037, ADR-038, TRAEFIK-1, CERT-1 |
| 8 | Spaces не видны через `doctl` | нужны отдельные ключи Spaces; состояние бакетов не проверено | ADR-042 (решение), [spaces.md](spaces.md), проверки - RUNBOOK-2 |

## Не проверено

- Spaces: имена бакетов, регион, права, ключи ([spaces.md](spaces.md), проверки владельца, RUNBOOK-2).
- Автопродление сертификата (CERT-1) и делегирование зоны у регистратора домена (проверки владельца в разделе «Вход в кластер»).
- Часовой пояс окна обслуживания, расход ресурсов узлов (нет metrics-server).
- Sealed Secrets: чарт отрисован `helm template` (`pnpm charts`), на кластере не ставился; команды раздела ниже не выполнялись; поведение контроллера при `--key-renew-period 0` (число ключей после перезапуска) взято из README апстрима.
- NATS: чарт отрисован `helm template` (`pnpm charts`), на кластере не ставился; команды раздела ниже не выполнялись, включая флаги `nats stream add`; запуск образа с `drop: [ALL]` и без `runAsNonRoot` на томе DO не проверен; размеры стрима и requests - допущения без замеров.
- Traefik: чарт отрисован `helm template` (`pnpm charts`), на кластере не ставился; команды раздела «Миграция ingress» не выполнялись. Не видно без кластера: порядок синка Middleware и CRD, доходит ли http с балансировщика на `websecure` при `tls.enabled=false`, значения DO-аннотаций на новом Service, видит ли Traefik IP клиента (INGRESS-1); requests подов - допущение без замеров.
- Откуда взялась ревизия 3 у `ingress-nginx` и какие значения чарта заданы (`helm get values`).

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

Команды ниже не выполнялись: живой кластер, DNS и балансировщик агент не трогает, их запускает владелец. Порядок важен: старый балансировщик работает, пока DNS не переключён.

Файлы готовы (TRAEFIK-1): ArgoCD-приложение `deploy/argocd/traefik.yaml` (chart `traefik/traefik` 42.3.0, ADR-038 п. 3; namespace `traefik`, 2 реплики; Middleware `security-headers`; `websecure` принимает http от балансировщика; `trustedIPs` = `10.118.0.0/20`). Оно не проверялось на кластере. Его Service создаёт **новый** балансировщик DO с новым IP, поэтому шаг 1 делается до применения, а не после.

1. Полный id сертификата: `doctl compute certificate list --format ID,Name,DNSNames,NotAfter,State` - строка `malinina-ca`. Это идентификатор, не секрет. Подставить его в `deploy/argocd/traefik.yaml` вместо `CERTIFICATE_ID_OF_MALININA_CA` (аннотация `service.beta.kubernetes.io/do-loadbalancer-certificate-id`; остальные три - протокол `http`, TLS-порт 443, редирект - уже в файле, как на старом балансировщике: `doctl compute load-balancer get c2cd5d8d-b9b0-4010-9e79-14e8714bd702`) и закоммитить, чтобы репозиторий совпадал с кластером. В том же коммите убрать `traefik.yaml` из `directory.exclude` в `deploy/argocd/root.yaml` (ADR-046): пока плейсхолдер есть, корневое Application файл не синкает, а `pnpm charts:test` требует исключения. Проверка перед применением: `grep -c CERTIFICATE_ID_OF_MALININA_CA deploy/argocd/traefik.yaml` печатает `0`. Корень применён (ARGOCD-2, 2026-11-13): после слияния коммита в `main` ArgoCD применит файл сам, `kubectl apply` не нужен. Затем `kubectl -n argocd get application traefik` до `Synced` и `Healthy`. Если синк упал на объекте `Middleware`, потому что он дошёл до кластера раньше CRD chart, повторить синк; если не проходит, перенести заголовки в `providers.file` в том же файле (решение владельца 2026-11-12, нового ADR не нужно). Без подстановки id применять нельзя: балансировщик создастся с неверным сертификатом.
2. Новый адрес: `kubectl -n traefik get svc traefik` (поле `EXTERNAL-IP`), `doctl compute load-balancer list --format ID,Name,IP,Status`; дождаться `active`. Заодно проверить два допущения TRAEFIK-1, которые без кластера не видны: подов Traefik два и они `Running` (`kubectl -n traefik get pods`), а у балансировщика правила 80 и 443 в режиме `http` с сертификатом на 443 и включённым редиректом.
3. Проверка до DNS, мимо него: `curl -sI --resolve malinina.ca:443:<новый IP> https://malinina.ca/` (404 от Traefik, пока приложений нет; в ответе `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`) и `curl -sI --resolve malinina.ca:80:<новый IP> http://malinina.ca/` (редирект на https).
4. DNS: `doctl compute domain records list malinina.ca --format ID,Type,Name,Data,TTL`; для каждой записи A `@` и A `*` - `doctl compute domain records update malinina.ca --record-id <id> --record-data <новый IP>`; AAAA `@` - на IPv6 нового балансировщика (`doctl compute load-balancer get <id> -o json`) или удалить. Дубль A `@` убирается здесь же (находка 6).
5. Дождаться TTL и сверить: `dig +short malinina.ca`, `dig +short anything.malinina.ca` отдают новый IP.
6. Убрать старый контроллер: `helm -n ingress-nginx uninstall ingress-nginx`; DO удалит старый балансировщик (проверка: `doctl compute load-balancer list`). Namespace `ingress-nginx` удалить вручную, когда пуст.

Откат до шага 6: вернуть в DNS `209.38.12.89` (старый IP). После шага 6 возврата к `ingress-nginx` нет (старый балансировщик удалён), поэтому шаг 6 делается, когда проверка по новому адресу и по DNS прошла.

## Sealed Secrets: установка, копия ключа, ротация (ADR-020, ADR-045)

Команды ниже не выполнялись: живой кластер агент не трогает, их запускает владелец. Файлы: `deploy/argocd/sealed-secrets.yaml` (чарт `sealed-secrets` 2.22.0, appVersion 0.41.2, `kube-system`, имя `sealed-secrets-controller`, автообновление ключа выключено), открытый сертификат - `deploy/sealed-secrets/pub-cert.pem` (появится после шага 6). Ключи контроллера - Secret в `kube-system` с меткой `sealedsecrets.bitnami.com/sealed-secrets-key` (значения метки у апстрима `active` и `compromised`).

| Что | Значение |
|---|---|
| Контроллер | не установлен (SEALED-2) |
| Последняя ротация ключа | не было; ключ создан при установке |
| Следующая ротация | не позднее чем через год после установки (SEALED-3); дату вписывает владелец сюда |

### Установка (SEALED-2)

1. Предусловия, всё только чтение: `kubectl -n kube-system get secret -l sealedsecrets.bitnami.com/sealed-secrets-key` - пусто (если ключи есть, контроллер подхватит их; не ставить и сообщить агенту: ADR-020 говорит о «существующей паре»); `kubectl -n kube-system get deploy,svc,sa sealed-secrets-controller` - `NotFound` (имя не занято компонентом DO).
2. Ручного шага нет: Application применяет корневое (ADR-046); на `malinina` его развернул первый синк корня 2026-11-13 (ARGOCD-2). На кластере без корня - `kubectl apply -n argocd -f deploy/argocd/sealed-secrets.yaml`.
3. Дождаться: `kubectl -n argocd get application sealed-secrets` - `Synced` и `Healthy`; `kubectl -n kube-system rollout status deploy/sealed-secrets-controller`; `kubectl get crd sealedsecrets.bitnami.com`.
4. Автообновление выключено: `kubectl -n kube-system get deploy sealed-secrets-controller -o jsonpath='{.spec.template.spec.containers[0].args}'` содержит `--key-renew-period` и `0`.
5. Ключ создан: `kubectl -n kube-system get secret -l sealedsecrets.bitnami.com/sealed-secrets-key --no-headers` - одна строка. Перезапустить `kubectl -n kube-system rollout restart deploy/sealed-secrets-controller`, дождаться `rollout status` и посчитать снова: должна остаться одна. Если стало две - апстрим создаёт ключ при каждом старте, сообщить агенту (меняется ADR-045 и порядок копии).
6. Сертификат: поставить `kubeseal` (минорная версия как appVersion контроллера, 0.41; `kubeseal --version`; через Homebrew или из релизов апстрима), затем `mkdir -p deploy/sealed-secrets && kubeseal --fetch-cert > deploy/sealed-secrets/pub-cert.pem`; проверка `openssl x509 -in deploy/sealed-secrets/pub-cert.pem -noout -subject -dates`; закоммитить (это открытый сертификат). Имя и namespace контроллера - умолчания `kubeseal`, флаги `--controller-*` не нужны.
7. Копия закрытого ключа, **только** в менеджер паролей, на диск и в чат не попадает: `kubectl -n kube-system get secret -l sealedsecrets.bitnami.com/sealed-secrets-key -o yaml | pbcopy`, вставить запись в менеджер паролей, затем `pbcopy < /dev/null`. Копия содержит все ключи с меткой, не только новейший.
8. Сообщить результат (шаги 1-7, число ключей, дата) в строке SEALED-2: по нему строка закрывается, SECRETS-1 разблокируется.

### Восстановление после потери кластера

Контроллер ставится тем же Application. Ключи кладутся до первого запечатанного секрета: вставить копию из менеджера паролей в `kubectl apply -f -` (через `pbpaste`), затем `kubectl -n kube-system delete pod -l app.kubernetes.io/name=sealed-secrets` (по README апстрима: ключи вернуть и перезапустить контроллер). Затем `kubectl -n kube-system get secret -l sealedsecrets.bitnami.com/sealed-secrets-key` - те же ключи. Копия, снятая до ротации, не расшифрует то, что запечатано новым ключом: тогда значения перевыпускаются из первоисточников (ADR-020).

### Ротация: раз в год и при подозрении на утечку (ADR-045)

Автообновления нет, ключ меняется только так. При утечке закрытого ключа сначала поменять сами значения (пароль БД, ключ OpenAI, ключи Spaces: ADR-020), иначе новый ключ запечатает старые, уже скомпрометированные значения.

1. Число ключей до: `kubectl -n kube-system get secret -l sealedsecrets.bitnami.com/sealed-secrets-key --no-headers | wc -l`.
2. Новый ключ (по README апстрима, «Early key renewal»): `kubectl -n kube-system set env deploy/sealed-secrets-controller SEALED_SECRETS_KEY_CUTOFF_TIME="$(date -R)"`, дождаться `rollout status`; ключей стало на один больше. Не проверено на кластере.
3. Убрать переменную: `kubectl -n kube-system set env deploy/sealed-secrets-controller SEALED_SECRETS_KEY_CUTOFF_TIME-`, дождаться `rollout status`; число ключей не изменилось (старые остаются и продолжают расшифровывать).
4. Сертификат: `kubeseal --fetch-cert > deploy/sealed-secrets/pub-cert.pem`, закоммитить.
5. Перешифровать секреты каждого приложения новым сертификатом: `pnpm secrets:seal` (SECRETS-1; пока скрипта нет - `kubeseal --raw --cert deploy/sealed-secrets/pub-cert.pem --scope strict --name <секрет> --namespace <namespace>` по одному значению), закоммитить `secrets.yaml`.
6. Обновить копию в менеджере паролей, как шаг 7 установки: все ключи, заменить старую запись целиком.
7. Вписать дату в таблицу выше и завести строку на следующую ротацию.

## NATS JetStream: установка, стрим, проверка (ADR-022)

Команды ниже не выполнялись: живой кластер агент не трогает, их запускает владелец. Файл: `deploy/argocd/nats.yaml` (чарт `nats` 2.15.2 из `https://nats-io.github.io/k8s/helm/charts`, appVersion 2.15.2, образ `nats:2.15.2-alpine`, namespace `bf`). Адрес для Debezium и приложения: `nats://nats.bf.svc:4222`.

| Что | Значение |
|---|---|
| Сервер | не установлен (NATS-2) |
| Состав | StatefulSet `nats` (1 под: сервер и reloader), Service `nats` (ClusterIP, 4222), Deployment `nats-box` (клиент `nats`), PodDisruptionBudget; кластера NATS нет, метрик нет (`promExporter` выключен до MON-1) |
| Образы | `nats:2.15.2-alpine`; `natsio/nats-server-config-reloader` и `natsio/nats-box` - теги, которые несёт чарт 2.15.2; при смене чарта меняются вместе |
| Том | PVC `nats-js-nats-0`, 10Gi, StorageClass `do-block-storage-retain`, без снимков и бэкапа |
| Стрим | не создан; создаёт владелец (шаг 5), создание из git - NATS-5 |

### Что принято

- **Данные.** Стрим - транзитный буфер между Debezium и потребителями. Бэкапа нет; потеря тома - потеря ещё не прочитанных событий (ADR-022, «Revisit when»). Строки `domain_event_outbox` остаются в `bfdb` (ADR-025), но повторная выдача их в стрим не описана ни в одной записи; в NATS-2 это не проверяется.
- **Шифрование тома.** В ответ на строку «Data at rest» ADR-037 (там сказано, что ответ даёт запись, которая ставит NATS): шифрование блочных томов DO в найденной документации не заявлено, считается непроверенным; проверка - BACKUP-1. Класс `-retain` защищает от удаления тома вместе с PVC, а не от чтения данных.
- **Нет аутентификации и NetworkPolicy.** Любой под кластера может публиковать, читать и удалять стрим. Service только ClusterIP, наружу порт не выставлен. Риск принят на время до NATS-3 (аутентификация через Sealed Secret) и NATS-4 (NetworkPolicy). Для приложений политика входа уже в чарте `app` (CHART-3); действует ли она под Cilium, проверяется на первом выкате по `argocd.md`, «Проверки владельца на первом выкате», п. 5, и касается NATS-4 так же.
- **Namespace `bf`.** Логи NATS входят в охват сборщика ADR-043 (`bf`), окружение одно (ADR-038).
- **Requests** 100m / 256Mi без limits и 10Gi тома - допущения: metrics-server нет. Пересмотр после MON-1.
- **Жёсткость пода.** У чарта нет значения `securityContext`, поэтому `allowPrivilegeEscalation: false`, `drop: [ALL]`, `seccompProfile: RuntimeDefault` и отказ от токена ServiceAccount заданы через `merge` чарта. `runAsNonRoot` и read-only root не заданы: пользователь образа и владелец тома без кластера не проверены.

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
4. JetStream включён: `kubectl -n bf exec deploy/nats-box -- nats server check jetstream` или `nats account info` - JetStream включён, лимит хранилища 10 GiB (контекст `default` смотрит на сервис `nats`; если нет - `nats -s nats://nats:4222 ...`).
5. Создать стрим (флаги по документации `nats` CLI, не запускались; при отказе сверить с `nats stream add --help` и сообщить агенту):
   `kubectl -n bf exec deploy/nats-box -- nats stream add BF --subjects 'BF.>,bf.>' --storage file --retention limits --replicas 1 --max-age 7d --max-bytes 6GiB --max-msgs -1 --max-msg-size -1 --max-msgs-per-subject -1 --max-consumers -1 --discard old --defaults`
   Проверка: `kubectl -n bf exec deploy/nats-box -- nats stream info BF` - те же subjects, лимиты, `Replicas: 1`, хранение `File`.
6. Публикация и чтение: `kubectl -n bf exec deploy/nats-box -- nats pub BF.TEST.SMOKE.OK hello`, затем `kubectl -n bf exec deploy/nats-box -- nats stream get BF --last-for BF.TEST.SMOKE.OK` - то же сообщение.
7. Перезапуск не теряет данные: `kubectl -n bf delete pod nats-0`, дождаться `kubectl -n bf rollout status sts/nats`, повторить `nats stream get` из шага 6 - сообщение на месте.
8. Убрать пробу: `kubectl -n bf exec deploy/nats-box -- nats stream purge BF --subject BF.TEST.SMOKE.OK -f`.
9. Сообщить результат (шаги 1-8, версия, размер тома) в строке NATS-2: по нему строка закрывается, CDC-2 разблокируется.

### Откат и сопровождение

- Удаление Application (`kubectl -n argocd delete application nats`) удаляет StatefulSet и Service. PVC от `volumeClaimTemplates` и том остаются: класс `-retain` не удаляет том вместе с PVC; он продолжает тарифицироваться, пока владелец его не удалит (`kubectl -n bf delete pvc nats-js-nats-0`, затем том в консоли DO или `doctl compute volume delete`). События на нём не прочитаны: решить, нужны ли они, до удаления.
- Смена лимитов стрима: `nats stream edit BF ...`; смена размера тома или requests - значения в `deploy/argocd/nats.yaml` и повторное применение. Сужение subjects - CDC-2.
- Обновление: чарт и образ - новая версия в `targetRevision` и `container.image.tag` одним коммитом, не раньше чем через 7 дней после выхода (ADR-005); данные на томе остаются, пока под перезапускается (простой, пока он не поднялся: Debezium стоит, слот копит WAL, ADR-021).

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
- Вход: `doctl compute load-balancer get c2cd5d8d-b9b0-4010-9e79-14e8714bd702`, `kubectl -n ingress-nginx get svc,pods`.
- NATS: `kubectl -n bf get pods,pvc -l app.kubernetes.io/name=nats`; логи `kubectl -n bf logs nats-0 -c nats`; состояние JetStream - `kubectl -n bf exec deploy/nats-box -- nats stream info BF` и `nats server report jetstream`; монитор сервера - `kubectl -n bf port-forward pod/nats-0 8222:8222`, затем `curl -s localhost:8222/jsz`.
- Три вероятные причины недоступности сайта, по убыванию: контроллер ingress или его Service (LB без здоровых узлов); сертификат или DNS; недоступны узлы.

## Rollback

Для кластера отката нет: изменения идут через Helm и ArgoCD (ADR-019), откат - предыдущая ревизия в git. Что делать при потере кластера - порядок восстановления в [recovery.md](recovery.md).
