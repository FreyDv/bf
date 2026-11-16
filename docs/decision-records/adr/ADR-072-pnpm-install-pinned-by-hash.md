# ADR-072: Установка pnpm в CI и образах сверяется с хешем из `packageManager`

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-11-16 |
| **Author** | агент |
| **Decided by** | агент по поручению владельца, ADR-063 п. 2 (техническая развилка) |
| **Tags** | ci, supply-chain, images |

## Context

- Джобы `ci` и `image` в `.github/workflows/ci.yml` ставили pnpm командой `npm install --global pnpm@11.28.10`: версия повторена дважды рядом с `packageManager` в `package.json` (R4), и устанавливаемый архив ни с чем закреплённым не сверялся (CI-3, ревью CI-2).
- В Node 26 нет corepack, который сверил бы архив с хешем `packageManager`. Dockerfile-ы читали версию из `packageManager`, но тоже без сверки.
- pnpm 11 принимает `packageManager` в формате corepack `pnpm@<версия>+sha512.<hex>` (проверено: `pnpm --version`, `pnpm install --frozen-lockfile`).

## Options considered

| Вариант | Итог | Почему |
|---|---|---|
| Хеш в `packageManager` и свой скрипт на TS, который сверяет архив | выбран | один дом версии и хеша; без новых зависимостей и actions; тот же путь в CI и в образах |
| `pnpm/action-setup` | отклонён | новый action (ADR-005: пин по SHA, ревью), только для CI, образы не покрывает |
| Вернуть corepack (`npm install -g corepack`) | отклонён | ещё один инструмент, ставится тем же непроверенным `npm install -g` |

## Decision

1. `packageManager` в `package.json` - `pnpm@<версия>+sha512.<hex>`, где hex - sha512 архива `pnpm-<версия>.tgz` из реестра npm. Это единственный дом версии и хеша pnpm.
2. `scripts/install-pnpm.ts` читает `packageManager`, отказывает, если хеша нет, скачивает архив `npm pack`, сверяет sha512 и только тогда ставит его `npm install --global <архив>`. Флаг `--dry-run` сверяет без установки.
3. Его вызывают шаги `Install pnpm` обеих джоб `ci.yml` и стадия `base` обоих Dockerfile (`COPY package.json scripts/install-pnpm.ts`). Версия pnpm больше нигде не повторяется.
4. Смена версии pnpm - одна правка `packageManager` с новым хешем, после кулдауна 7 дней (ADR-005); хеш берётся из `npm pack pnpm@<версия>` и сверяется с `npm view pnpm@<версия> dist.integrity`.

## Consequences

- Плюс: подменённый или повреждённый архив pnpm останавливает CI и сборку образа до установки.
- Плюс: версия pnpm в CI, образах и у разработчика одна - из `packageManager`.
- Минус: хеш привязан к реестру npm; доверие к первому вычислению хеша - на том, кто обновляет версию.
- Минус: `turbo` в Dockerfile ставится по-прежнему `npm install --global` по версии из `devDependencies`, без сверки хеша (вне строки CI-3).

## Confirmation

- `pnpm pnpm:install:test` (шаг `pnpm install script` в `ci`): чтение пина, отказ без хеша, ничего не ставится при несовпадении.
- Проверено 2026-11-16: `node scripts/install-pnpm.ts --dry-run` проходит; с изменённым на один символ хешем - отказ с кодом 1; оба образа собираются (`docker build`), `pnpm image:check lint` без новых замечаний.

## Revisit when

- В Node снова есть corepack по умолчанию, или pnpm сам сверяет хеш при установке: скрипт заменяется им.
- Нужна сверка и для `turbo` или других глобальных инструментов образа.

## Related

ADR-005, ADR-027, ADR-036, ADR-063; R4, R21; backlog CI-3 (в архиве).
