# Runbook: восстановление после потери кластера malinina

Serves: владелец-оператор и агент, действующий за него. Что делать, если кластер `malinina` потерян целиком, и в каком порядке
(ADR-017 п. 4, backlog RUNBOOK-1).

**Порядок не проверялся восстановлением.** Он собран из записанных шагов и ссылок на их разделы; ни один раз целиком не
выполнялся. Команды ниже, кроме трёх установочных шагов ArgoCD, не выполнялись: живой кластер, DNS и облачный аккаунт агент не
трогает, их запускает владелец. Шаги, которых ещё нет в репозитории (Traefik, Debezium, Loki, приложения), названы по строкам
backlog и становятся выполнимыми, когда строки закрыты.

## Границы

Только **потеря кластера `malinina`** (удалён, не поднимается, повреждён). Остальное - вне этого runbook:

| Что | Статус |
|---|---|
| `bfdb` | отдельный управляемый ресурс, кластер его не удаляет и **переживает потерю**; нужно только перенацелить правило доверенных источников на новый кластер (шаг 2). Восстановление из бэкапа DO здесь не описано: на бэкапы полагаться нельзя, пока BACKUP-1 не проверил восстановление ([bfdb-postgres.md](bfdb-postgres.md), Rollback) |
| Spaces | потеря бакета или ключей - вне границы; данные Spaces и их защита - BACKUP-1; ключи - [spaces.md](spaces.md) |
| Аккаунт DO целиком (проект, домен, сертификат, `bfdb`) | вне границы, порядка нет |
| RPO и RTO | **нет записи**: цели не решены, восстановление не проверялось; передано в BACKUP-1 |

Что остаётся вне кластера и нужно для восстановления: репозиторий (публичный, GitHub), менеджер паролей (копия закрытого ключа Sealed
Secrets, Full-access ключ Spaces, пароль `admin` ArgoCD), образы в GHCR (ADR-026), зона DNS `malinina.ca` и сертификат `malinina-ca`
в аккаунте DO (ожидается, что они не зависят от кластера; проверка владельца 1 ниже), `bfdb`, Spaces.

## Порядок

Идентификатор нового кластера отличается от старого (`6269b383-1fee-4f12-b7b2-6b49f4264c26`), и от него зависят шаги 2 и 6.

### 1. Кластер и пул

Параметры из снимка ([malinina-kubernetes.md](malinina-kubernetes.md), «Снимок»): имя `malinina`, регион `tor1`, VPC `default-tor1`,
пул `pool-frei` из 3 узлов `s-2vcpu-4gb` без автомасштабирования, control plane без HA, автообновление выключено, surge-обновление
включено, окно обслуживания ежедневно с 03:00. Версия - ближайшая к `1.37.0-do.2` из `doctl kubernetes options versions`.

Набросок команды (флаги сверить с `doctl kubernetes cluster create --help`, не запускалась):
`doctl kubernetes cluster create malinina --region tor1 --version <версия> --vpc-uuid <id VPC из doctl vpcs list> --node-pool "name=pool-frei;size=s-2vcpu-4gb;count=3" --auto-upgrade=false --surge-upgrade=true --maintenance-window "any=03:00"`.

Затем: `doctl kubernetes cluster kubeconfig save <новый id>`, проверка `kubectl config current-context` (`do-tor1-malinina`) и
`kubectl get nodes` (3 узла `Ready`).

### 2. Доверенные источники `bfdb`

Правило `k8s` в firewall базы указывает на старый id кластера. Перенацелить на новый: `BF_DB_ID=f74f65e6-0691-4550-bdad-a9fa5e108bc1 BF_K8S_ID=<новый id> sh scripts/db-allow-me.sh --force`
(скрипт оставляет два правила: кластер и адрес ноутбука; описание - [bfdb-postgres.md](bfdb-postgres.md), «Доступ с ноутбука»). Проверка:
`doctl databases firewalls list f74f65e6-0691-4550-bdad-a9fa5e108bc1` - правила `k8s` с новым id и `ip_addr`. Пока шаг не сделан, поды
не подключатся к базе.

### 3. ArgoCD

Установка с нуля, три шага: [argocd.md](argocd.md), «Установка с нуля». Затем смена пароля `admin` по тому же runbook (новый пароль
и начальный секрет - как там). Репозиторий подключать отдельно не нужно (публичный URL, без учётных данных).

### 4. Sealed Secrets

`kubectl apply -n argocd -f deploy/argocd/sealed-secrets.yaml`, дождаться контроллера, затем **до первого запечатанного секрета** вернуть
ключи из копии в менеджере паролей и перезапустить контроллер: [malinina-kubernetes.md](malinina-kubernetes.md), «Sealed Secrets»,
«Восстановление после потери кластера». Если копии нет или она снята до ротации - значения перевыпускаются из первоисточников
(ADR-020), в том числе ключи Spaces ([spaces.md](spaces.md), «Создать ключ приложения»). Пока SEALED-2 не выполнен, контроллера и
копии ключа ещё нет: порядок рассчитан на состояние после SEALED-2.

### 5. Приложения платформы

Каждое - свой Application из `deploy/argocd/`; на новом кластере корневое Application применяется руками один раз
(`kubectl apply -n argocd -f deploy/argocd/root.yaml -f deploy/argocd/argo-cd.yaml`, порядок - [argocd.md](argocd.md), «Первое применение»), остальные приходят синхронизацией из `deploy/argocd/` (ADR-046).

| Приложение | Что делать | Состояние на 2026-11-12 |
|---|---|---|
| NATS | `deploy/argocd/nats.yaml`, затем стрим `BF` ([malinina-kubernetes.md](malinina-kubernetes.md), «NATS JetStream»). Том старого кластера (`do-block-storage-retain`) остаётся в DO отдельным ресурсом и новым кластером не подхватывается: события, не прочитанные до потери, потеряны; повторная выдача из `domain_event_outbox` не описана ни в одной записи (ADR-022, ADR-025) | файлы есть, на кластере не ставился (NATS-2) |
| Debezium | перед запуском проверить слот на `bfdb`: слот пережил кластер и копит WAL без предела (`max_slot_wal_keep_size=-1`), пока коннектора нет; запрос - [bfdb-postgres.md](bfdb-postgres.md), Diagnose | нет (CDC-2, CDC-3) |
| Loki, Grafana, Alloy | Application из OBS-2; чанки в бакете Spaces остаются, ключ Loki из Sealed Secret | нет (OBS-2) |
| Backend, frontend | приложения `deploy/apps/<app>/` | нет (DEPLOY-1) |

### 6. Балансировщик, сертификат, DNS

Сервис ingress-контроллера создаёт **новый** балансировщик DO с новым IP. До TRAEFIK-2 контроллер - `ingress-nginx`, поставленный
руками, значения его chart не записаны ([malinina-kubernetes.md](malinina-kubernetes.md), «Не проверено»): точно воспроизвести его нельзя,
поэтому восстановление идёт через Traefik. После TRAEFIK-2: Application Traefik из `deploy/argocd/` создаёт балансировщик сам, когда его
синкает корень (сертификат `malinina-ca` задан в аннотации сервиса по имени, он должен быть в аккаунте DO), затем шаги 5-8 раздела
«Миграция ingress» там же (новый IP, проверка `curl --resolve`, записи A и AAAA в DNS, ожидание TTL). Целевые аннотации сервиса - там же,
«Вход в кластер», целевое состояние после TRAEFIK-2.

### 7. Проверка

- `kubectl -n argocd get applications`: все `Synced` и `Healthy`.
- `curl -sI https://malinina.ca/`: ответ с заголовками из ADR-038 п. 5 (после DEPLOY-1 - страница frontend).
- Логи подов `bf` ищутся в Grafana (после OBS-2).
- Старые ресурсы старого кластера, которые остались и тарифицируются: балансировщик (удаляется ли он вместе с кластером, не проверено;
  `doctl compute load-balancer list`), тома `-retain` (`doctl compute volume list`), записи в firewall базы.

## Проверки владельца (RUNBOOK-2)

1. Что не зависит от кластера: `doctl compute certificate list --format ID,Name,Type,NotAfter,State`, `doctl compute domain list`,
   `doctl databases get f74f65e6-0691-4550-bdad-a9fa5e108bc1` - сертификат, зона и база существуют сами по себе (ожидание, не проверено:
   после удаления кластера сертификат не исчезает). Тип сертификата и срок - CERT-1.
2. Набросок `doctl kubernetes cluster create` в шаге 1 сверить с `--help` и с актуальным `doctl kubernetes cluster get malinina`
   (версия, пул, окно).

## Что порядок не закрывает

- Цели RPO и RTO и проверка восстановления `bfdb`: нет записи, BACKUP-1.
- Реальная репетиция всего порядка: не проводилась. Первая проверка - если кластер придётся пересоздавать (ADR-017, «Revisit when»: неточный
  runbook - повод его менять).
- Восстановление данных Spaces и аккаунта DO: вне границы.

Связано: [malinina-kubernetes.md](malinina-kubernetes.md), [bfdb-postgres.md](bfdb-postgres.md), [argocd.md](argocd.md),
[spaces.md](spaces.md), ADR-017, ADR-019, ADR-020, ADR-038, ADR-045.
