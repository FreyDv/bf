# Personas

Who this repository serves. A capability spec's `**Serves:**` field must name somebody on
this roster, so the roster is the constraint rather than a description written once.

Reconstructed from what this repository actually addresses: the two entry sentences in
[`README.md`](../README.md) and [`QUICKSTART.md`](../QUICKSTART.md), the per-entry migration
notes in [`ADAPTING.md`](../ADAPTING.md), and the delisting condition in the core's
ADR-016 (an official stack keeps a named owner and a live boot CI).

## The roster

| Persona | Who they are | What they need from this repository |
|---|---|---|
| `Adopting repo owner` | Someone whose Node/TypeScript repository already exists and already has picks - some of which will disagree with these | An ordered path from what they have to what this ships that never leaves the build red, and an argued reason to change each thing they are being asked to change |
| `Greenfield starter` | Someone with no repository yet, who wants the picks made rather than researched | A scaffold that boots, with the decisions already taken and recorded, so the first week is product work |
| `Adoption agent` | The coding agent executing either of the two sentences, reading this repository unattended | Machine-readable entries it can classify a repository against, and prose unambiguous enough that two runs on the same repository do the same thing |
| `Reader deciding` | Someone comparing this against their own conventions, who may adopt nothing | Each pick's alternative and its escape hatch, readable without cloning anything |
| `Stack maintainer` | The named owner keeping the picks current against a moving ecosystem | Evidence that the reference implementation still boots, and a small enough surface that a framework major is a contained change |

## Deliberately not served

- **A team wanting a framework to depend on.** Nothing here has a version your project
  resolves ([`WHAT-THIS-IS.md`](../WHAT-THIS-IS.md)); a dependency is the shape this
  repository refuses.
- **A second Node stack.** One stack per technology is policy, not preference - variation is
  a profile or an adoption mode inside this repository, never a sibling repository.
