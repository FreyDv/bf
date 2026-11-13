# ADR-046: Самоуправление ArgoCD: корневое Application, значения из репозитория, синк без prune

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-12 |
| **Author** | агент |
| **Decided by** | агент по поручению владельца (2026-11-12): владелец написал в чате «постарайся все делать сам без моих подтверждений»; варианты ниже выбрал агент, владелец их по отдельности не подтверждал |
| **Tags** | deploy, argocd |

## Context

- ADR-019 п. 1: ArgoCD ставится вручную один раз и дальше управляет всем из `deploy/argocd/`, включая себя. Сейчас он репозиторий не смотрит, три Application (`sealed-secrets`, `nats`, `traefik`) применяются руками.
- ADR-045 (остаётся Accepted, не правится; эта запись уточняет его п. 2 про форму установки: после ARGOCD-2 файлы `sealed-secrets.yaml` и `nats.yaml` применяет корень, а не `kubectl apply`) отклонил для Sealed Secrets «два источника» и «root app-of-apps» как работу ARGOCD-1; этот выбор здесь делается для самого ArgoCD и для всех Application.
- Репозиторий публичный (решение владельца 2026-11-12): ArgoCD читает его по HTTPS без учётных данных.
- В `deploy/argocd/` лежит не только Application: `argocd-values.yaml` - файл значений, а `traefik.yaml` до TRAEFIK-2 хранит плейсхолдер `CERTIFICATE_ID_OF_MALININA_CA`; синк с ним создал бы балансировщик DigitalOcean с неверным сертификатом.
- Живой Helm-релиз `argocd` (chart `argo-cd` 10.11.6) создан с `crds.install=false`: CRD `applicationsets` (около 1,4 МБ) Helm 4 не тянет и он ставится отдельно.
- Манифест нельзя проверить без живого кластера, ошибка в самоуправляемом ArgoCD опасна.

## Options considered

| Развилка | Выбрано | Отклонено |
|---|---|---|
| Значения `argo-cd` | A. два источника: chart и ссылка `ref` на этот репозиторий, `helm.valueFiles: [$values/deploy/argocd/argocd-values.yaml]`; bootstrap читает тот же файл | B. значения inline в Application: два экземпляра правды (файл bootstrap и Application) расходятся |
| Что синкает корень | A. каталог `deploy/argocd/`, `directory.exclude: "{argocd-values.yaml,traefik.yaml}"`; TRAEFIK-2 убирает `traefik.yaml` из исключения в том же коммите, где ставит id сертификата | B. подкаталог только для Application: ломает пути из ADR-045 и runbook; C. исключений нет: синк плейсхолдера |
| Политика синка | A. `automated`, `prune: false`, без `selfHeal`, `ServerSideApply=true`, без `resources-finalizer` у корня и `argo-cd` | B. `selfHeal`: затирает ручную правку без решения человека; C. `prune: true`: удаляет объект ArgoCD по ошибке в файле |
| CRD | A. `crds.install: false` в файле значений, `ServerSideApply=true`; CRD только шагом bootstrap | B. CRD в синке: тот же отказ Helm 4 на `applicationsets` |
| Имя релиза | A. `helm.releaseName: argocd`, namespace `argocd`: рендер даёт живые имена (`argocd-server`, ...), первый синк принимает существующие объекты | B. имя по умолчанию (`argo-cd`): второй ArgoCD рядом с первым |
| `argocd-secret` | A. `configs.secret.createSecret: false`: самосинк не затирает хэш пароля `admin` (RUNBOOK-2); bootstrap задаёт `createSecret=true` в командной строке | B. chart рендерит секрет: самосинк перезаписывает хэш пароля |

## Decision

1. **Корневое Application** `deploy/argocd/root.yaml`: `repoURL: https://github.com/FreyDv/bf`, `targetRevision: main`, `path: deploy/argocd`, `directory.recurse: false`, `exclude: "{argocd-values.yaml,traefik.yaml}"`. Файл `root.yaml` попадает в собственный синк: так и задумано, корень принимает сам себя.
2. **Application `argo-cd`** `deploy/argocd/argo-cd.yaml`: chart `argo-cd` 10.11.6 (репозиторий `https://argoproj.github.io/argo-helm`) и второй источник с `ref: values` на этот репозиторий; значения - только `deploy/argocd/argocd-values.yaml`, inline нет; `helm.releaseName: argocd`, namespace `argocd`.
3. **`argocd-values.yaml`** дополняется `crds.install: false` и `configs.secret.createSecret: false`; bootstrap (runbook) ставит `createSecret=true` в командной строке, чтобы кластер с нуля получил секрет.
4. **Синк** корня и `argo-cd`: `automated`, `prune: false`, без `selfHeal`, `ServerSideApply=true`, без `resources-finalizer`: удаление Application не удаляет развёрнутое.
5. **`traefik.yaml`** исключён из корня до TRAEFIK-2.
6. **Helm-релиз `argocd` остаётся записью**, но `helm upgrade`, `helm rollback` и `helm uninstall` для него запрещены после ARGOCD-2. Обновление - смена `targetRevision` в git плюс ручной шаг CRD; откат - `git revert`.
7. **Первое применение** корня и `argo-cd` на кластере - отдельная строка владельцу, ARGOCD-2; агент кластер не трогает.
8. **Проверка без кластера:** `scripts/lib/argocd-application.ts` читает `helm.valueFiles` и `releaseName`, `pnpm charts` рендерит chart с файлом значений, `pnpm charts:test` проверяет имена, отсутствие CRD и `argocd-secret`, политику синка и исключения корня.

## Consequences

- Positive: одна правда о значениях ArgoCD; добавление файла Application в `deploy/argocd/` разворачивает его без `kubectl apply`; плейсхолдер сертификата не доходит до балансировщика; ручная правка пароля и CRD самосинком не затираются.
- Negative: без `prune` удаление файла Application не удаляет объект, его удаляет человек (`kubectl delete`); без `selfHeal` ручной дрейф остаётся, пока кто-то не заметит.
- Negative: после ARGOCD-2 Helm-запись `argocd` устаревает и не должна использоваться; кто выполнит `helm upgrade` по старой инструкции, получит расхождение с git. Закрыто запретом в runbook, а не техникой.
- Negative: `targetRevision: main` - любое слияние в `main` сразу применяется к самому ArgoCD, пауз между слиянием и применением нет; защита - обязательные проверки `main` и отсутствие `prune`.
- Negative: поведение первого синка (принятие существующих объектов Helm, хуки `pre-install` chart как PreSync, секреты `argocd-redis` и `argocd-notifications-secret`) проверено только `helm template`; на кластере не запускалось (ARGOCD-2).
- Follow-ups: ARGOCD-2 (первое применение и проверка), TRAEFIK-2 (снять исключение `traefik.yaml`).

## Confirmation

`pnpm charts` и `pnpm charts:test` (CI запускает их при изменении `deploy/argocd/`): тест фиксирует версию chart, `ref` на этот репозиторий, имя релиза, живые имена объектов, отсутствие CRD и `argocd-secret`, `prune: false` без `selfHeal` и finalizer, набор исключений корня и то, что `traefik.yaml` исключён, пока в нём плейсхолдер. Остальное проверяет владелец в ARGOCD-2.

## Revisit when

- Первый синк на кластере показал, что объекты Helm не приняты без пересоздания (тогда меняется способ, не решение о самоуправлении).
- Репозиторий становится приватным: нужен способ доступа с учётными данными (runbook, «Подключение репозитория»).
- ArgoCD стал синкать продуктовые приложения: пересмотреть `selfHeal` и `prune`.
- Вышел chart `argo-cd` новее 10.11.6, прошедший окно ADR-005 (меняется версия, не решение).

## Related

ADR-005, ADR-019, ADR-020, ADR-038, ADR-045; backlog ARGOCD-1, ARGOCD-2, TRAEFIK-2, RUNBOOK-2.
