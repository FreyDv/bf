# Runbook: настройки репозитория на GitHub

Serves: владелец и агент, действующий за него. Настройки живут на GitHub, не в git, поэтому записаны здесь (R3). Применены 2026-11-11 (GUARD-2, ADR-003). Защита `main` ниже - классическая; после BOT-1 её заменяет ruleset (ADR-038), см. раздел «Бот для коммита тега».

## Diagnose

- Слияние и ветка: `gh api repos/FreyDv/bf --jq '[.allow_squash_merge,.allow_merge_commit,.allow_rebase_merge,.delete_branch_on_merge]'` -> `[true,false,false,true]`
- Защита `main`: `gh api repos/FreyDv/bf/branches/main/protection`
- Обязательные проверки: `gh api repos/FreyDv/bf/branches/main/protection/required_status_checks --jq '.contexts'` -> `["ci","image","spec-guard","secret scan"]` (`image` - после ручного добавления ниже)
- Видимость пакета образа: `gh api users/FreyDv/packages/container/bf-backend --jq '.visibility'` -> `public` (то же для `bf-frontend`; пакет появляется после первой публикации)

## Ожидаемое состояние

| Что | Значение | Откуда |
|---|---|---|
| Способ слияния | только squash; ветка удаляется после слияния | ADR-003 |
| Прямой push в `main` | запрещён, нужен PR, 0 одобрений (владелец один) | ADR-003 |
| Защита на админа (`enforce_admins`) | да | решение владельца 2026-11-11: проверки не обходятся |
| Обязательные проверки | `ci`, `image`, `spec-guard`, `secret scan` | `.github/workflows/ci.yml` (jobs `ci` и `image`), `spec-guard.yml`, `gitleaks.yml`; `image` добавляется вручную, см. ниже (ADR-036) |
| Пакеты образов `ghcr.io/freydv/bf-backend`, `bf-frontend` | публичные, без pull-секрета в кластере | ADR-026; видимость задаётся вручную после первой публикации |
| Актуальность ветки (`strict`) | нет | решение владельца 2026-11-11 |
| Force-push и удаление `main` | запрещены | R23 |

Имя проверки - это имя job, а при заданном `name` - оно. Переименовал job в workflow - обнови список в защите, иначе PR зависнет в ожидании проверки, которой нет.

## Добавить `image` в обязательные проверки

Один раз, после того как job `image` отработал хотя бы на одном PR (GitHub предлагает в списке только проверки, запускавшиеся за последнюю неделю):

1. Репозиторий -> Settings -> Branches -> правило для `main` -> Edit.
2. Блок «Require status checks to pass before merging» -> поле поиска «Status checks that are required» -> ввести `image` -> выбрать строку `image` (источник GitHub Actions).
3. Save changes.
4. Проверить командой из раздела Diagnose.

Job `publish` обязательным не делают: на PR его нет, проверка зависла бы. Пока `image` не добавлен, hadolint и сборка образа на PR не защищают `main` (ADR-028, ADR-029).

## Сделать пакеты образов публичными

После первого зелёного `image` и первой публикации в `main` (job `publish`) пакет, по ожиданию владельца, создан приватным (видимость проверяется, не предполагается: ADR-026 п. 2); шаг «Pull ... anonymously» на первом прогоне красный, это ожидаемо (ADR-026 п. 2). Для каждого из `bf-backend` и `bf-frontend`:

1. github.com/FreyDv -> вкладка Packages -> пакет -> Package settings (справа).
2. Danger Zone -> «Change package visibility» -> Public -> ввести имя пакета -> подтвердить.
3. Actions -> красный run workflow `ci` на `main` (job `publish`) -> «Re-run failed jobs»: анонимный pull должен пройти.
4. Проверить командой из раздела Diagnose.

## Безопасность репозитория (ADR-037, GHSET-1)

Состояние на 2026-11-12, команды чтения; три первых пункта выключены и ждут владельца.

| Что | Сейчас | Нужно | Проверка |
|---|---|---|---|
| Private vulnerability reporting | выключен (`{"enabled":false}`) | включить: Settings -> Advanced Security -> «Private vulnerability reporting» -> Enable ([документация](https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/configuring-private-vulnerability-reporting-for-a-repository)); `SECURITY.md` отправляет отчёты именно туда | `gh api repos/FreyDv/bf/private-vulnerability-reporting` -> `{"enabled":true}` |
| Dependabot alerts | выключены (404) | включить: Settings -> Advanced Security -> «Dependabot alerts» -> Enable ([документация](https://docs.github.com/en/code-security/dependabot/dependabot-alerts/configuring-dependabot-alerts)) | `gh api -i repos/FreyDv/bf/vulnerability-alerts` -> 204 |
| Dependabot security updates, version updates | выключены | не включать (ADR-037) | `gh api repos/FreyDv/bf --jq '.security_and_analysis.dependabot_security_updates.status'` -> `disabled` |
| Токен Actions по умолчанию | read-only, без права одобрять PR | оставить | `gh api repos/FreyDv/bf/actions/permissions/workflow` -> `{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}` |
| Запуск workflow от первых контрибьюторов | требует одобрения | оставить | `gh api repos/FreyDv/bf/actions/permissions/fork-pr-contributor-approval` -> `first_time_contributors` |
| Secret scanning и push protection | включены | оставить | `gh api repos/FreyDv/bf --jq '.security_and_analysis'` |

## Бот для коммита тега: GitHub App и ruleset (ADR-038, BOT-1)

Состояние на 2026-11-12: `gh api repos/FreyDv/bf/rulesets` -> `[]`, защита `main` классическая, бота и его секретов нет. Команды ниже не выполнялись: правки настроек и секретов GitHub делает владелец. Порядок важен: **сначала ruleset, потом снять классическую защиту**, иначе между шагами `main` останется без обязательных проверок.

Что должно получиться: бот (GitHub App) единственный обходит правила `main` и коммитит только `deploy/apps/<app>/image.yaml` (ADR-030); люди не обходят ничего.

1. **GitHub App.** Settings -> Developer settings -> GitHub Apps -> New GitHub App. Имя, например, `bf-tag-bot`; Webhook - снять «Active»; Repository permissions - только Contents: Read and write (Metadata: Read-only ставится сам); «Where can this GitHub App be installed» - Only on this account. Create. Записать App ID, затем «Generate a private key» (скачается `.pem`).
2. **Установка.** App -> Install App -> аккаунт `FreyDv` -> Only select repositories -> `bf`.
3. **Секреты Actions** (Settings -> Secrets and variables -> Actions -> New repository secret): `BOT_APP_ID` - App ID; `BOT_APP_PRIVATE_KEY` - содержимое `.pem`. Копию ключа - в менеджер паролей, файл с диска удалить. Ключ в репозиторий не попадает (gitleaks, ADR-037).
4. **Ruleset.** Settings -> Rules -> Rulesets -> New ruleset -> New branch ruleset: имя `main`; Enforcement status - Active; Bypass list - добавить App `bf-tag-bot`, режим Always (больше никого); Target branches - Include default branch; правила: Restrict deletions, Block force pushes, Require a pull request before merging (0 одобрений, разрешённый способ слияния - Squash), Require status checks to pass - `ci`, `image`, `spec-guard`, `secret scan` (без «Require branches to be up to date», решение владельца 2026-11-11). Create.
   То же через API: `gh api -X POST repos/FreyDv/bf/rulesets --input ruleset.json`, где `ruleset.json` - `{"name":"main","target":"branch","enforcement":"active","bypass_actors":[{"actor_id":<App ID>,"actor_type":"Integration","bypass_mode":"always"}],"conditions":{"ref_name":{"include":["~DEFAULT_BRANCH"],"exclude":[]}},"rules":[{"type":"deletion"},{"type":"non_fast_forward"},{"type":"pull_request","parameters":{"required_approving_review_count":0,"dismiss_stale_reviews_on_push":false,"require_code_owner_review":false,"require_last_push_approval":false,"required_review_thread_resolution":false,"allowed_merge_methods":["squash"]}},{"type":"required_status_checks","parameters":{"strict_required_status_checks_policy":false,"required_status_checks":[{"context":"ci"},{"context":"image"},{"context":"spec-guard"},{"context":"secret scan"}]}}]}`.
5. **Проверка ruleset:** `gh api repos/FreyDv/bf/rulesets --jq '.[] | {id,name,enforcement}'`, затем `gh api repos/FreyDv/bf/rulesets/<id> --jq '{bypass_actors, rules: [.rules[].type], checks: [.rules[] | select(.type=="required_status_checks") | .parameters.required_status_checks[].context]}'` - в `bypass_actors` один `Integration`, `checks` - четыре имени.
6. **Снять классическую защиту** (она блокирует бота, обязательные проверки у неё не обходятся): `gh api -X DELETE repos/FreyDv/bf/branches/main/protection`. Проверка: тот же запрос без `-X DELETE` отдаёт 404, а `gh api repos/FreyDv/bf/rules/branches/main --jq '.[].type'` перечисляет правила ruleset.
7. **Проверка боем** - первый коммит тега в DEPLOY-1: push бота проходит, `ci` на нём не стартует (`paths-ignore` в `ci.yml`, ADR-038 п. 8). Проверка человеком: прямой push в `main` отклонён с `GH013: Repository rule violations`.

После шага 6 таблица «Ожидаемое состояние» выше читается так: те же значения живут в ruleset, а `enforce_admins` заменён тем, что в списке обхода нет людей. Таблица и Diagnose обновляются в той же правке, что закрывает BOT-1.

## Common failures

| Symptom | Cause | Fix |
|---|---|---|
| PR вечно ждёт проверку | в защите имя, которого нет в workflow (например, остаток `ci ok` прототипа) | поправить список обязательных проверок |
| `publish` красный на шаге «Pull ... anonymously» | пакет приватный (первая публикация) | раздел «Сделать пакеты образов публичными» |
| `publish` красный на шаге «Scan ... for secrets» | в слоях образа найден секрет; образ не отправлен | убрать секрет из сборки (ADR-020, ADR-026), ротировать, если он настоящий |
| Нужно срочно залить в `main` в обход | защита действует и на админа | временно снять `enforce_admins`, залить, вернуть; записать причину в PR |
| Push бота отклонён: `GH013: Repository rule violations` | App не в списке обхода ruleset, либо классическая защита `main` ещё не снята | шаги 4-6 раздела «Бот для коммита тега» |

## Rollback

Снять защиту целиком: `gh api -X DELETE repos/FreyDv/bf/branches/main/protection`. Вернуть: повторить настройки таблицы выше через `gh api -X PUT repos/FreyDv/bf/branches/main/protection` или в Settings -> Branches.
