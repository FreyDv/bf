# Бэклог

> Единый упорядоченный список работы, которую репозиторий ещё должен сам себе. Markdown и agent-first; совместим с [Backlog.md](https://github.com/MrLesk/Backlog.md). Работа ведётся здесь, внешнего трекера нет.

## Alignment scope (выравнивание по стандарту)

Артефакт Gate 5 и число, по которому владелец решает go/no-go. Чистый лист: кода нет, поэтому задач немного и они в основном про решения и подключение проверок.

```
Alignment scope for this repo -> standard@1.0.19
  specs to write / raise to buildable .........  1
  decisions to record or confirm (ADR/BDR) ....  6
  drift to reconcile ..........................  0
  guards / structure to install ...............  3
  ---------------------------------------------
  10 tasks to full alignment
```

`drift 0` и ненулевое число не противоречат друг другу: дрейф измеряет то, что стандарт проверяет механически, а число - то, что механически не проверить.

| # | item | id | owner | how |
|---|------|----|-------|-----|
| 1 | Первая спека возможности из слов владельца | SPEC-1 | product | `/spec-specify`, затем `/spec-clarify` |
| 2 | Подтвердить BDR-001 и `docs/personas.md` (ответить на маркеры `[NEEDS INPUT]`) | PERSONAS-1 | product | `personas-write` |
| 3 | North Star, метрики, что люди делают сегодня, не-цели в `docs/PRODUCT.md` | PRODUCT-1 | product | `product-write` |
| 4 | Выбрать технологический стек и записать развилки: топология репозитория, хранилище данных, стиль API и контракта, аутентификация, реализация типа результата и инструмента проверки границ | STACK-1 | architect | ADR на развилку по чек-листу; для Node - `vendor/repository-standards-node/DECISIONS.md` |
| 5 | Базовая безопасность: ответ на каждую ось `security-baseline.md` | SEC-1 | architect | `adr-write` |
| 6 | Стратегия тестирования: уровни и где они выполняются (с учётом TST-1..5) | TEST-1 | architect | `adr-write` |
| 7 | Конвейер, релизы и откат: решить до первого деплоя | CI-1 | architect | `adr-write` |
| 8 | Выбрать и подключить инструмент проверки границ (ENF-1) до первого модуля | ENF-1 | dev | после STACK-1; правила DEP-2 в конфиг инструмента |
| 9 | Прогнать `bash scripts/verifyAgentGuards.sh`: убедиться, что хуки блокируют удалённую БД и force-push | GUARD-1 | dev | локально; в сессии адаптации запуск был заблокирован |
| 10 | Настройки репозитория GitHub: squash-merge, защита `main`, обязательные проверки `spec-guard` и `gitleaks` | GUARD-2 | dev | вручную в GitHub |

## Order

Вверху - следующее. Приоритет: риск × рычаг. Формат строки - в [стандарте](standards/vendor/repository-standards-core/standard/docs/backlog.md).

## Epic: Продукт и первая спека

| id | title | cap | persona | owner | assignee | size | why | source | DoD | status |
|----|-------|-----|---------|-------|----------|------|-----|--------|-----|--------|
| PERSONAS-1 | Подтвердить BDR-001 и персоны | - | `Владелец-оператор` | product |  | S | персоны - ворота валидации; вся работа ссылается на них | onboarding | маркеры `[NEEDS INPUT]` и `[NEEDS REVIEW]` сняты | todo |
| PRODUCT-1 | North Star, метрики, не-цели | - | `Владелец-оператор` | product |  | S | спеки пишут `Success metric: n/a` без причины | onboarding | раздел «Success metrics» заполнен | todo |
| SPEC-1 | Первая спека возможности | - | `Владелец-оператор` | product |  | M | без спеки нет работы по циклу стандарта | asked: owner 2026-11-05 | спека проходит clarify-гейт и записана в `capability-map.json` | todo |

## Epic: Стек и решения

| id | title | cap | persona | owner | assignee | size | why | source | DoD | status |
|----|-------|-----|---------|-------|----------|------|-----|--------|-----|--------|
| STACK-1 | Стек и развилки (топология, хранилище, API, auth, тип результата, инструмент границ) | - | Maintainer (internal) | architect |  | L | пока стека нет, backend-код не пишется (AGENTS.md красный флаг 9) | decision | ADR на каждую развилку чек-листа или «не применимо» одной строкой | todo |
| SEC-1 | Базовая безопасность | - | Maintainer (internal) | architect |  | M | R7, R19 | decision | каждая ось отвечена или «не применимо» | todo |
| TEST-1 | Стратегия тестирования | - | Maintainer (internal) | architect |  | S | R7 | decision | уровни и место выполнения записаны | todo |
| CI-1 | Конвейер, релизы, откат | - | Maintainer (internal) | architect |  | M | R7; откат решается до первого деплоя | decision | ADR принят | todo |

## Epic: Гарды

| id | title | cap | persona | owner | assignee | size | why | source | DoD | status |
|----|-------|-----|---------|-------|----------|------|-----|--------|-----|--------|
| ENF-1 | Проверка границ архитектуры в CI | - | Maintainer (internal) | dev |  | M | без неё модуль не сливается (ENF-1) | decision: ADR-002 | инструмент выбран, правила DEP-2 в конфиге, шаг в CI красный на нарушении | todo |
| GUARD-1 | Самотест хуков агента | - | Maintainer (internal) | dev |  | S | запуск в сессии адаптации был заблокирован | onboarding | `bash scripts/verifyAgentGuards.sh` зелёный | todo |
| GUARD-2 | Настройки GitHub: squash, защита main, обязательные проверки | - | Maintainer (internal) | dev |  | S | ADR-003 | onboarding | настройки применены | todo |

## Statuses

`todo` / `doing` / `blocked` / `done`. Строка `done` уходит в [`backlog-archive.md`](backlog-archive.md) вместе с указателем на то, во что превратилось её содержимое.
