# Performance budgets

Lighthouse measurement for the app's key routes. Run it **before pushing** to see
whether your change sped the app up or slowed it down, per route, for desktop and
mobile.

This is a **local tool**, not a CI gate. The comparison is report-only - it never
fails your push. The committed `baseline.json` is the source of truth you compare
against; updating it is a deliberate, reviewable act. Nothing is uploaded anywhere
and nothing expires: baselines and dated history live in this folder, in git.

## Two halves: measurement is standard, environment prep is yours

- **Measurement** (`run-perf.mjs`, `compare.mjs`, `config.mjs`, `lh-*.mjs`) is
  generic: it points Lighthouse at `ORIGIN` and knows nothing about your stack.
- **Environment prep** - seed, build, start - is per-project: every repo prepares
  a measurable app differently. `scripts/perf-budget.sh` is the reference local
  wiring; its SEED / BUILD / START steps are overridable command hooks you adapt
  (`PERF_SEED_CMD`, `PERF_BUILD_CMD`, `PERF_START_CMD`).

## Targets: local vs any deployed env

- **`local`** (default): a **production build** served locally - the pre-push
  regression check. The env is yours (a local server, a prod-mode build, a test
  env); `perf-budget.sh` seeds, builds and starts it. **Local numbers are
  machine-specific**: read them as "did my change regress vs my own pre-work
  baseline?", not as a cross-team trend.
- **any other name** (`dev`, `qa`, `perf`, `staging`, `prod`, ...): the app
  **deployed** to that environment. Real URL, real (stable) machines - it seeds and
  builds *nothing*, so its history is a comparable trend. Set `PERF_WEBAPP_URL` to
  the deployed origin, e.g. `PERF_TARGET=qa PERF_WEBAPP_URL=https://qa.your-site`.

Keep routes **read-only and public** (see `config.mjs`) so measuring a deployed
target never creates real traffic or data. Each target keeps its **own**
`baseline.<target>.json` and history, so trends never mix. Deployed numbers reflect
real CDN/network/third-party and are far harsher than local; treat them as
monitoring, not a per-PR signal.

**Committing history:** baseline + `history/` are committed for every target. The
**deployed** targets are the trustworthy trend (stable hardware); whether you also
commit **local** history is your call - useful for a single maintainer on one
machine, but local numbers do not compare across different machines. For meaningful
local numbers, pin a **defined app state** (seed a containerised DB via
`docker-compose.test.yml` / `bootstrap:test-stack`) so at least the data is
repeatable - the machine still varies.

## Usage

```bash
# Local target (production build served locally) - the pre-push regression check
pnpm test:perf          # build+start app (prod mode), measure, print report
pnpm test:perf:update   # same, but overwrite baseline.json from this run
#   apps that need data first: PERF_SEED_CMD="pnpm db:init" pnpm test:perf

# Deployed targets (real dev/prod machines) - monitoring, NOT a pre-push gate.
# No seed/build/start: they measure the live URL you point them at.
PERF_TARGET=dev  PERF_WEBAPP_URL=https://dev.your-site pnpm test:perf:remote   # vs baseline.dev.json
PERF_TARGET=prod PERF_WEBAPP_URL=https://your-site     pnpm test:perf:remote   # vs baseline.prod.json
# add :update (test:perf:remote:update) to overwrite that target's baseline
```

Requirements: Google Chrome installed (Lighthouse drives it headless), plus
whatever your SEED step needs for the local target.

## Workflow

1. On a clean `main`, run `pnpm test:perf:update` once and commit `baseline.json`.
   That records the accepted numbers.
2. On your branch, run `pnpm test:perf` before pushing. Read the table: `v slower`
   rows with `!` (>=5%) or `!!` (>=10%) flag regressions vs the baseline.
3. If your change *intentionally* moves performance (better or worse, and
   accepted), run `pnpm test:perf:update` and commit the new baseline in your PR so
   the team reviews the accepted trend.

## What it measures

The routes in `config.mjs` (each on **desktop** and **mobile**, median of 3 runs).
Edit that list to match your app. Metrics per route: Performance score, LCP, FCP,
Speed Index, TTI, TBT, TTFB, CLS.

## How it works

`scripts/perf-budget.sh` prepares the local environment (SEED / BUILD / START
hooks) then runs:

- `run-perf.mjs` - launches one headless Chrome, warms then measures every
  route/profile, writes medians to `.results/last.json` (git-ignored), and drops a
  dated snapshot into `history/` (committed - see `history/README.md`).
- `compare.mjs` - diffs `.results/last.json` against `baseline.json` and prints the
  report (`--update` overwrites the baseline instead).

Each Lighthouse run executes in an isolated child process (`lh-worker.mjs`) because
Lighthouse does not release its trace memory between runs in one process.

### Env overrides

| Var | Default | Purpose |
| --- | --- | --- |
| `PERF_WEBAPP_URL` | `http://127.0.0.1:3000` | Where the app serves (required for `dev`/`prod`) |
| `PERF_SEED_CMD` | none (opt-in) | Prepare data, only if your app needs it (e.g. `pnpm db:init`) |
| `PERF_BUILD_CMD` | `pnpm --filter web build` | Production build |
| `PERF_START_CMD` | `pnpm --filter web start` | Serve the build at `PERF_WEBAPP_URL` |
| `PERF_SKIP_BUILD=1` | - | Reuse a prior build |
| `PERF_RUNS` | `3` | Runs per route/profile (median recorded) |
| `PERF_WARMUP_HITS` | `3` | Warmup GETs before measuring (`0` to skip) |
