# bf - backlog

> Единый упорядоченный список работы, которую репозиторий ещё должен сам себе: фичи и - особенно при выравнивании по стандарту - долг по спекам, решениям и документам. Markdown и agent-first: агент может читать, добавлять и переупорядочивать. Совместим с инструментом [Backlog.md](https://github.com/MrLesk/Backlog.md); свой движок бэклога не строим. Работа ведётся здесь, внешнего трекера нет (владелец выбрал «свести в бэклог»).

## Alignment scope (выравнивание по стандарту)

Артефакт Gate 5 и число, по которому владелец решает go/no-go. Выравнивание идёт волнами; первая волна - PR `feat/repository-standards`.

```
Alignment scope for bf -> standard@1.0.19
  specs to write / raise to buildable .........  3
  decisions to record or confirm (ADR/BDR) ....  6
  drift to reconcile ..........................  8
  guards / structure to install ...............  4
  ---------------------------------------------
  21 tasks to full alignment
```

`drift 0` и ненулевое число задач не противоречат друг другу: дрейф измеряет то, что стандарт может проверить механически, а это число - то, что механически не проверить. Задачи берутся по одной, сверху вниз; каждая называет роль, навык или шаг, которым делается.

| #   | item                                                                                                            | id          | owner     | how                                             |
| --- | --------------------------------------------------------------------------------------------------------------- | ----------- | --------- | ----------------------------------------------- |
| 1   | Спека identity: закрыть маркеры (критерии приёмки формулирует владелец, неопределённости)                       | SPEC-1      | product   | `/spec-clarify`                                 |
| 2   | Спека edge-gateway: закрыть маркеры                                                                             | SPEC-2      | product   | `/spec-clarify`                                 |
| 3   | Спека service-orchestration: закрыть маркеры                                                                    | SPEC-3      | product   | `/spec-clarify`                                 |
| 4   | Подтвердить или поправить ADR-026 (модель ошибок)                                                               | REC-1       | architect | прочитать запись, снять `[NEEDS REVIEW]`        |
| 5   | Подтвердить ADR-028 (базовая безопасность), закрыть пункты «не проверено»                                       | REC-2       | architect | `adr-write`, проверки по осям                   |
| 6   | Подтвердить ADR-029 (стратегия тестирования)                                                                    | REC-3       | architect | прочитать запись, снять `[NEEDS REVIEW]`        |
| 7   | Подтвердить BDR-001 и `docs/personas.md` (ответить на маркеры `[NEEDS INPUT]`)                                  | PERSONAS-1  | product   | `personas-write`                                |
| 8   | Определить North Star, метрики, что люди делают сегодня, не-цели в `docs/PRODUCT.md`                            | PRODUCT-1   | product   | `product-write`                                 |
| 9   | Разложить `docs/aws-target-architecture.md` и `docs/aws-fargate-migration.md` по записям, runbooks и спекам     | MATERIAL-1  | architect | `discovery-digest`, `adr-write`                 |
| 10  | Перевести английские документы на русский по решению ADR-032 (PRINCIPLES, ARCHITECTURE, README docs)            | LANG-2      | agent     | волнами, по одному файлу за PR                  |
| 11  | Убрать трейлеры AI-атрибуции из коммитов этой ветки и закрепить squash-merge в настройках GitHub                | CONV-1      | agent     | `scripts/ci/repo-settings.ts`                   |
| 12  | Точные версии, кулдаун 7 дней, точная версия Node, pnpm ≥ 10.16                                                 | PINS-1      | dev       | отдельный PR, ADR-030                           |
| 13  | Исполняемый DDL под `database/schema/` и привязка к Drizzle-схеме (R24)                                         | DB-SCHEMA-1 | architect | решить: генерировать из Drizzle или вести рядом |
| 14  | Перенести модуль `auth/identity` в раскладку Domain-Driven Hexagon                                              | ARCH-1      | dev       | `bf-new-module`, `bf-architecture-review`       |
| 15  | Решить, нужно ли правило `explicit-module-boundary-types` для NestJS (сейчас выключено)                         | ARCH-3      | architect | ADR или правка пресета                          |
| 16  | Заменить `docs/ADR.md` указателем и удалить после подтверждения                                                 | LAYOUT-1    | agent     | после подтверждения владельца                   |
| 17  | Применить волны стека Node: точные пины и кулдаун, затем строгость, тесты, CI (исключения записаны в манифесте) | STACK-1     | dev       | `stack.md` из `align-to-standards`              |
| 18  | Прогнать `bash scripts/verifyAgentGuards.sh` и убедиться, что хуки блокируют удалённую БД и force-push          | GUARD-1     | dev       | локально и в CI                                 |
| 19  | Защита ветки: обязательные проверки `ci ok` и `spec-guard`, squash-merge                                        | GUARD-2     | dev       | `scripts/ci/repo-settings.ts --apply`           |
| 20  | Приёмочные тесты из критериев спек (`test/*.e2e-spec.ts`)                                                       | TEST-1      | dev       | после SPEC-1..3                                 |
| 21  | Проверить конфиг gitleaks на истории и добавить бюджетные оповещения AWS                                        | CI-1        | dev       | `gitleaks detect`, AWS Budgets                  |

## Order

Вверху списка - следующее. Приоритет: риск × рычаг (деньги, безопасность, внешние контракты, целостность данных раньше косметики; частые изменения раньше спящих). Определение готовности и формат строки - в [стандарте](standards/vendor/repository-standards-core/standard/docs/backlog.md).

## Epic: Спеки

| id     | title                                                                                         | cap                   | persona             | owner   | assignee | size | why                                                                                                 | source     | DoD                                                                                | status |
| ------ | --------------------------------------------------------------------------------------------- | --------------------- | ------------------- | ------- | -------- | ---- | --------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------- | ------ |
| SPEC-1 | Спека identity: критерии приёмки (формулирует владелец: «сформулирую сам») и неопределённости | identity              | `Владелец-оператор` | product |          | M    | единственная возможность с защитой данных; пока спека in-refinement, гард связности не защищает код | onboarding | спека проходит clarify-гейт: ноль маркеров `[NEEDS ...]`, `## Clarifications` есть | todo   |
| SPEC-2 | Спека edge-gateway: критерии приёмки и неопределённости                                       | edge-gateway          | `Владелец-оператор` | product |          | M    | граница безопасности: проверка JWT, роли, лимит частоты                                             | onboarding | то же                                                                              | todo   |
| SPEC-3 | Спека service-orchestration: критерии приёмки и неопределённости                              | service-orchestration | `Владелец-оператор` | product |          | M    | управляет затратами (BDR-002) и холодным стартом                                                    | onboarding | то же                                                                              | todo   |

## Epic: Решения

| id         | title                                                 | cap | persona               | owner     | assignee | size | why                                                     | source     | DoD                                                                                            | status |
| ---------- | ----------------------------------------------------- | --- | --------------------- | --------- | -------- | ---- | ------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------- | ------ |
| REC-1      | Подтвердить ADR-026 (модель ошибок)                   | -   | Maintainer (internal) | architect |          | S    | запись набросана агентом, статус Proposed               | decision   | владелец подтвердил или правил; маркер `[NEEDS REVIEW]` и статус Proposed сняты одним коммитом | todo   |
| REC-2      | Подтвердить ADR-028 и закрыть пункты «не проверено»   | -   | Maintainer (internal) | architect |          | M    | безопасность без записи решается случайно (R7)          | decision   | каждая ось отвечена или «не применимо»; маркер снят                                            | todo   |
| REC-3      | Подтвердить ADR-029 (стратегия тестирования)          | -   | Maintainer (internal) | architect |          | S    | запись набросана агентом                                | decision   | то же                                                                                          | todo   |
| PERSONAS-1 | Подтвердить BDR-001 и `docs/personas.md`              | -   | `Владелец-оператор`   | product   |          | S    | персоны - ворота валидации, вся работа ссылается на них | onboarding | маркеры `[NEEDS INPUT]` закрыты, `[NEEDS REVIEW]` снят                                         | todo   |
| PRODUCT-1  | North Star, метрики, что люди делают сегодня, не-цели | -   | `Владелец-оператор`   | product   |          | S    | спеки пишут `Success metric: n/a` без причины           | onboarding | раздел «Success metrics» в `docs/PRODUCT.md` заполнен                                          | todo   |
| MATERIAL-1 | Разложить AWS-документы по записям, runbooks и спекам | -   | Maintainer (internal) | architect |          | M    | знание живёт в двух больших файлах вне таксономии       | onboarding | каждый факт - в записи, спеке или runbook; файлы помечены историей или удалены                 | todo   |

## Epic: Долг

| id          | title                                                         | cap      | persona               | owner     | assignee | size | why                                                                    | source     | DoD                                                                        | status |
| ----------- | ------------------------------------------------------------- | -------- | --------------------- | --------- | -------- | ---- | ---------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------- | ------ |
| CONV-1      | Убрать AI-атрибуцию из коммитов ветки; закрепить squash-merge | -        | Maintainer (internal) | agent     |          | S    | владелец: «соответствовать стандарту»; стандарт запрещает AI-атрибуцию | decision   | в коммитах ветки нет трейлеров; кнопка merge - squash                      | todo   |
| LANG-2      | Перевод английских документов на русский                      | -        | Maintainer (internal) | agent     |          | M    | ADR-032                                                                | decision   | PRINCIPLES, ARCHITECTURE, docs/README и спеки на русском                   | todo   |
| PINS-1      | Точные версии, кулдаун, pnpm ≥ 10.16, точный Node             | -        | Maintainer (internal) | dev       |          | L    | R21, ADR-030                                                           | drift      | нет `^` в каталоге; `minimumReleaseAge: 10080` действует                   | todo   |
| DB-SCHEMA-1 | Исполняемый DDL и привязка к Drizzle (R24)                    | -        | Maintainer (internal) | architect |          | M    | восстановление базы по чекауту                                         | drift      | `database/schema/` и `node scripts/schema-pair.mjs` проходят               | todo   |
| ARCH-1      | Миграция `auth/identity` в раскладку DDH                      | identity | Maintainer (internal) | dev       |          | L    | единственное исключение ADR-025                                        | drift      | модуль в `domain/application/infrastructure`; исключение в cruiser удалено | todo   |
| ARCH-3      | Решение по `explicit-module-boundary-types`                   | -        | Maintainer (internal) | architect |          | S    | правило выключено в пресете nest                                       | decision   | ADR или правка пресета                                                     | todo   |
| LAYOUT-1    | Заменить `docs/ADR.md` указателем                             | -        | Maintainer (internal) | agent     |          | S    | owner выбрал перенос в раскладку стандарта                             | onboarding | `docs/ADR.md` - указатель или удалён                                       | todo   |
| STACK-1     | Волны стека Node (Layer 2)                                    | -        | Maintainer (internal) | dev       |          | L    | владелец выбрал «применить стек»                                       | onboarding | самоверификация без неисключённого дрейфа по `stack.manifest.json`         | todo   |

## Epic: Гарды

| id      | title                                          | cap | persona               | owner | assignee | size | why                                                             | source     | DoD                                          | status |
| ------- | ---------------------------------------------- | --- | --------------------- | ----- | -------- | ---- | --------------------------------------------------------------- | ---------- | -------------------------------------------- | ------ |
| GUARD-1 | Самотест хуков агента                          | -   | Maintainer (internal) | dev   |          | S    | автоматический запуск хуков был заблокирован в сессии адаптации | onboarding | `bash scripts/verifyAgentGuards.sh` зелёный  | todo   |
| GUARD-2 | Защита `main`: `ci ok` + `spec-guard` + squash | -   | Maintainer (internal) | dev   |          | S    | ADR-027                                                         | onboarding | правила применены `repo-settings.ts --apply` | todo   |
| TEST-1  | Приёмочные e2e из спек                         | -   | Maintainer (internal) | dev   |          | L    | ADR-029                                                         | onboarding | каждый критерий спеки - тест                 | todo   |
| CI-1    | gitleaks по истории; бюджетные оповещения AWS  | -   | Maintainer (internal) | dev   |          | S    | BDR-002, ADR-028                                                | onboarding | отчёт чист; оповещения включены              | todo   |

## Statuses

`todo` / `doing` / `blocked` / `done`. Строка `done` уходит в [`backlog-archive.md`](backlog-archive.md) вместе с указателем на то, во что превратилось её содержимое (закрытие - перемещение, не удаление).
