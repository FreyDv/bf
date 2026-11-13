# Runbook: ArgoCD

Serves: владелец-оператор и агент, действующий за него. Как ArgoCD ставится с нуля, как открыть его UI, что сделать с начальным
паролем и как устроено самоуправление из `deploy/argocd/` (ADR-019, ADR-038 п. 2, ADR-046, backlog RUNBOOK-1, RUNBOOK-2, ARGOCD-1, ARGOCD-2).

Состояние на 2026-11-12: ArgoCD работает с 2026-11-11 (Helm-релиз `argocd`, chart `argo-cd` 10.11.6, app v3.5.6), есть только
`AppProject default`, репозиторий ArgoCD не смотрит (манифесты самоуправления готовы, ARGOCD-1; первое применение - ARGOCD-2), UI не настроен, `argocd-initial-admin-secret` не менялся.
Подробный снимок кластера и разбор неудачной первой установки - [malinina-kubernetes.md](malinina-kubernetes.md) («Что работает в
кластере», «Разбор: почему ArgoCD не установился»). Команды ниже не выполнялись в том виде, как записаны: живой кластер агент не
трогает, их запускает владелец. Три команды установки выполнялись 2026-11-11 и прошли.

## Установка с нуля (bootstrap)

ArgoCD ставится вручную один раз, дальше им управляют из git (ADR-019 п. 1, ADR-046; самоуправление - раздел ниже). Этот раздел нужен для кластера с нуля.
Контекст `kubectl` - `do-tor1-malinina`, нужен Helm v4 (локальное требование, AGENTS.md, «Commands»). Namespace `argocd` должен
существовать: на новом кластере `kubectl create namespace argocd` (как он появился в первый раз, не записано).

Chart берётся командами `helm repo add argo https://argoproj.github.io/argo-helm` и `helm pull argo/argo-cd --version 10.11.6 --untar`.
Значения - `deploy/argocd/argocd-values.yaml` (`repoServer.replicas=2`, `server.replicas=2`, `ARGOCD_API_SERVER_REPLICAS=2`, `crds.install=false`, `configs.secret.createSecret=false`); те же значения читает Application `argo-cd`. Порядок
важен: Helm 4 не справляется с CRD `applicationsets` (около 1,4 МБ), поэтому CRD ставятся отдельно от Helm.

1. Если есть зависший релиз `pending-install` (так было 2026-11-03): `helm uninstall argocd -n argocd`. CRD `applications` и
   `appprojects` остаются сами (`helm.sh/resource-policy: keep`). На чистом кластере шаг пропускается.
2. CRD `applicationsets` серверным применением: `helm template argocd <каталог chart> -n argocd --show-only templates/crds/crd-applicationset.yaml > crd.yaml`,
   затем `kubectl apply --server-side --force-conflicts -f crd.yaml`; проверка - у CRD `Established=True`.
3. `helm install argocd <каталог chart> -n argocd -f deploy/argocd/argocd-values.yaml --set crds.install=false --set configs.secret.createSecret=true --wait --timeout 10m`.
   2026-11-11 релиз стал `deployed`, все поды `Running` за 47 секунд (тогда без `createSecret`: до ARGOCD-1 файл значений его не задавал). `createSecret=true` в командной строке нужен, чтобы chart создал `argocd-secret` на новом кластере; в файле стоит `false`, чтобы самосинк не затирал хэш пароля. Не проверялось: что без этого флага `argocd-server` создал бы секрет сам.

Проверка: `helm -n argocd status argocd`, `kubectl -n argocd get pods` - все `Running`.

Обновление chart после ARGOCD-2: `helm upgrade` запрещён (раздел о самоуправлении); меняется `targetRevision` в `deploy/argocd/argo-cd.yaml`, до слияния в `main` выполняется шаг 2 (CRD вне Helm). Новая версия - не раньше чем через 7 дней после
выхода (ADR-005). Версия 10.11.6 остаётся до отдельной работы над обновлением: сведения об актуальной версии chart на Artifact Hub
противоречивы, проверять по релизам апстрима.

## Доступ к UI

UI наружу не публикуется (ADR-038 п. 2), доступ через `kubectl port-forward`.

1. Имя сервиса - проверка владельца: `kubectl -n argocd get svc argocd-server` (у chart такое имя по умолчанию; не проверялось).
2. `kubectl -n argocd port-forward svc/argocd-server 8080:443`, затем `https://localhost:8080` (сертификат самоподписанный, браузер
   может предупредить; не проверялось).
3. Вход: пользователь `admin`; пароль - из менеджера паролей после смены (раздел ниже).

Окно `port-forward` держится открытым, пока идёт работа; в фоне и по расписанию не запускается.

## Начальный пароль admin

Решение владельца 2026-11-12: пароль `admin` сменить, хранить в менеджере паролей, `argocd-initial-admin-secret` удалить; пользователь
`admin` остаётся включённым. Общая учётка без SSO и без журнала по людям принята, владелец один; RBAC и локальные аккаунты не
заводятся.

Шаги владельца (в репозиторий и в чат значение пароля не попадает):

1. Начальный пароль в буфер: `kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d | pbcopy`.
2. Вход в UI (раздел выше), затем User Info -> Update Password: текущий пароль - из буфера, новый - сгенерировать в менеджере
   паролей и сохранить туда же **до** подтверждения смены. Альтернатива через CLI `argocd account update-password` требует поставить
   `argocd` на машину владельца; для одного шага это не обязательно, поэтому UI.
3. Очистить буфер: `pbcopy < /dev/null`.
4. Войти новым паролем; если вход прошёл - `kubectl -n argocd delete secret argocd-initial-admin-secret`. Начальный секрет не удалять,
   пока новый пароль не проверен входом.
5. Сообщить в строке RUNBOOK-2: дата смены, секрет удалён (проверка `kubectl -n argocd get secret argocd-initial-admin-secret` - `NotFound`).

Если пароль потерян после удаления начального секрета: сброс - запись bcrypt-хэша в `argocd-secret` по документации апстрима
(раздел про сброс пароля admin). Не проверялось; порядок - в документации ArgoCD той же версии, не по памяти.

## Подключение репозитория

Репозиторий публичный (решение владельца 2026-11-12): ArgoCD читает его по обычному HTTPS-адресу, **без учётных данных**. Ни
deploy key, ни токена, ни Secret с репозиторием не нужно: адрес указывается в `source.repoURL` Application. Адрес репозитория на
GitHub - `FreyDv/bf` (ADR-038 п. 7), то есть `https://github.com/FreyDv/bf` (в манифестах - форма без `.git`; принимает ли её ArgoCD, видно при первой
синхронизации в ARGOCD-2; не проверялось).

Проверка владельца: `gh repo view FreyDv/bf --json visibility` - `PUBLIC`. Смена видимости репозитория на приватную - условие пересмотра: до неё способ доступа выбирается
записью (в схеме сейчас секрета нет).

## Самоуправление из `deploy/argocd/` (ADR-019 п. 1, ADR-046)

Манифесты готовы (ARGOCD-1), на кластере не применены: первое применение - шаг владельца ARGOCD-2. Устройство:

- `deploy/argocd/root.yaml` - корневое Application: смотрит `deploy/argocd/` в `https://github.com/FreyDv/bf`, ветка `main`, без учётных данных, и применяет каждое Application из каталога. Исключены `argocd-values.yaml` (файл значений, не объект Kubernetes) и `traefik.yaml` (плейсхолдер сертификата, до TRAEFIK-2).
- `deploy/argocd/argo-cd.yaml` - Application самого ArgoCD: chart `argo-cd` 10.11.6, значения - файл `argocd-values.yaml` из этого же репозитория (второй источник `ref: values`), имя релиза `argocd`, namespace `argocd`, поэтому рендер даёт живые имена (`argocd-server`, ...) и первый синк принимает существующие объекты, а не создаёт второй ArgoCD.
- Синк корня и `argo-cd`: автоматический, без `prune`, без `selfHeal`, `ServerSideApply=true`, без finalizer: удаление Application ничего не удаляет, а удалённый из git объект остаётся, пока его не удалит человек.
- CRD вне Helm и вне синка (`crds.install=false`), `argocd-secret` не рендерится (`configs.secret.createSecret=false`): самосинк не затирает CRD и хэш пароля `admin`. Порядок со сменой пароля (RUNBOOK-2) любой: до ARGOCD-2 или после, хэш остаётся.
- После ARGOCD-2 `kubectl apply` из `sealed-secrets.yaml` и `nats.yaml` не нужен: их применяет корень; новый файл Application в каталоге разворачивается слиянием в `main`.

### Первое применение (ARGOCD-2, шаги владельца, не выполнялись)

Предусловие: изменения ARGOCD-1 слиты в `main` (ArgoCD читает `main`, не ветку); `gh repo view FreyDv/bf --json visibility` - `PUBLIC`.

1. Перед применением, только чтение: `kubectl -n argocd get applications` (допустимы `sealed-secrets`, `nats`, если применялись руками), `kubectl -n argocd get deploy,sts` (список объектов ArgoCD запомнить).
2. `kubectl apply -n argocd -f deploy/argocd/root.yaml -f deploy/argocd/argo-cd.yaml`.
3. Ждать минуты три: `kubectl -n argocd get applications` - `root`, `argo-cd` и уже применённые `sealed-secrets`, `nats` в `Synced` и `Healthy`; `traefik` в списке нет (исключён).
4. Второго ArgoCD нет: `kubectl -n argocd get deploy,sts` показывает те же объекты, что в шаге 1, с теми же именами (`argocd-server`, `argocd-repo-server`, `argocd-application-controller`, ...) и без новых с префиксом `argo-cd-`; `kubectl -n argocd get pods` - все `Running`; `helm -n argocd status argocd` по-прежнему `deployed`.
5. Что проверить глазами: `argocd-secret` на месте и вход `admin` работает прежним паролем; у `argo-cd` нет расхождений (`kubectl -n argocd describe application argo-cd`), особенно по Job `argocd-redis-secret-init` и по `argocd-notifications-secret`, которые chart рендерит и без `argocd-secret`.
6. Если `argo-cd` в `OutOfSync` или `Degraded`: ничего не удалять и не править руками; откат - `kubectl -n argocd delete application argo-cd root` (без finalizer объекты остаются) и сообщить агенту.
7. Сообщить в строке ARGOCD-2: дата, `Synced` и `Healthy`, второго ArgoCD нет.

### Дальше

- **Обновление ArgoCD:** новая версия chart, прошедшая окно ADR-005, - смена `targetRevision` в `deploy/argocd/argo-cd.yaml` в PR; перед слиянием владелец выполняет шаг 2 установки (CRD).
- **`helm upgrade`, `helm rollback` и `helm uninstall` для релиза `argocd` запрещены с ARGOCD-2:** Helm-запись остаётся как след установки, объекты принадлежат ArgoCD, команда Helm разойдётся с git.
- **Откат конфигурации и версии:** `git revert` и слияние; синк применит.
- **Удаление Application из `deploy/argocd/`** не удаляет объекты (нет `prune`): удалить вручную, если так и задумано.

## Diagnose

- Состояние: `helm -n argocd status argocd`, `kubectl -n argocd get pods`, `kubectl -n argocd get applications`.
- Приложение не синхронизируется: `kubectl -n argocd describe application <имя>`; логи контроллера `kubectl -n argocd logs statefulset/argocd-application-controller`, репозитория `kubectl -n argocd logs deploy/argocd-repo-server`.
- Три вероятные причины, по убыванию: ArgoCD не смотрит репозиторий (так до ARGOCD-2: файлы применяются руками); chart или значения расходятся с `deploy/argocd/`; CRD вне Helm не обновлены перед сменой версии chart.

## Common failures

| Симптом | Причина | Что делать |
|---|---|---|
| `helm install` зависает в `pending-install` | CRD `applicationsets` слишком большой для Helm 4 | шаги 1-3 установки |
| синк `argo-cd` падает на CRD после смены версии chart | CRD вне Helm не обновлены | шаг 2 установки, затем повторить синк (`helm upgrade` с ARGOCD-2 запрещён) |
| UI не открывается через `port-forward` | неверное имя сервиса или порт | `kubectl -n argocd get svc`; предупреждение о сертификате в браузере ожидаемо |
| Вход `admin` не проходит после смены | начальный секрет удалён до проверки нового пароля | сброс пароля по документации апстрима (раздел выше) |

## Rollback

Откат конфигурации и самого ArgoCD - `git revert` и слияние в `main`; синк применит (ADR-019, ADR-046). До ARGOCD-2, пока корень не применён, откат ArgoCD - `helm -n argocd rollback argocd <ревизия>`; после - запрещён. CRD вне Helm откатом не меняются. Потеря кластера - порядок в [recovery.md](recovery.md).

## Не проверено

- Имя сервиса `argocd-server` и поведение `port-forward` на этом кластере.
- Видимость репозитория сейчас (`gh repo view`): решение исходит из того, что он публичный.
- Сброс пароля после удаления начального секрета и работа User Info -> Update Password в версии 10.11.6.
- Всё из раздела о самоуправлении: манифесты проверены только `helm template` (`pnpm charts`), на кластере не применялись (ARGOCD-2): принятие существующих объектов Helm, хуки chart, достижимость `https://github.com/FreyDv/bf` без `.git`.

Связано: [malinina-kubernetes.md](malinina-kubernetes.md), [recovery.md](recovery.md), ADR-005, ADR-019, ADR-020, ADR-038, ADR-046.
