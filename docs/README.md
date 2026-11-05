# Documentation

Hub for this repo's docs. Start where you need:

| Doc | For |
|-----|-----|
| [specs/](../specs/) | **what the system does now** - living capability specs (empty until the first capability) |
| [PRODUCT.md](PRODUCT.md) | what this is, the vision, the future |
| [ARCHITECTURE.md](ARCHITECTURE.md) | how it is built - structure and boundaries |
| [PRINCIPLES.md](PRINCIPLES.md) | engineering principles (top of the hierarchy) |
| [decision-records/](decision-records/) | ADR / BDR - the *why* (decisions) |
| [personas.md](personas.md) | who the product is for - the roster every capability spec names |
| [backlog.md](backlog.md) | the ordered work the repo still owes itself; the alignment scope count |
| [adoption-intake.md](adoption-intake.md), [adoption-assessment.md](adoption-assessment.md), [adoption-provenance.md](adoption-provenance.md) | what the adoption measured, asked and found, and who answered what |
| [standards/](standards/README.md) | **the knowledge base**: Repository Standards and Domain-Driven Hexagon, vendored in full, digested, and turned into binding rules |
| [conventions.md](conventions.md) | the standard's canonical conventions block (merged into `AGENTS.md`, kept for diffing against updates) |
| [discovery/](discovery/) | discovery dossiers - raw material per topic, with provenance (never normative) |
| [ideas/](ideas/) | speculative ideas under a status, before they earn a spec or a record |
| [runbooks/](runbooks/) | operational runbooks and postmortems |
| [facts.example.json](facts.example.json) | the shape of `facts.json` |

The binding architecture rules live outside `docs/`, where they load automatically:
[`.claude/rules/architecture-rules.md`](../.claude/rules/architecture-rules.md) and
[`.claude/rules/ai-protocol.md`](../.claude/rules/ai-protocol.md).

Agents: the entry point is the repo-root `AGENTS.md`.
