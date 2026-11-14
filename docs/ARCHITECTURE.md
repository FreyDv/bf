# Архитектура

> Документ «как это **построено**» - структура и границы, не поведение. Поведение - в [спеках](../specs/); причины - в [ADR](decision-records/adr/README.md). Актуален: изменение границы или компонента меняет этот файл в том же PR.

## Overview

Кода и технологического стека пока нет (ADR-006). Известна только форма: любой backend строится как Domain-Driven Hexagon по правилам [`.claude/rules/architecture-rules.md`](../.claude/rules/architecture-rules.md). Первая диаграмма (контекст и контейнеры) появится вместе со стековыми ADR (backlog STACK-1).

## Diagrams - the C4 model

- **Context (уровень 1):** система, её пользователи ([персоны](personas.md)) и внешние системы - позже, после первой спеки.
- **Container (уровень 2):** развёртываемые единицы и их связи - после выбора стека.
- **Component (уровень 3):** внутри каждого backend-контейнера - модули и слои по `architecture-rules.md` (STR-6): вертикальные срезы `commands/`, `queries/`, слои `domain`, `application`, `infrastructure`, driving adapters.
- **Code (уровень 4):** пропускается; код и спеки - истина на этом уровне.

## Components

| Component | Responsibility | Stack |
|-----------|----------------|-------|
| не определены | появятся с первой спекой | выбран в ADR-007..033: NestJS, Next.js, Postgres, NATS |

## Boundaries and invariants

Уже решённые границы (ADR-002): зависимости направлены внутрь; домен свободен от фреймворков и ввода-вывода; модули общаются через публичные фасады, порты или сообщения, не через внутренности; проверка границ - `.dependency-cruiser.mjs`, шаг CI `boundaries` (ENF-1, ADR-014). Остальные - в стековых ADR.

## Data

Хранилища и владельцы данных - после выбора стека (развилка «хранилище данных», backlog STACK-1).

## Integrations

Внешние системы и способы связи - после первой спеки. Из слов владельца: ChatGPT через MCP (BDR-001).

## Runtime and deploy

Одно окружение `production` в кластере `malinina`, namespace `bf`; один хост, `/` во frontend и `/api` в backend; ingress - Traefik; TLS завершается на балансировщике DO. Решения и причины: [ADR-038](decision-records/adr/ADR-038-environments-ingress-edge-bot.md), [ADR-037](decision-records/adr/ADR-037-security-baseline.md), [ADR-019](decision-records/adr/ADR-019-deployment-helm-argocd.md). Приложений в кластере ещё нет (backlog DEPLOY-1); Traefik ставит TRAEFIK-2.

## Key decisions

[ADR](decision-records/adr/README.md): ADR-002 (Domain-Driven Hexagon), ADR-003 (ветвление), ADR-005 (зависимости), ADR-006 (чистый лист). Не пересказывать здесь - ссылаться.
