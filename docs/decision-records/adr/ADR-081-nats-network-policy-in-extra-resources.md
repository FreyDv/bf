# ADR-081: NetworkPolicy для NATS: вход на 4222 только от backend, Debezium и nats-box; политика в `extraResources` чарта `nats` (исполняет ADR-022; дополняет п. 4 ADR-037)

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-16 |
| **Author** | агент |
| **Decided by** | агент по поручению владельца, ADR-063 п. 2 (технические развилки решает агент) |
| **Tags** | deploy, security, nats |

## Context

- П. 4 ADR-037 называет NetworkPolicy только для подов чарта `app` (CHART-3). NATS ставит сторонний чарт `nats` 2.15.2 (ADR-022), там политики нет: ключа `networkPolicy` в `values` нет, есть `extraResources` (`templates/extra-resources.yaml`, проверено `helm show values` для 2.15.2).
- До этой записи любой под кластера мог публиковать, читать и удалять стрим (риск принят, runbook «NATS JetStream»; без аутентификации по решению владельца, ADR-082).
- Cilium политику применяет: проверено на первом выкате 2026-11-15 по NetworkPolicy чарта `app` (`docs/runbooks/argocd.md`, «Проверки владельца на первом выкате», п. 5).
- Метки подов (чарт 2.15.2): сервер `name=nats`, `instance=nats`, `component=nats`; `nats-box` `name=nats`, `instance=nats`, `component=nats-box`. Селектор из `name` и `instance` выбрал бы и `nats-box`, и тестовый под Helm.
- Метки подов приложений: `name=instance=<релиз>` (чарт `app`). Метки Debezium нигде не записаны: Debezium ещё нет (CDC-2).
- Выход (egress) не ограничивается (ADR-082); тип `Egress` в этой политике закрыл бы DNS.

## Options considered

| Развилка | Выбрано | Отклонено |
|---|---|---|
| Где лежит политика | `extraResources` в `valuesObject` Application `nats` (`deploy/argocd/nats.yaml`) | отдельный файл в `deploy/argocd/`: каждый файл там - Application, `scripts/charts.test.ts` проверяет список; отдельный манифест вне Application: новое место для чарта, ради одного объекта |
| Кто допущен | поды `bf` с `app.kubernetes.io/name` из `backend`, `debezium` и `nats-box` | любой под `bf`: ничего не закрывает; `namespaceSelector` на `bf`: то же |
| Селектор NATS | `name`, `instance` и `component=nats` | без `component`: затронуты `nats-box` и тестовый под |
| Типы | только `Ingress` | `Ingress` и `Egress`: закрыл бы DNS; egress не ограничивается (ADR-082) |
| Порты | только 4222/TCP | 8222 (монитор, есть и у Service `nats-headless`), 6222, 7777: другим подам не нужны |

## Decision

1. **Объект.** `NetworkPolicy` `nats` (`networking.k8s.io/v1`) в `bf`, в `extraResources` Application `nats`. `podSelector`: `app.kubernetes.io/name: nats`, `app.kubernetes.io/instance: nats`, `app.kubernetes.io/component: nats`. `policyTypes: [Ingress]`, ключа `egress` нет.
2. **Правило.** Одно правило входа, порт 4222/TCP, два источника (оба `podSelector` без `namespaceSelector`, то есть поды `bf`): (1) `matchExpressions` `app.kubernetes.io/name` `In` [`backend`, `debezium`]; (2) `matchLabels` `app.kubernetes.io/name: nats` и `app.kubernetes.io/component: nats-box`. Пустого источника нет.
3. **Что открыто шире ожидаемого.** Поды релиза `backend` включают Job миграций и CronJob: те же метки, тот же код, это допущено.
4. **Закрыто.** Порты 8222, 6222, 7777 для других подов. Пробы kubelet на 8222 идут с узла, Cilium их пропускает (`argocd.md`, п. 5: поды `app` остаются `Ready` под своими политиками).
5. **Метка Debezium - договор, который выбрал агент.** Запись, которая бы фиксировала метки Debezium, нет. Под Debezium (CDC-2) работает в `bf` с `app.kubernetes.io/name=debezium`; условие добавлено в строку CDC-2 бэклога.
6. **Новый клиент.** Релиз, которому нужен NATS (например, воркер), добавляет своё имя в список `In` в `deploy/argocd/nats.yaml`.
7. **Удаление.** У Application `prune: false`: убрать политику из `values` значит оставить её в кластере; удаляется вручную (`kubectl -n bf delete networkpolicy nats`).
8. **Отношение к ADR-037.** П. 4 ADR-037 покрывает только поды чарта `app`; эта политика лежит в стороннем чарте и допускает `nats-box`, чего строка бэклога не называла. ADR-037 остаётся Accepted и не правится.
9. **Аутентификации нет** (ADR-082): политика сужает, кто доходит до порта, но не проверяет клиента внутри допущенных подов.

## Consequences

- Плюс: под вне списка не доходит до 4222; монитор и порты кластера NATS недоступны другим подам.
- Плюс: нет нового файла, нового чарта и зависимости.
- Минус: метки - единственный признак клиента; любой под `bf` с меткой `name=backend` или `debezium` допущен (кто создаёт поды в `bf`, тот и так доверенный, ADR-038 - одно окружение).
- Минус: Debezium при установке обязан нести метку, иначе соединения не будет (CDC-2).
- Минус: `egress`-политики нет (ADR-082), выход из пода NATS открыт.

## Confirmation

- `scripts/charts.test.ts` (`pnpm charts:test`, блок `NetworkPolicy` в `nats Application`): одна политика `nats`; селектор с `component`; `policyTypes` ровно `[Ingress]`, без `egress`; одно правило; порты ровно 4222/TCP; два источника из п. 2, пустых нет.
- `pnpm charts`.
- Кластер: процедура «Проверка (NATS-4)» в `docs/runbooks/malinina-kubernetes.md` (под `busybox` вне списка не подключается, `nats-box` подключается, `nats-0` остаётся `Ready`).

## Revisit when

- Debezium поставлен с другим набором меток или в другом namespace (CDC-2): п. 2, п. 5.
- Появился релиз, которому нужен NATS: п. 6.
- ADR-082 пересмотрен: введена аутентификация NATS или политики выхода: п. 1, п. 9.
- Чарт `nats` получил свой ключ `networkPolicy`: п. 1.

## Related

ADR-022, ADR-037, ADR-038, ADR-063, ADR-082; backlog NATS-4, CDC-2.
