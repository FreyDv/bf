# ADR-090: Тома NATS, Prometheus и Grafana по 10 GiB, привязка к дискам DO описана в git

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-19 |
| **Author** | владелец |
| **Decided by** | владелец, в чате 2026-11-18..19: «события из NATS не могут терятся нужно так же как в случае с GRAFANA персистенс»; «может сразу подключить том?»; «NATS 10 GiB, Prometheus 10 GiB, Grafana 10 GiB давай вот так» |
| **Tags** | platform, storage |

## Context

- Тома NATS (10 GiB), Prometheus (10 GiB) и Grafana (1 GiB) - диски DO с политикой Retain (`do-block-storage-retain`; `kubectl get pv`, 2026-11-19).
- Retain оставляет диск после удаления PVC или кластера, но новый кластер его не находит: он создаёт пустой том, а старый остаётся отдельно.
- Локальный диск узла (240 GiB = 3 × 80 GiB) не подходит: DO стирает его при замене узла (обновление, сбой).

## Options considered

| Вариант | Итог |
|---|---|
| Шаг в runbook: привязать старый диск вручную | отклонён владельцем: «может сразу подключить том?» |
| Локальный диск узла | отклонён: теряется при замене узла |
| PersistentVolume с идентификатором диска DO и привязкой к PVC - в git | выбран |

## Decision

1. Для каждого из трёх томов в git описан PersistentVolume: `csi.volumeHandle` - идентификатор существующего диска DO, `claimRef` - PVC его приложения, Retain. Новый кластер в том же регионе подключает старый диск сам.
2. Размер: NATS 10 GiB, Prometheus 10 GiB, Grafana 10 GiB. Grafana растёт с 1 до 10 GiB на месте (`allowVolumeExpansion: true`), около +0,9 доллара в месяц.
3. Шаг runbook про ручную привязку тома не пишется.

## Consequences

- Positive: пересборка кластера не теряет события NATS, историю метрик и состояние Grafana.
- Negative: если диск намеренно удалён, PV надо убрать из git, иначе под ждёт тома.
- Negative: новый кластер должен быть в том же регионе DO.

## Confirmation

`kubectl get pv`: три PV с `volumeHandle` из git и статусом `Bound`; ArgoCD `Synced`; у PVC Grafana ёмкость 10 GiB.

## Revisit when

- Кластер переезжает в другой регион.
- Тому не хватает места или появляется резервная копия стрима.

## Related

ADR-022, ADR-083, ADR-089.
