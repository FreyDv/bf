# Runbook: ArgoCD

Serves: владелец-оператор и агент, действующий за него. Как ArgoCD ставится с нуля, как открыть его UI, что сделать с начальным
паролем и каким должно стать самоуправление из `deploy/argocd/` (ADR-019, ADR-038 п. 2, backlog RUNBOOK-1, RUNBOOK-2, ARGOCD-1).

Состояние на 2026-11-12: ArgoCD работает с 2026-11-11 (Helm-релиз `argocd`, chart `argo-cd` 10.11.6, app v3.5.6), есть только
`AppProject default`, приложений и подключённого репозитория нет, UI не настроен, `argocd-initial-admin-secret` не менялся.
Подробный снимок кластера и разбор неудачной первой установки - [malinina-kubernetes.md](malinina-kubernetes.md) («Что работает в
кластере», «Разбор: почему ArgoCD не установился»). Команды ниже не выполнялись в том виде, как записаны: живой кластер агент не
трогает, их запускает владелец. Три команды установки выполнялись 2026-11-11 и прошли.

## Установка с нуля (bootstrap)

ArgoCD ставится вручную один раз, дальше им управляют из git (ADR-019 п. 1; самоуправление - раздел ниже, пока не применено).
Контекст `kubectl` - `do-tor1-malinina`, нужен Helm v4 (локальное требование, AGENTS.md, «Commands»). Namespace `argocd` должен
существовать: на новом кластере `kubectl create namespace argocd` (как он появился в первый раз, не записано).

Chart берётся командами `helm repo add argo https://argoproj.github.io/argo-helm` и `helm pull argo/argo-cd --version 10.11.6 --untar`.
Значения - `deploy/argocd/argocd-values.yaml` (`repoServer.replicas=2`, `server.replicas=2`, `ARGOCD_API_SERVER_REPLICAS=2`). Порядок
важен: Helm 4 не справляется с CRD `applicationsets` (около 1,4 МБ), поэтому CRD ставятся отдельно от Helm.

1. Если есть зависший релиз `pending-install` (так было 2026-11-03): `helm uninstall argocd -n argocd`. CRD `applications` и
   `appprojects` остаются сами (`helm.sh/resource-policy: keep`). На чистом кластере шаг пропускается.
2. CRD `applicationsets` серверным применением: `helm template argocd <каталог chart> -n argocd --show-only templates/crds/crd-applicationset.yaml > crd.yaml`,
   затем `kubectl apply --server-side --force-conflicts -f crd.yaml`; проверка - у CRD `Established=True`.
3. `helm install argocd <каталог chart> -n argocd -f deploy/argocd/argocd-values.yaml --set crds.install=false --wait --timeout 10m`.
   2026-11-11 релиз стал `deployed`, все поды `Running` за 47 секунд.

Проверка: `helm -n argocd status argocd`, `kubectl -n argocd get pods` - все `Running`.

Обновление chart: шаг 2 повторяется перед каждым `helm upgrade` (CRD вне Helm), новая версия - не раньше чем через 7 дней после
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
GitHub - `FreyDv/bf` (ADR-038 п. 7), то есть `https://github.com/FreyDv/bf` (форму с `.git` или без выбирает ARGOCD-1 при первой
синхронизации; не проверялось).

Проверка владельца: `gh repo view FreyDv/bf --json visibility` - `PUBLIC`. Смена видимости репозитория на приватную - условие пересмотра: до неё способ доступа выбирается
записью (в схеме сейчас секрета нет).

## Самоуправление из `deploy/argocd/` (целевое, не применено)

Цель (ADR-019 п. 1): ArgoCD смотрит этот репозиторий и управляет всем из `deploy/argocd/`, включая себя. Сейчас файлы Application
(`sealed-secrets.yaml`, `nats.yaml`) применяются руками (`kubectl apply -n argocd -f deploy/argocd/<файл>.yaml`), ArgoCD
репозиторий не смотрит. Манифесты - отдельная строка **ARGOCD-1**: их нельзя проверить без живого кластера, а ошибка в
самоуправляемом релизе ArgoCD опасна. Здесь - что ARGOCD-1 должна учесть, это не инструкция к исполнению.

- Корневое Application (`deploy/argocd/`, источник - этот репозиторий, публичный URL, раздел выше) и Application для самого
  `argo-cd` с теми же значениями и версией chart, что в bootstrap.
- CRD `applicationsets` вне Helm: при самоуправлении значение `crds.install=false` и шаг 2 bootstrap остаются, иначе повторится
  отказ Helm 4. Как это выражается в Application (серверное применение, исключение CRD из синхронизации), решает ARGOCD-1.
- В `deploy/argocd/` лежит не только манифесты: `argocd-values.yaml` - файл значений, не объект Kubernetes; корневое Application
  не должно пытаться применить его как манифест.
- Уже работающие объекты (Helm-релиз `argocd`, Application, применённые руками) принимаются без пересоздания; автосинхронизация для
  самого ArgoCD без `prune` до первой проверки, откат - `git revert` (ADR-019).
- Первое применение корневого Application - последний ручной шаг; после него `kubectl apply` из `sealed-secrets.yaml` и `nats.yaml`
  больше не нужен, их комментарии «ArgoCD репозиторий не смотрит» обновляются вместе (строка ARGOCD-1).

## Diagnose

- Состояние: `helm -n argocd status argocd`, `kubectl -n argocd get pods`, `kubectl -n argocd get applications`.
- Приложение не синхронизируется: `kubectl -n argocd describe application <имя>`; логи контроллера `kubectl -n argocd logs statefulset/argocd-application-controller`, репозитория `kubectl -n argocd logs deploy/argocd-repo-server`.
- Три вероятные причины, по убыванию: ArgoCD не смотрит репозиторий (сейчас так: файлы применяются руками); chart или значения расходятся с `deploy/argocd/`; CRD вне Helm не обновлены перед `helm upgrade`.

## Common failures

| Симптом | Причина | Что делать |
|---|---|---|
| `helm install` зависает в `pending-install` | CRD `applicationsets` слишком большой для Helm 4 | шаги 1-3 установки |
| `helm upgrade` падает на CRD | CRD вне Helm не обновлены | шаг 2 установки, затем `helm upgrade ... --set crds.install=false` |
| UI не открывается через `port-forward` | неверное имя сервиса или порт | `kubectl -n argocd get svc`; предупреждение о сертификате в браузере ожидаемо |
| Вход `admin` не проходит после смены | начальный секрет удалён до проверки нового пароля | сброс пароля по документации апстрима (раздел выше) |

## Rollback

Откат конфигурации - `git revert` и повторное применение (ADR-019). Откат самого ArgoCD: `helm -n argocd rollback argocd <ревизия>`
(CRD вне Helm откатом не меняются). Потеря кластера - порядок в [recovery.md](recovery.md).

## Не проверено

- Имя сервиса `argocd-server` и поведение `port-forward` на этом кластере.
- Видимость репозитория сейчас (`gh repo view`): решение исходит из того, что он публичный.
- Сброс пароля после удаления начального секрета и работа User Info -> Update Password в версии 10.11.6.
- Всё из раздела о самоуправлении: манифестов нет (ARGOCD-1).

Связано: [malinina-kubernetes.md](malinina-kubernetes.md), [recovery.md](recovery.md), ADR-005, ADR-019, ADR-020, ADR-038.
