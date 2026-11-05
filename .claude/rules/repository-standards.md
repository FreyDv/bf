---
paths:
  - 'specs/**'
  - 'docs/**'
  - 'scripts/**'
  - '.github/**'
  - 'infra/**'
  - '*.md'
---

# Repository Standards - hard rules for documents, specs, decisions and delivery

The normative core is `SPEC.md` (R1-R28); the reasoning is in
`docs/standards/vendor/repository-standards-core/`. These are the ones a session breaks most
easily:

1. **Specs by capability, buildable** (R8, R9): `specs/<capability>/spec.md`, never per ticket,
   page or version; contracts quoted verbatim; every spec names a persona from
   `docs/personas.md` (R10) and has an entry in `specs/capability-map.json` (R11). A change to a
   capability's code lands in the same PR as its spec.
2. **Clarify gate** (R12): no plan, tasks or implementation while a spec carries any
   `[NEEDS CLARIFICATION|DECISION|INPUT|ASSET: ...]` marker; `## Open questions` says
   "None known." or the spec is not ready. The marker forms and the headings are syntax: never
   translated or reworded.
3. **Decisions** (R5-R7): a contestable, re-litigable choice is an ADR (technical) or BDR
   (business) in `docs/decision-records/`, MADR form from `_template.md`, with `## Revisit when`
   filled; an Accepted record is never edited into a different decision - supersede it; every
   record is listed in its stream's `README.md` index (the check script fails otherwise).
4. **Living documents** (R4, R18): update in place; no change-log sections in specs or docs;
   history goes to git and to `CHANGELOG.md` under `## Unreleased` - never a version heading or a
   version bump in a PR.
5. **Backlog** (R15): every row has `source`, `owner` role, persona, `why` and a definition of
   done; a closed row is relocated to `docs/backlog-archive.md` with a `where`, never deleted;
   work noticed in passing goes through `add-to-backlog`.
6. **Knowledge lives in the repo** (R3): a rule that exists only in chat, memory or a personal
   config does not exist - land it at its taxonomy home.
7. **Vendored standard files are read-only**: anything the manifest marks `copy` (`SPEC.md`,
   `standard.manifest.json`, `scripts/*.mjs`, `scripts/spec/`, `.claude/skills/*` shipped by the
   standard, `.claude/hooks/`, `.claude/elicitation/`, templates) and `docs/standards/vendor/**`.
   A deliberate change is a manifest `exceptions` entry with a reason, not a silent edit.
8. **Supply chain** (R21): exact pins and a committed lockfile are the target (backlog `PINS-1`
   records the current `^` ranges as a known deviation); never `latest`, never a floating
   action tag; pinned actions by digest in workflows.
9. **Integration** (R23): base every branch on `main`, update by rebase, land by squash-merge
   (ADR-027); never force-push a shared branch.
10. **Verify before claiming**: `node scripts/self-verify.mjs`, `node scripts/spec-structure.mjs
--block`, `node scripts/spec-guard.mjs --audit --block`, `node scripts/decision-records-check.mjs
--block` - the pipeline's `spec-guard` job runs them; a check you did not run is not a check
    that passed.
