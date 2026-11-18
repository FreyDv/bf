# ADR-083: Метрики и алерты: Prometheus, Grafana с алертами в Telegram, Grafana публично на log.malinina.ca (заменяет пункт 5 ADR-043)

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-18 |
| **Author** | агент |
| **Decided by** | агент по поручению владельца (ADR-063); владелец решил в чате 2026-11-16 («делаем и запускаем внутри кластера храним в постоянной памяти которая не убирается при перезагрузке pods») и 2026-11-18: «делаем и запускаем», платные тома, Telegram как единственный канал, Grafana публично на поддомене с входом только через Google. Развилки без слов владельца (движок, пороги, размеры, версии) выбрал агент |
| **Tags** | stack, observability, metrics, alerting, deploy, security, cost |

## Context

- ADR-043 п. 6 оставил метрики отдельной записью: алерт Grafana по LogQL не видит срок сертификата `malinina-ca` (CERT-1) и размер удерживаемого WAL (CDC-3) - у них нет строки лога, это числа. ADR-032 отнёс метрики и трассы в «Revisit when». Эта запись выбирает стек метрик и алертов и **не правит текст ADR-032 и ADR-043**; она заменяет только пункт 5 ADR-043 (доступ к Grafana, ниже п. 9).
- Кода приложения с `/metrics` нет (`apps/`, `packages/`); метрики приложения - позже, с первым модулем. Сейчас метрики дают узлы, поды, Traefik, NATS и проба сертификата.
- Сертификат `malinina-ca` терминируется на балансировщике DO, действует до 2027-02-09, продление не проверено (CERT-1). Просроченный сертификат останавливает сайт целиком.
- Кластер: 3 узла, у каждого 1900m CPU и около 3 ГиБ памяти для подов; requests уже размещённых подов - 23-27% памяти и 29-34% CPU на узел (`kubectl describe nodes`, 2026-11-18). Использование не измерено: `metrics-server` нет (runbook `malinina-kubernetes.md`).
- Новый узел - только владельцем и по замерам (решение владельца 2026-11-18).
- Продуктовые метрики (North Star) - другое, METRICS-1, сюда не входят.
- Метки метрик без телефона, адреса, секретов, токенов (ADR-037, Logging and privacy).

### Что есть что (на простом языке)

Grafana сама ничего не собирает и не хранит: это окно с графиками и рассыльщик алертов. Собирают и хранят другие.

| Что смотрим | Кто собирает | Где лежит | Где видно |
|---|---|---|---|
| Метрики: узлы, поды, Traefik, NATS, срок сертификата | Prometheus сам опрашивает цели раз в 30 секунд (раз в минуту - пробу сертификата) | Prometheus, том 10 ГиБ, 15 дней | Grafana, `https://log.malinina.ca` |
| Логи подов (OBS-2, ещё не поставлено) | Alloy читает логи и отправляет в Loki | Loki, чанки в Spaces, 30 дней (ADR-043) | та же Grafana, источник Loki добавит OBS-2 |
| Алерты по метрикам и (позже) по логам | Grafana сама проверяет правила раз в минуту | правила - файлы в git; состояние алертов - том Grafana 1 ГиБ | сообщение в Telegram владельцу |

## Options considered

| Развилка | Выбрано | Отклонено |
|---|---|---|
| Движок метрик | чарт `prometheus-community/prometheus` (только server; Alertmanager и Pushgateway выключены), подчарты kube-state-metrics и node-exporter | kube-prometheus-stack: оператор и CRD ради 6-8 статических целей, больше подов и памяти; VictoriaMetrics: ещё один стек и диалект запросов без выигрыша на таком числе целей |
| Сборщик | метрики: Prometheus тянет сам; логи: Alloy (ADR-043); один сборщик на один вид данных | Alloy и для метрик (скрейп и remote write в Prometheus): лишний хоп; пересмотр, когда понадобится push снаружи кластера |
| Движок алертов | алертинг Grafana для метрик и логов, правила и contact point - файлы provisioning в git | Alertmanager: второй движок и второй формат правил при уже поставленной Grafana |
| Канал | Telegram-бот, только владельцу (решение владельца 2026-11-18) | другие каналы не рассматривались |
| Доступ к Grafana | публично `https://log.malinina.ca`, вход только Google (решение владельца 2026-11-18) | `kubectl port-forward` (ADR-043 п. 5, заменён); путь `malinina.ca/log`: тот же origin, что у приложения, сессия Grafana досталась бы XSS приложения |
| Срок сертификата | проба blackbox_exporter с модулем только TLS: `probe_ssl_earliest_cert_expiry` | проба HTTP 2xx: 404 или 5xx приложения скрыл бы сертификат; ручная проверка `doctl` остаётся в CERT-1 |

## Decision

1. **Namespace `monitoring`** для всего стека; OBS-2 ставит Loki и Alloy туда же. Три ArgoCD-приложения в `deploy/argocd/`: `prometheus` (с kube-state-metrics и node-exporter), `blackbox-exporter`, `grafana`; автосинк без prune, как у остальной инфраструктуры. Значения Prometheus и Grafana - файлы `deploy/monitoring/prometheus-values.yaml` и `deploy/monitoring/grafana-values.yaml` (раскладка `argo-cd.yaml`, ADR-046).
2. **Версии** (точные, кулдаун 7 дней, ADR-005, даты - поле `created` индекса репозитория, не вторичные сайты): `prometheus` 29.47.1 (v3.16.0, 2026-11-11; 29.47.2 из 2026-11-11 18:50 UTC кулдаун на 2026-11-18 не проходит), подчарты в нём kube-state-metrics 9.0.0 и prometheus-node-exporter 5.1.0; `prometheus-blackbox-exporter` 11.21.2 (v0.29.1, 2026-11-10); `grafana-community/grafana` 14.4.1 (Grafana 13.3.1, 2026-11-10). Чарт Grafana живёт в репозитории `grafana-community`: старый `grafana/grafana` остановился на 10.5.15. Образы - те, что называет чарт; digest для сторонних чартов не закрепляется (ADR-076 покрывает только наши Dockerfile).
3. **Prometheus.** Один под на PVC `do-block-storage-retain`; хранение `15d` и `8GB` (срабатывает то, что раньше: размер не даёт всплеску кардинальности заполнить том и остановить Prometheus). Восемь заданий скрейпа, каждое явное (namespace, метка пода, имя порта), задания по аннотации `prometheus.io/*` выключены: `prometheus` (сам), `kubernetes-nodes` (kubelet, оставлены только `kubelet_volume_stats_*`), `kubernetes-nodes-cadvisor` (оставлены CPU и память контейнеров), `kube-state-metrics`, `node-exporter`, `traefik`, `nats`, `blackbox-tls`. UI Prometheus и blackbox - ClusterIP и `kubectl port-forward`, без Ingress.
4. **Источники.** Traefik: метрики включены обратно (TRAEFIK-3 их выключил до этой записи), порт 9100 назван `metrics`, на Service не выставлен (`ports.metrics.expose.default: false`; Service перечисляет 80 и 443, балансировщик пересылает только порты Service). NATS: `promExporter` включён (sidecar, порт 7777 `prom-metrics`); NetworkPolicy `nats` получила второе правило: 7777/TCP только из namespace `monitoring` (метка `kubernetes.io/metadata.name`), порт 8222 остаётся закрытым. kube-state-metrics: список `collectors` сужен до `pods`, `nodes`, `deployments`, `daemonsets`, `statefulsets`, `persistentvolumeclaims`: по умолчанию в списке `secrets`, и ClusterRole строится из него, то есть читала бы каждый Secret кластера, ключ Sealed Secrets включая. node-exporter слушает адрес узла в VPC (`listenOnAllInterfaces: false`), не все интерфейсы: он в host network.
5. **Срок сертификата.** blackbox_exporter, модуль `tls_expiry` (`prober: tcp`, `tls: true`: рукопожатие TLS и всё; HTTP-запроса нет), цель `malinina.ca:443`, проба раз в минуту (алерт читает последний образец, а разрыв дольше пятиминутного окна Prometheus выглядел бы как «нет данных»). Сбой рукопожатия оставляет метрику без значения - это срабатывает алерт «нет данных», тишины не будет. Service Traefik получил аннотацию `do-loadbalancer-hostname: malinina.ca`: 2026-11-18 из пода `https://malinina.ca` ответил самоподписанным сертификатом, а не `malinina-ca` (соединение не дошло до балансировщика); предположительная причина - Service с IP в статусе достигается внутри кластера, не выходя наружу, а hostname в статусе оставляет нечего подменять. Эффект аннотации **не проверен** (см. Confirmation); без неё проба видит чужой сертификат.
6. **Алерты (Grafana, файлы provisioning).** Пороги - выбор агента, не измерение. Правило, у которого нет данных там, где тишина значила бы «пропало», срабатывает (NoData -> Alerting).

   | Правило | Условие | Ожидание | Серьёзность |
   |---|---|---|---|
   | срок сертификата, предупреждение | от 14 до 30 дней до `probe_ssl_earliest_cert_expiry`; нет данных | 10 мин | warning |
   | срок сертификата, критично | меньше 14 дней; нет данных | 5 мин | critical |
   | цель скрейпа | `up < 1` | 5 мин | warning |
   | под перезапускается | `increase(kube_pod_container_status_restarts_total[30m]) > 2` | 0 | warning |
   | том заполняется | свободно меньше 10% (`kubelet_volume_stats_*`), все PVC, нет данных - не алерт | 15 мин | warning |
   | Prometheus | `up{job="prometheus"} < 1`; нет данных и ошибка запроса - алерт | 5 мин | critical |

   Contact point - Telegram, токен и chat id берутся из переменных окружения (`${TELEGRAM_BOT_TOKEN}`, `${TELEGRAM_CHAT_ID}`), в файлах нет. Политика: группировка по `alertname` и папке, повтор warning раз в 12 часов, critical - раз в час. Alertmanager нет. Правило «Grafana не работает» не существует: упавшая Grafana молчит (Revisit when). Алерт на WAL - п. 10.
7. **Секреты.** Один Sealed Secret `grafana-env` в `monitoring`, пять ключей: `GF_AUTH_GOOGLE_CLIENT_ID`, `GF_AUTH_GOOGLE_CLIENT_SECRET`, `GF_SECURITY_ADMIN_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Источник - `deploy/monitoring/.env.grafana.production` (в git не идёт, `.env.*`); запечатывает `scripts/seal-secret.ts` в режиме сторонних чартов (ADR-060 п. 5) в `deploy/monitoring/grafana-secret/grafana-env.yaml`, команда - в runbook. Каталог - третий источник Application `grafana`: пока файла нет, синк падает, и Grafana не стартует без секрета. Grafana читает всё как переменные окружения (`envFromSecret`); пароль администратора - `admin.existingSecret`, чтобы чарт не завёл свой. `--check` из ADR-060 п. 8 манифест `SealedSecret` не покрывает; шифртекст в нём проверяет тест `pnpm charts:test`.
8. **Хранение.** Платные тома DO одобрены владельцем 2026-11-18: Prometheus 10 ГиБ и Grafana 1 ГиБ, оба `do-block-storage-retain` (том переживает PVC и Application, тарифицируется, пока владелец не удалит вручную). 11 ГиБ по $0.10 за ГиБ в месяц - около $1.10 в месяц (цена - владельца). Состояние Grafana (пользователи, состояние алертов, молчания) - SQLite на её томе: владелец просил хранить в постоянной памяти. Размер томов перемеряется через 1-2 недели (MON-2).
9. **Публичный доступ к Grafana (заменяет пункт 5 ADR-043; остальные пункты ADR-043 действуют).** Grafana доступна на `https://log.malinina.ca`: поддомен, а не `malinina.ca/log` (отдельный origin от приложения). TLS - на балансировщике подстановочным сертификатом `*.malinina.ca`, DNS A `*` уже указывает на балансировщик (runbook, «Вход в кластер»). Ingress через Traefik; заголовки безопасности - на entrypoint (ADR-038 п. 5), лимит частоты - Middleware `grafana-rate-limit` в `monitoring`: 20 запросов в секунду, всплеск 60, по IP клиента (крайняя правая запись `X-Forwarded-For`, `depth: 1`), на под Traefik (шаблон INGRESS-1). Вход только Google OAuth: `[auth.google]`, редирект `https://log.malinina.ca/login/google`, `allow_sign_up=false` и в `[users]`, форма входа скрыта (`disable_login_form`); единственного допущенного пользователя (роль Admin) создаёт руками агент по API после синка, **адрес владельца в репозиторий не пишется**. Чтобы заранее созданный пользователь совпал при первом входе, включён `oauth_allow_insecure_email_lookup` (с Grafana 10.1 вход OAuth ищет пользователя только по id провайдера; флаг защищает от второго провайдера с чужим адресом, а провайдер один - Google, адреса он подтверждает); `skip_org_role_sync` у Google включён, иначе каждый вход сбрасывал бы роль Admin на Viewer. Клиент OAuth владелец создаёт в режиме Testing с собой единственным тестовым пользователем: это второй замок. Пароль администратора - ключ на крайний случай: только API через `kubectl port-forward` (форма скрыта, а базовая аутентификация API включена: публичный `/api` её тоже принимает, защищает длинный пароль, блокировка перебора Grafana и лимит частоты). Дополнительно `cookie_secure`, `cookie_samesite=lax` (редирект Google - межсайтовый переход), собственная политика `content_security_policy` Grafana, анонимный вход и внешние снимки выключены.
10. **Алерт на WAL уходит в CDC-3** (слота репликации ещё нет, CDC-2). Источник - `postgres_exporter` с собственным запросом по `pg_replication_slots`: `pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)` на слот, роль только на чтение (`LOGIN` и `pg_monitor`, без REPLICATION и записи) в отдельном файле `database/roles/` для владельца (красный флаг 1: SQL применяет человек). Установка, роль и порог - строка CDC-3. Метрики управляемой БД DO размер удерживаемого WAL, по исследованию MON-1, не называют (первоисточник не найден). Алерт на WAL **не проверен**: проверять его нечем до CDC-2.
11. **Права и сеть.** ClusterRole Prometheus и kube-state-metrics - только `get`, `list`, `watch`; Prometheus по умолчанию читает и ConfigMap всего кластера (не Secret) - принято. Токен ServiceAccount у них есть: ADR-037 п. 4 (`automountServiceAccountToken: false`) связывает только чарт `app`, это записанный выбор, не исключение; у Grafana, blackbox и node-exporter токена нет, ClusterRole Grafana отключена. node-exporter - host network, hostPID и read-only hostPath (так он видит узел); у namespace нет меток Pod Security Admission (их нет ни у одного namespace кластера). Egress не ограничен (ADR-082): Grafana ходит к Google и Telegram.
12. **Размеры.** Действующие числа живут в значениях `deploy/`; таблица ниже - начальные оценки на день записи, и MON-2 заменяет оценки в `deploy/` и фиксирует замеры в runbook, не переписывая запись. Requests - **оценки**, замеров нет; limits не заданы, как у NATS и Traefik (OOM-убийство на выдуманном потолке теряет голову TSDB). Это сознательное отличие от ADR-043 п. 2.2 («выдуманных цифр запись не вносит»): стек надо поставить сегодня, а замерять нечем. Не поместятся поды - отбрасываются необязательные части (node-exporter, kube-state-metrics, exporter NATS), новый узел не добавляется. Замена оценок замерами - MON-2.

   | Компонент | Requests CPU / память | Том |
   |---|---|---|
   | Prometheus (и config reloader) | 100m / 512Mi (10m / 16Mi) | 10Gi |
   | kube-state-metrics | 10m / 64Mi | - |
   | node-exporter, на узел (3) | 10m / 32Mi | - |
   | blackbox_exporter | 10m / 32Mi | - |
   | Grafana | 50m / 256Mi | 1Gi |
   | exporter NATS (в поде `nats`) | 10m / 32Mi | - |

   Итого около 220m CPU и 1.0 ГиБ памяти requests на кластер.

## Consequences

- Positive: срок сертификата и (после CDC-3) WAL перестали зависеть от ручной проверки; один Grafana и один движок алертов для метрик и логов; правила, дашборд, datasource и contact point - файлы в git, потеря тома теряет только историю.
- Negative: новая публичная поверхность (Grafana на `log.malinina.ca`) там, где ADR-043 её сознательно не добавлял; ставка на Google OAuth и на то, что допущен один пользователь; публичный `/api` принимает базовую аутентификацию администратора.
- Negative: упавшая Grafana молчит; алерта со стороны Prometheus нет (без Alertmanager его правилу некуда отправить), внешнего heartbeat нет.
- Negative: один под Prometheus на PVC: при потере узла том переприсоединяется минуты, метрик в это время нет; то же у Grafana.
- Negative: requests - оценки; размер томов и retention угаданы; проба сертификата идёт изнутри кластера, а не снаружи.
- Negative: каждый том тарифицируется, пока владелец не удалит его вручную после удаления Application.
- Negative: Telegram - зависимость от внешнего сервиса и учётной записи владельца; токен бота в Sealed Secret.
- Negative: ещё пять обновляемых компонентов одного оператора; версии вручную.
- Follow-ups: MON-2 (замеры и замена оценок); CDC-3 (WAL: exporter, запрос, роль, порог); OBS-2 (источник Loki и Alloy в уже стоящей Grafana, Grafana там не ставится); CERT-1 остаётся открытой (владелец проверяет продление `doctl`).

## Confirmation

- Машинно (CI): `pnpm charts` выводит каждый чарт по закреплённой версии с этими значениями; `pnpm charts:test` проверяет: версии точные, всё в `monitoring`, хранение 15d и 8GB на 10Gi retain, у Grafana 1Gi retain и `Recreate`, ClusterRole без глаголов записи, kube-state-metrics без `secrets`, node-exporter на адресе узла, requests на каждом контейнере и ни одного limit, восемь заданий скрейпа и ни одного по аннотации, модуль пробы без HTTP, порт 9100 Traefik не в Service, правило NetworkPolicy NATS на 7777 только из `monitoring`, Grafana: Ingress на `log.malinina.ca` с лимитом частоты, вход только Google, в значениях нет секрета и адреса почты, шесть правил, дашборд «Потребление», шифртекст в `grafana-secret/`, если каталог есть.
- Проверено локально (2026-11-18, до слияния): конфигурация Prometheus проходит `promtool check config --syntax-only`; Grafana 13.3.1 в Docker поднимает provisioning: шесть правил, contact point с chat id из переменной, политика, папка и дашборд; со статической целью Prometheus правила дают ожидаемые состояния (цель `up == 0` - Pending, `up{job="prometheus"}` - Normal, нет данных у сертификата - Pending NoData).
- **Не проверено на кластере, проверяет агент после слияния (живые проверки):** приложения `Synced` и `Healthy`; PVC `Bound`; удалить под Prometheus - старые образцы остались; цели `up == 1`; `probe_ssl_earliest_cert_expiry` соответствует `malinina-ca` (2027-02-09), а не самоподписанному сертификату (**если нет - аннотация `do-loadbalancer-hostname` не помогла, и проба меряет чужой сертификат**); порт 9100 Traefik не открыт на балансировщике; NATS-exporter недоступен из другого namespace; тестовое сообщение contact point в Telegram; вход через Google, а чужой аккаунт не входит. Алерт на WAL не проверен и не работает до CDC-2 и CDC-3.
- Вручную: владелец раз в месяц сверяет счёт DO с $1.10 за тома.

## Revisit when

- Grafana упала и пропущенный из-за этого алерт стоил инцидента, либо появилась пара «алерт не пришёл»: добавить внешний heartbeat (dead man's switch) или Alertmanager с независимым получателем.
- Нужен push метрик снаружи кластера, либо метрики приложения (`/metrics` в backend): пересмотреть сборщик (Alloy) и правило NetworkPolicy.
- MON-2 замерил: requests или тома не те, либо стек не поместился на узлах (решение о новом узле - владельца).
- Проба сертификата не видит сертификат балансировщика и после аннотации: проба снаружи кластера или разовая проверка `doctl`.
- Появилось больше одного пользователя Grafana или публичный вход перестал годиться (атака на `/api`, утечка пароля администратора): вернуть доступ только через `port-forward` или закрыть базовую аутентификацию.
- Prometheus не помещается в 8GB за 15 дней или число серий выросло многократно (кардинальность): сократить срок или перейти на другой движок.
- Одного Telegram-получателя мало (несколько человек, эскалация): отдельная запись.

## Related

ADR-005, ADR-019, ADR-020, ADR-022, ADR-032, ADR-037, ADR-038, ADR-043 (заменён пункт 5), ADR-045, ADR-046, ADR-059, ADR-060, ADR-063, ADR-076, ADR-081, ADR-082; backlog MON-1 (закрыта), MON-2, CERT-1, CDC-3, OBS-2, METRICS-1.
