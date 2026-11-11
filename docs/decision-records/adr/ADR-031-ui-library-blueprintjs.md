# ADR-031: UI-библиотека frontend: BlueprintJS

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-11 |
| **Author** | владелец |
| **Decided by** | владелец |
| **Tags** | stack, frontend, ui |

## Context

- Frontend - Next.js 16.4.4 с React 19.3.1 (ADR-011); в `apps/frontend/app` только `layout.tsx` и `page.tsx`, UI-библиотеки нет.
- В `docs/` и записях библиотека UI нигде не названа.
- Владелец хочет BlueprintJS (https://blueprintjs.com/docs/#blueprint).
- Новая зависимость требует ADR (AGENTS.md, красный флаг 3; ADR-005).

## Options considered

| Вариант | Плюсы | Минусы | Итог |
|---|---|---|---|
| BlueprintJS | выбор владельца; готовые компоненты для плотных интерфейсов (таблицы, формы, диалоги) | своя тема и стили; компоненты на хуках и контексте - клиентские | выбран |

Другие библиотеки не сравнивались: сравнения в репозитории нет.

## Decision

1. Компоненты UI - BlueprintJS (`@blueprintjs/*`), только в `apps/frontend` (ADR-008).
2. Версии - точные, с кулдауном 7 дней (ADR-005).
3. Домен, application и backend не импортируют UI-библиотеку (DEP-3, DEP-5).
4. Тема и стили Blueprint подключаются один раз в корневом layout.

## Consequences

- Плюс: не пишем базовые компоненты сами.
- Минус: компоненты Blueprint работают на клиенте; в Next.js им нужна граница `'use client'`, SSR публичных страниц (ADR-011) это учитывает.
- Минус: свой стиль Blueprint; отход от него - работа над темой.
- Дальше: совместимость с React 19.3 и Next.js 16 подтверждена владельцем (2026-11-11); версию выбрать при первой установке (backlog SCAFFOLD-1).

## Confirmation

Только ревью: пакета ещё нет. После установки - `pnpm deps` ловит импорт вне `apps/frontend` (ADR-014).

## Revisit when

- Blueprint не поддерживает текущие React или Next.js и поддержка не ожидается.
- Публичные страницы по SEO или скорости не проходят из-за размера клиентского бандла Blueprint.

## Related

ADR-005, ADR-008, ADR-011, ADR-014.
