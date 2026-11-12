# Runbook: malinina (DO Kubernetes)

Serves: владелец-оператор и агент, действующий за него. Снимок состояния на 2026-11-11 - чтобы кластер можно было
сверить и восстановить (ADR-017, backlog RUNBOOK-1). База - отдельно: [bfdb-postgres.md](bfdb-postgres.md).

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

### Что работает в кластере

| Namespace | Содержимое |
|---|---|
| `ingress-nginx` | контроллер (2 пода) - работает |
| `kube-system` | компоненты DO: Cilium, CoreDNS, Hubble, CSI, konnectivity, агенты - работают |
| `argocd` | ArgoCD работает с 2026-11-11: Helm-релиз `argocd` (chart argo-cd 10.11.6, app v3.5.6) `deployed`; Deployment: server 2, repo-server 2, applicationset-controller, dex-server, notifications-controller, redis; StatefulSet application-controller; есть только `AppProject default`, приложений нет, репозиторий и доступ к UI не настроены |
| `default` | пусто |

Не установлено: Sealed Secrets (SEALED-1), NATS (NATS-1), Debezium (CDC-2), Loki и Grafana (OBS-2), чарт `app` (CHART-1), приложения.

## Что видно и требует решения

| # | Находка | Почему важно | Куда |
|---|---|---|---|
| 1 | ArgoCD был в `pending-install`; исправлено 2026-11-11 (ниже) | ArgoCD работает, но ещё не управляет собой из `deploy/argocd/` (ADR-019 п. 1), нет приложений, репозитория и доступа к UI; начальный пароль `argocd-initial-admin-secret` не сменён | RUNBOOK-1 |
| 2 | У `bfdb` не было доверенных источников; с 2026-11-11 разрешены кластер и адрес владельца | узлы кластера имеют публичные IP, но база пускает их по правилу `k8s` | DBSEC-1 закрыт ([bfdb-postgres.md](bfdb-postgres.md)) |
| 3 | Control plane без HA, 3 узла без автомасштабирования | сбой control plane останавливает управление кластером, работающие поды живут; при росте нагрузки узлы не добавятся | решение при росте (бюджет, BUDGET-1) |
| 4 | Автообновление выключено | версия кластера устареет, обновление - ручное в окно обслуживания | RUNBOOK-1 |
| 5 | Нет metrics-server | не работают `kubectl top` и автомасштабирование подов | при появлении нагрузки |
| 6 | Дубль A-записи `@` в DNS | безвреден, но лишний; удалять - действие в консоли DO | RUNBOOK-1 |
| 7 | TLS завершается на балансировщике, внутри кластера http | трафик LB -> узел внутри VPC без шифрования; риск принят в ADR-037; ingress-контроллер, заголовки и IP клиента решены в ADR-038: `ingress-nginx` снят с поддержки и заменяется Traefik (миграция ниже), срок сертификата - CERT-1 | ADR-037, ADR-038, TRAEFIK-1, CERT-1 |
| 8 | Spaces не видны через `doctl` | нужны отдельные ключи Spaces; состояние бакетов не проверено | STACK-2, RUNBOOK-1 |

## Не проверено

- Spaces: имена бакетов, регион, права, ключи.
- Автопродление сертификата и делегирование зоны у регистратора домена.
- Часовой пояс окна обслуживания, расход ресурсов узлов (нет metrics-server).
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

Chart берётся командами `helm repo add argo https://argoproj.github.io/argo-helm` и `helm pull argo/argo-cd --version 10.11.6 --untar`. Значения (`repoServer.replicas=2`, `server.replicas=2`, `ARGOCD_API_SERVER_REPLICAS=2`) лежат в `deploy/argocd/argocd-values.yaml`. CRD ставятся отдельно от Helm: при обновлении chart повторять шаг 2 до `helm upgrade`.
Гипотеза о размере CRD подтверждена косвенно: тот же объект kubectl применил без ошибок, а Helm 4 при первой установке на нём оборвался; точная причина сбоя Helm не доказана.

## Миграция ingress: ingress-nginx -> Traefik (ADR-038, TRAEFIK-1)

Команды ниже не выполнялись: живой кластер, DNS и балансировщик агент не трогает, их запускает владелец. Порядок важен: старый балансировщик работает, пока DNS не переключён.

Условие: ArgoCD-приложение Traefik (chart `traefik/traefik` 42.3.0, ADR-038 п. 3) лежит в `deploy/argocd/` и синхронизировано (TRAEFIK-1). Его Service создаёт **новый** балансировщик DO с новым IP.

1. Полный id сертификата: `doctl compute certificate list --format ID,Name,DNSNames,NotAfter,State` - строка `malinina-ca`. Он нужен для аннотации `service.beta.kubernetes.io/do-loadbalancer-certificate-id` на Service Traefik (вместе с протоколом `http`, TLS-портом 443 и редиректом http -> https, как на старом балансировщике: `doctl compute load-balancer get c2cd5d8d-b9b0-4010-9e79-14e8714bd702`).
2. Новый адрес: `kubectl -n <namespace Traefik> get svc` (поле `EXTERNAL-IP`), `doctl compute load-balancer list --format ID,Name,IP,Status`; дождаться `active`.
3. Проверка до DNS, мимо него: `curl -sI --resolve malinina.ca:443:<новый IP> https://malinina.ca/` (404 от Traefik, пока приложений нет; в ответе `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`) и `curl -sI --resolve malinina.ca:80:<новый IP> http://malinina.ca/` (редирект на https).
4. DNS: `doctl compute domain records list malinina.ca --format ID,Type,Name,Data,TTL`; для каждой записи A `@` и A `*` - `doctl compute domain records update malinina.ca --record-id <id> --record-data <новый IP>`; AAAA `@` - на IPv6 нового балансировщика (`doctl compute load-balancer get <id> -o json`) или удалить. Дубль A `@` убирается здесь же (RUNBOOK-1).
5. Дождаться TTL и сверить: `dig +short malinina.ca`, `dig +short anything.malinina.ca` отдают новый IP.
6. Убрать старый контроллер: `helm -n ingress-nginx uninstall ingress-nginx`; DO удалит старый балансировщик (проверка: `doctl compute load-balancer list`). Namespace `ingress-nginx` удалить вручную, когда пуст.

Откат до шага 6: вернуть в DNS `209.38.12.89` (старый IP). После шага 6 возврата к `ingress-nginx` нет (старый балансировщик удалён), поэтому шаг 6 делается, когда проверка по новому адресу и по DNS прошла.

## Diagnose

- Кластер: `doctl kubernetes cluster get malinina`; узлы: `kubectl get nodes -o wide`.
- Релизы: `helm list -A`; поды: `kubectl get pods -A`.
- Вход: `doctl compute load-balancer get c2cd5d8d-b9b0-4010-9e79-14e8714bd702`, `kubectl -n ingress-nginx get svc,pods`.
- Три вероятные причины недоступности сайта, по убыванию: контроллер ingress или его Service (LB без здоровых узлов); сертификат или DNS; недоступны узлы.

## Rollback

Для кластера отката нет: изменения идут через Helm и ArgoCD (ADR-019), откат - предыдущая ревизия в git. Что делать при потере кластера - порядок восстановления в RUNBOOK-1 (ещё не записан).
