# Layer 2 - Node/TypeScript paved road: the decisions

Evidence-based, not blog-based. Every pick below was distilled from two production
monorepos (call them repo A and repo B) and cross-checked against 2026 community
consensus. Where the repos disagreed, the pick went to the side the community backs.
This file is the *why*; the runnable truth is [`starter/`](starter/). Deviating from a
pick? Record a superseding ADR in your repo (ADR-004) - the paved road is a default,
not a cage.

## The picks, by area

Read the area you are arguing about. Each row names what the pick was chosen against;
the sections below carry the reasoning, one per axis.

### The ground floor

Chosen once, and every other pick assumes them.

| Axis | Pick | Escape hatch |
|---|---|---|
| Package manager | pnpm, Node 24 pinned | - |
| Task runner | Turborepo | Nx at 10+ packages / enforced boundaries |
| Lint + format | Biome (+ Prettier for SCSS only) | minimal ESLint for a plugin Biome lacks |
| TypeScript | strict base + `noUncheckedIndexedAccess` + `noImplicitOverride` | leaf tsconfig per app |
| Supply chain | 7-day `minimumReleaseAge` + `allowBuilds` | scoped exclude for critical security bumps |

### The application

What the running thing is made of.

| Axis | Pick | Escape hatch |
|---|---|---|
| Next.js | App Router, standalone, typed config + security headers | - |
| Fastify DI | native plugins, no container | `@fastify/awilix` when the graph outgrows wiring |
| Proxy | Next `proxy.ts` (Node runtime) + rewrites -> Fastify | - |
| Auth | Better Auth (product) / `openid-client` module (enterprise SSO) | - |
| Styling | CSS Modules + SCSS, DTCG three-tier tokens | Tailwind, superseded locally per ADR-004 |
| Env config | Zod-validated schema at boot | - |
| Request validation | Zod at the Fastify boundary via type provider | `@fastify/type-provider-typebox` for OpenAPI needs |
| Logging | pino, JSON lines to stdout, redacted at the edge | structured console in edge/serverless contexts |

### Proving it works

How a change is shown to be safe before it lands.

| Axis | Pick | Escape hatch |
|---|---|---|
| Testing | Vitest + Playwright, tiered; Lighthouse as a local perf budget (committed baseline + history, no CI gate) | - |
| CI | least-privilege permissions + pnpm cache + frozen lockfile | another CI vendor / self-hosted runners, same shape |
| Dependency updates | Renovate, pin-everything, 7-day cooldown, grouped minor/patch | Dependabot when the org already lives in it |

### Left to you, deliberately

Decided per repository, because centrally there is no right answer.

| Axis | Pick | Escape hatch |
|---|---|---|
| Datastore + query layer | per-repo ADR (Postgres default; Drizzle/Kysely/Prisma fork) | - |
| Containers + deploy | container-ready shape ships; Dockerfile + target per-repo ADR | - |

## 1. Package manager - pnpm

**Pick:** pnpm, pinned via `packageManager` + `engines`, Node 24 pinned via `.nvmrc`.
Content-addressed store, strict resolution (no phantom deps), first-class workspaces,
and the strongest supply-chain story of the three managers (see #8). Both reference
repos agree; so does the 2026 default recommendation for new monorepos.
Stricter resolution occasionally trips a hoisting-reliant package - the fix is an
explicit dependency, which is the point.

## 2. Task runner - Turborepo

**Pick:** Turborepo - content-hash caching, `dependsOn` task graph, near-zero config,
pnpm-native. The standing advice holds: start with Turbo, graduate to Nx when
coordination is the bottleneck (10+ packages, multiple teams, enforced project
boundaries). Nx is the documented escape hatch, not the default.

## 3. Lint + format - Biome

**Pick:** Biome as the one linter+formatter; Prettier scoped to `*.scss` only (Biome
does not format SCSS). One tool, one config, 10-50x faster than ESLint in CI, a11y
preset included. The gap: no type-aware rules needing the TS language service, and some
framework plugins have no Biome equivalent. If you truly need one of those, add a
minimal ESLint alongside - never as the primary.

## 4. TypeScript - strict, target stratified by layer

**Pick:** `strict: true` plus `noUncheckedIndexedAccess`, `noImplicitOverride`,
`noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`,
`noFallthroughCasesInSwitch`; base `target: ES2022`. Strict-from-day-one is the settled
consensus, and `noUncheckedIndexedAccess` catches the real index bugs. Leaf `tsconfig`
per app sets `module`/`jsx`/`moduleResolution`. `verbatimModuleSyntax` is skipped:
Biome's `useImportType`/`useExportType` already enforce type-only imports.

## 5. Fastify - native plugin DI, no container

**Pick:** Fastify-native DI - plugins + `decorate`/hooks + `setErrorHandler`, no IoC
container. Blogs lean toward `@fastify/awilix`; both production repos independently
shipped without a container, and encapsulation via plugin scope plus request-scoped
`decorateRequest` covers the need with one fewer framework. Reach for awilix only when
a service's graph genuinely outgrows native wiring, and record it as an ADR.
Layering: `src/{lib,middleware,routes}` - external clients, the hook chain + error
handler, route files. Twelve-Factor applies: config from the environment (validated
once, at boot), stateless processes, logs to stdout.

## 6. Env config - Zod-validated schema at boot

**Pick:** a Zod schema validates every env var at boot - defaults, transforms, fail
fast with a readable error. Raw `process.env` reads scattered through a service are the
weakest spot in otherwise strong repos; one schema is the fix and the Twelve-Factor
config story in practice.

## 7. Next.js - App Router, standalone, typed config

**Pick:** App Router, `output: "standalone"`, a typed `next.config.ts` carrying the
security headers plus a **report-only CSP baseline** - it observes without ever
breaking the app, and its report is the enforcement worklist. Enforcing CSP is a
per-app step: per-request nonces plumbed through `proxy.ts` (it runs per request on
the Node runtime; Next picks the nonce up for its own inline scripts) - the config
comment carries the recipe. React 19 for greenfield. Never
`typescript.ignoreBuildErrors` - it is an anti-pattern observed in the wild, not a
config option.

## 8. Supply-chain cooldown - 7 days

**Pick:** `minimumReleaseAge: 10080` (7 days) in `pnpm-workspace.yaml`, plus an
explicit `allowBuilds` allow-list and `enablePrePostScripts: false`. pnpm 11 ships a
1-day cooldown by default; real incidents (Shai-Hulud ~12h, the chalk/debug compromise
~2.5h) sat inside that window, so the paved road is more conservative. Critical
security bumps use a scoped exclude, never a global lower.

## 9. Testing - Vitest + Playwright, tiered; Lighthouse as a local perf budget

**Pick:** Vitest (unit + integration) + Playwright (e2e) + Lighthouse (advisory perf
budgets), orchestrated from the repo root so the commands are discoverable and
Turbo-cacheable. The tiers: unit proves one module's logic (no I/O, milliseconds);
integration proves the contract with a real backing service via an ephemeral Docker
test-stack (`docker-compose.test.yml`, non-default ports, tmpfs, healthchecks - never a
shared dev DB); e2e proves a user journey through the booted app. Unit and integration
tests are co-located (`*.test.ts` / `*.integration.test.ts`, split by Vitest project);
journeys live in a top-level `e2e/` workspace package because they cross app
boundaries. Money / security / external-contract paths are non-negotiable at the
integration tier and above (mirrors the
[testing-strategy checklist entry](https://github.com/repository-standards/core/blob/main/docs/method/checklist.md)).
Maintenance rules: coverage is a floor on paths that matter, not a vanity percentage;
flaky tests are quarantined with an owner, never retried-forever; a test changes in the
same PR as its spec; if the unit suite needs Docker, it is mis-tiered.

**Pick (perf):** Lighthouse driven by a small in-repo runner (`perf/`, the `lighthouse`
package on headless Chrome), **not** Lighthouse CI and **not** `temporary-public-storage`.
Rationale: LHCI's easy upload target is a public bucket that auto-expires after a few
days - the opposite of what a perf record is for. This runner is a **local, report-only
pre-push tool** (never a CI gate, never fails a push): it diffs the run against a
committed baseline and prints per-route deltas; moving the baseline is a deliberate,
reviewed commit. Retention is the point: the rolling `baseline*.json` and an append-only
dated `history/` are **committed** (kept, especially for deployed targets), while the
live `.results/` is gitignored (local runs are not retained); nothing is uploaded
anywhere and nothing expires. Measurement is standard and generic (it points Lighthouse
at an origin); preparing a measurable environment - build, start, and seed only if the app
needs data - is the per-repo **adapt** seam (`scripts/perf-budget.sh`, overridable command
hooks; seeding is off by default - but if the app's numbers depend on data, pin a
**defined state** (seed a containerised DB via `docker-compose.test.yml` /
`bootstrap:test-stack`, or a fixed dataset) so a run is repeatable). Targets: `local` is
the only one built and served for you; **any other name** (`dev`, `qa`, `perf`, `staging`,
`prod`, ...) is a **deployed** target, measured at its real URL with no seed/build/start,
each with its own `baseline.<target>.json` + history. Routes stay read-only so measuring a
deployed target never creates real traffic or data.

Methodology - what a number is worth depends on where it came from. **Local numbers are
machine-specific**: even a repeatable app state still runs on each developer's own CPU, so
local results are a **relative pre-push check** ("did my work regress against my own
pre-work baseline?"), not a cross-team trend. The **comparable, trackable signal is a fixed
deployed environment** (dev/qa/perf/prod) - stable hardware, so its committed history is a
real trend. Both baseline and history are committed for every target (a single maintainer
on one machine gets value from local history too); whether a team commits *local* history
is their call, made with the machine-variance caveat in mind. For continuous prod health,
prefer RUM over synthetic runs against the live site (see the RUM pick below).

**Pick (RUM):** The synthetic budget above answers "did my change slow things down?" on one
controlled machine; it cannot answer "how slow is it for real users?" - that is Real User
Monitoring, and the two are complements. The **method is fixed, the vendor is not**: measure
with the **`web-vitals` library** (the primitive everyone - Sentry, Grafana Faro, Vercel, GA
- wraps, because only it matches how Chrome reports to CrUX), report **p75/p95** segmented by
device and route (the mean buries the tail that is the real experience), and validate the
SEO-facing number against **CrUX** (the 28-day field dataset that actually feeds ranking).
Sentry is **not** a Web-Vitals platform - it is an error tool with an APM bolted on - so we
do not anoint it; we standardise the primitive and treat the reporting **sink as a thin,
swappable adapter** (one `sink(metric)` function).

The starter ships the neutral half: `web-vitals` (attribution build) in
`instrumentation-client.ts` -> a one-function `reportWebVital` sink -> an `/api/vitals`
beacon stub you point at your store. It runs with no vendor account. Recommended sink when
you have it: **Sentry** - a team already running it for errors adds RUM with the browser SDK
at near-zero new ops (its browserTracing auto-captures the same vitals). Env-gate it by
`NEXT_PUBLIC_SENTRY_DSN` (no-op locally and in CI), keep `sendDefaultPii: false`, and
**Session Replay off by default** (DOM/PII). The cost caveat that decides when to swap: in
Sentry, Web Vitals ride on **spans**, billed per-span since Aug 2025 (the free span quota was
halved to 5M) with no metrics-only path - so hold `tracesSampleRate` ~0.1, and when cost or
scale bites, swap the sink to **Grafana Faro self-hosted** or keep the **DIY beacon ->
Prometheus/Loki** (both ~$0 into an existing Grafana stack, more ops) or **Vercel Speed
Insights** (if on Vercel). Close the loop with an **alert on a Web-Vitals budget** (e.g. p75
LCP over target on a key route) so a regression pages someone instead of living on an
unwatched dashboard.

Fixing what RUM finds is **not** a checklist we freeze here - it would go stale and never fit
every app. Use the **attribution build** (`web-vitals/attribution`) to locate the actual
cause - the LCP element, the INP interaction/handler, the shifting node - then apply the
current canonical technique from **web.dev** (Optimize LCP / INP / CLS). Diagnose, then fix
against living guidance; don't ship a static optimisation plan. Division of labour: synthetic
catches regressions **before merge**, RUM measures what real devices and networks **actually
experience** - run both.

## 10. App shell - auth, proxy, styling

**Pick (auth):** Better Auth for product auth - sessions in your Postgres, MFA and
rate-limiting built in; it is the 2026 default for new TS apps and now maintains
Auth.js/NextAuth, which is no longer the pick for new projects. Enterprise OIDC SSO
uses `openid-client` in one framework-agnostic shared module, so the same code serves
Next's auth routes today and a standalone Fastify tomorrow. Sessions: DB-backed and
revocable, short-lived with silent server-side refresh and an absolute cap.

**Pick (proxy):** Next `proxy.ts` on the Node runtime (it may query the DB, so the
session gate is revocable, not JWT-blind); Next `rewrites` route app-to-API traffic to
the Fastify service in dev and single-origin deploys. Auth gates live in both the proxy
and the service (default-deny) - the proxy is UX, the service is the boundary.

**Pick (styling):** CSS Modules + SCSS - co-located `*.module.scss`, no CSS-in-JS
runtime; design values come from DTCG three-tier tokens so the visual language has one
source. Tailwind is the recorded escape hatch for teams already living in it.

All three are assembled and boot-verified in [`starter/`](starter/): `pnpm i && pnpm dev`
boots web + api wired through the proxy with Better Auth in place.

## 11. CI - least-privilege, cached, frozen, pinned

**Pick:** GitHub Actions with explicit least-privilege `permissions:` per workflow
(`contents: read` unless a job proves it needs more), pnpm + Turbo caches, installs
with `--frozen-lockfile`, and every action pinned by full commit SHA with a version
comment (the core standard's exact-pinning rule, ADR-017 there). Two workflows, two
speeds: a fast quality gate on every push (`check:all` + unit), the full e2e tier
gating release.

**Why:** the workflow file is the most-copied file in any repo - whatever it does
becomes the org's habit. Least-privilege and SHA pins cost nothing on day one and are
expensive to retrofit after the fleet copies the loose version.

**Escape hatch:** another CI vendor or self-hosted runners when the org mandates them -
keep the same shape (least-privilege, frozen installs, pinned steps); the shape is the
decision, the vendor is not.

## 12. Dependency updates - Renovate, riding the cooldown

**Pick:** Renovate - `config:recommended` base, pin-everything range strategy,
`minimumReleaseAge: "7 days"` mirroring the pnpm cooldown (#8), minor/patch updates
grouped, labels on. The starter's [`renovate.json`](starter/renovate.json) is the
reference copy.

**Why:** exact-pin-everything without update automation is how repos age in place - the
pinning axis (#8 and the core standard's exact-pin rule) makes an update *chore*
mandatory, Renovate makes it happen as reviewed diffs.

**Escape hatch:** Dependabot when the org already lives in it - keep the cooldown and
the pin strategy either way.

## 13. Logging - pino, one JSON line per event, redacted at the edge

**Pick:** pino as the one log shape - it is already Fastify's engine; logs go to stdout
as JSON lines (the platform aggregates; the app never writes files); secrets and
session material are redacted at the logger config (authorization/cookie headers);
request-id correlation on. The web app does not log to the browser console (Biome's
`noConsole` flags it, allowing only console.error/warn) - user-facing failures surface in the UI, server truth lives
in the API's log.

**Why:** one shape means one query language in any aggregator; redaction at the edge
means a leaked log is not a leaked session.

**Escape hatch:** a different transport/aggregator is config, not a new logger;
structured console in edge/serverless contexts where pino's stream model does not fit.

## 14. Request validation - Zod at the boundary

**Pick:** Zod schemas validate every request body/query at the Fastify boundary via
`fastify-type-provider-zod` - the same library and pattern the env schema (#6) already
establishes; handlers receive typed, validated input or the request 400s before any
logic runs. The starter currently ships no body-carrying route - this axis pre-decides
the tool so the first POST does not improvise; the env schema is the worked example of
the pattern.

**Why:** validation duplicated per-handler drifts; a type provider makes the schema the
single source of both runtime check and static type.

**Escape hatch:** `@fastify/type-provider-typebox` when JSON-schema output matters more
than Zod ergonomics (OpenAPI generation).

## 15. Datastore, query layer and migrations - decided per repo, by ADR

**Pick:** deliberately NOT decided here - this is the fork the core standard's decision
checklist makes every repo record for itself (datastore, schema evolution). The
paved-road guidance the ADR starts from: Postgres is the default datastore (the
test-stack ships it; the auth package documents the swap and the integration test
proves it); the query layer is the real fork - Drizzle (SQL-first, migrations from
schema diffs), Kysely (query builder, bring your own migrations), Prisma (schema DSL,
heaviest but most guided) - one ADR, three options, pick by the team's SQL fluency; the
migration tool follows the query-layer choice; Better Auth's tables ride its own
migrator regardless.

**Why deferred:** any pick here would be taste dressed as evidence - the axes above are
distilled from production repos, this one genuinely varies by product shape (read/write
mix, multi-tenancy, reporting). A recorded per-repo ADR beats a hollow default.

## 16. Containers and deploy - the shape is decided, the target is a per-repo ADR

**Pick:** the container-ready shape ships (Next `output: "standalone"`, the api runs
plain node, both log to stdout, config is env-only) - but no Dockerfile and no deploy
target: that is a per-repo ADR. What the ADR must cover: base image pinned by digest
(the exact-pin rule reaches images), a non-root user, healthcheck endpoints (the api
already has `/api/health` and `/api/ready`), env injection per environment, and where
the two processes run relative to each other (one origin via the proxy vs split).

**Why deferred:** the deploy target is the least portable decision a repo makes - the
starter refusing to fake one keeps the boot honest.

**Escape hatch:** none needed - this axis IS the escape hatch, recorded.

## 17. Monorepo layout - `apps/` for everything deployed, `packages/` for everything else

**Pick:** two top-level workspace roots. `apps/*` holds every deployable - the Next
application and the Fastify service sit side by side, UI or not. `packages/*` holds code
that is never deployed on its own. Plus two single-purpose roots that are not libraries and
not deployables: `e2e/` for journeys that cross applications, `perf/` for the local budget
runner.

**Why not `services/` beside `apps/`:** the split reads as "has a UI" versus "does not",
and that line breaks the first time somebody adds a backend-for-frontend, an admin panel or
a worker with a status page. It also implies the two are deployed differently, which the
starter does not do - both are plain node processes, both log to stdout, both take env-only
config. A third top-level concept earns its place when a team genuinely treats backends
differently: separate on-call, separate release train, separate ownership. Until that is
true, it is a folder that has to be explained.

**Why not `libs/`:** it pairs neatly with `apps/`, and there is a real argument for it -
in a pnpm workspace every member is a package, apps included, so `packages/` names a subset
using the word for the whole. That is a naming purity worth less than meeting the
expectation of everyone arriving from this ecosystem, where `packages/` is what Turborepo
and pnpm examples use. `libs/` is the Nx convention; a repo already living in Nx should keep
it and record the deviation.

**Escape hatch:** rename either root. Nothing in the tooling depends on the names - the
globs are two lines in `pnpm-workspace.yaml` - so the cost of deviating is a decision
record, not a migration.

## Open questions - decided, provisionally

The stack owns its own doubts (the core's open-questions catalog explains the
genre: a standing "I chose X, convince me of Y").

- **Better Auth as the product-auth default.** Decided in #10 - the 2026
  community default, and it now maintains Auth.js; `openid-client` for
  enterprise SSO is field-proven. Doubt: Better Auth here is proven by one boot,
  not by fleets. Better: field evidence beyond the starter - evidence over
  consensus.
- **CSS Modules + SCSS over Tailwind.** Decided in #10 - matches the evidence
  repos; Tailwind is the recorded escape hatch. Doubt: a large slice of the 2026
  ecosystem defaults to Tailwind; this is the closest pick to taste in the whole
  stack. Better: a criterion that makes the choice situational (team,
  design-system maturity) instead of one paved road.
