# Changelog

All notable changes to this project, in [Keep a Changelog](https://keepachangelog.com/) style. Semver: MAJOR = breaking changes, MINOR = new functionality (backwards compatible), PATCH = fixes and clarifications.

## Unreleased

<!-- A PR describes its change here, one entry per change - never a version heading, never VERSION itself (R18). The maintainer alone promotes this section into a release: https://github.com/repository-standards/core/blob/main/docs/method/changelog-process.md -->

### North Star and success metrics (2026-11-12)

For every future spec author: `PRODUCT.md` now names the North Star (fulfilled orders per month), three supporting metrics, one guardrail metric, the ~12-month horizon and the stake (BDR-002 Accepted). A spec's `Success metric` points at one of them; targets wait for three months of data (backlog METRICS-1).

### Personas confirmed by the owner (2026-11-11)

For every future spec author: the four personas are now confirmed and binding (BDR-001 Accepted) - `Владелец-оператор` (Даня, primary), `Кондитер` (Валерия), `Покупатель`, `ChatGPT через MCP` - with every field filled in `docs/personas.md`. The owner's product story is filed under `docs/discovery/product-vision/`; `PRODUCT.md` no longer says the platform serves one person.

### Clean slate with repository standards and binding architecture rules (2026-11-05)

For the owner and every future contributor or agent: the earlier prototype (services, infrastructure, decisions) was removed. The repository now carries only its foundation: the standard's shipped tree (`AGENTS.md` as the single entry point, guards, skills, CI gates), a knowledge base under `docs/standards/` holding both sources verbatim with digests, and the Domain-Driven Hexagon rules extracted into stack-agnostic, always-loaded rules (`.claude/rules/architecture-rules.md`, `.claude/rules/ai-protocol.md`) with skills for planning, implementing and reviewing. No stack is chosen yet.
