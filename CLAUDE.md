# CLAUDE.md

@AGENTS.md

Imported above, not linked, so it is always in context rather than read only if an agent
happens to open it. It is the single entry point and source of truth for conventions,
structure, and the spec-first workflow.

This repo follows repository-standards. `.standards-version` records the state it last
aligned to - a bookmark the next update measures from, never a version it is held at; the
target is always the latest.

## Before you start working: check whether a skill owns this

This repo ships the lifecycle procedures as skills in [`.claude/skills/`](./.claude/skills/).
They are not optional tooling and they are not only for when someone types their name.
**Before acting on a request, check whether one of them covers it, and use it if so** -
describing a feature, changing behaviour, breaking work down, building it, closing it,
capturing something out of scope, reviewing a branch, ingesting meeting notes, adding a backend
module or use case, moving to a newer standard version. Each skill's description says which
situation it is for.

The reason is not ceremony. Working around them produces the same code with none of the
record - no spec anyone can rebuild from, no decision written where the next person looks,
no backlog entry for the thing you noticed and skipped. The coupling guard will stop the
pull request anyway when a capability's code moves without its spec, so the choice is
between doing it as you go or doing it under review pressure at the end.

**After finishing a piece of work, check again** - the closing steps are the ones most
easily skipped: reconcile the spec against what you actually built, file what you noticed
and did not do, review your own diff before pushing.

## Two bodies of binding rules, loaded in every session

- **Repository Standards** (how the repo is run): `SPEC.md` is the normative core; the method manual, the
  standard's own decision records and digests are under `docs/standards/`.
- **Domain-Driven Hexagon** (how every backend is built): `.claude/rules/architecture-rules.md` (numbered,
  stack-agnostic rules) and `.claude/rules/ai-protocol.md` (how a session plans, implements and reviews) are
  loaded automatically. Plans for backend work MUST carry the `## Architecture conformance` section and MUST NOT
  deviate from the rules without a recorded ADR; a conflict is a stop, not a judgement call (AIP-1, AIP-4).

[`docs/standards/README.md`](docs/standards/README.md) says which deeper document to read for which task.
Deviation is legal only when it is recorded - as a manifest exception, a backlog row or a superseding decision
record - never silently.
