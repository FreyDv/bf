# Engineering principles

The top of the altitude hierarchy. These outrank local preference; nothing outranks them
except an explicit change to this file. The first eight are the standard's paved-road
defaults (`docs/standards/vendor/repository-standards-core/standard/docs/PRINCIPLES.md`), kept
as written; the rest are this repository's own, each backed by a recorded decision.

- **Boring, proven tech.** Prefer the dull, well-understood option. A new library or a new
  pattern needs an ADR.
- **Small, focused PRs.** One logical change; reviewable in minutes.
- **Exact versions, everywhere.** Dependencies, overrides, container images, CI runners and
  actions are pinned exact - no ranges, no `latest`, no floating tags; a committed lockfile
  seals the graph. Nothing a repo consumes moves without a reviewed diff (R21, standard
  ADR-017). _Today the pnpm catalog still carries `^` ranges; backlog `PINS-1` closes that gap
  and records the state until then._
- **Supply-chain cooldown.** Never install a package version published less than 7 days ago
  (pnpm's `minimumReleaseAge` once `PINS-1` lands). A critical security fix gets a temporary
  exclude, not a global lowering.
- **Single source of truth.** Every rule and every fact lives in exactly one place. No
  duplicated conventions across files; no invented data where a real source exists.
- **Decisions are recorded before they are built** (ADR / BDR). Accepted records are binding -
  if a change disagrees with one, stop and supersede it.
- **Reads OK, remote writes never.** No DML/DDL/migrations against a remote (dev or prod)
  database by hand - the pipeline applies committed migrations as one-off tasks; an agent
  prepares the file.
- **Secrets never live in the repo.** Secret manager + env vars only; gitleaks gates.
- **Leave the door open, do not walk through it.** Build the simple thing that runs now, with
  a documented path to scale later (see each ADR's "Revisit when").
- **Implement only what actually runs.** No speculative abstractions for a single use; no
  features nobody asked for (DDH-105/106: weigh every pattern's price).
- **The domain is framework-free and the architecture is enforced** (ADR-025). Every service
  follows Domain-Driven Hexagon; `pnpm deps` fails a boundary violation; a rule nobody can
  check is a mood.
- **One way to talk: tRPC, contract-first** (ADR-017). Front ends and services share hand-written
  zod contracts; the generated router type is the contract test.
- **TypeScript, run by plain `node`, for everything we author** (ADR-022/023): application
  code, ops and CI scripts, infrastructure (CDK). The standard's shipped shell guards are the
  one vendored exception.
- **Cost is a design input** (BDR-002). The platform stays within its recorded monthly cap;
  services sleep when idle; every infra change states what it costs. No DynamoDB, no extra
  state store, no always-on resource without a reason in an ADR.
- **The repo is the memory.** Decisions, specs, discovery and the backlog live here; a rule in a
  chat, a personal config or an agent's memory does not exist until it lands at its taxonomy
  home (R3, standard ADR-012).
