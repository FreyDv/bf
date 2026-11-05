# Changelog

All notable changes to this project, in [Keep a Changelog](https://keepachangelog.com/)
style. Semver: MAJOR = breaking changes, MINOR = new functionality (backwards compatible),
PATCH = fixes and clarifications.

## Unreleased

<!-- A PR describes its change here, one entry per change - never a version heading, never
     VERSION itself (R18). The maintainer alone promotes this section into a release:
     https://github.com/repository-standards/core/blob/main/docs/method/changelog-process.md -->

### The repository adopts Repository Standards and binds every service to Domain-Driven Hexagon (2026-11-04)

For the owner and every future contributor or agent: the repository now carries the standard's
shipped tree (`AGENTS.md` as the single entry point, `SPEC.md`, the manifest, the lifecycle
skills, the guards and the CI gates), a knowledge base under `docs/standards/` holding both
standards verbatim with digests of everything they cite, and the binding form of
Domain-Driven Hexagon for this stack (`docs/standards/domain-driven-hexagon/bf-mapping.md`,
`.claude/rules/`, the per-app dependency-cruiser rules). The first brownfield wave recorded its
intake, assessment and provenance under `docs/`; the questions a person must answer are the
`[NEEDS REVIEW]` markers and the backlog's alignment scope. No runtime behaviour changed.
