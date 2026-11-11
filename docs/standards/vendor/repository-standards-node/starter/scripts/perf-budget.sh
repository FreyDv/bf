#!/usr/bin/env bash
#
# Local Lighthouse performance-budget run.
#
# CONTRACT: get a PRODUCTION build of the app serving at PERF_WEBAPP_URL against
# representative data, then measure it (perf/run-perf.mjs) and print a
# baseline-vs-current report (perf/compare.mjs). Nothing here ever fails your push.
#
# The measurement half (perf/*.mjs) is standard and generic. The steps below -
# SEED, BUILD, START - are the ADAPT seam: every project prepares its environment
# differently, so each is an overridable command hook. BUILD and START have starter
# defaults; SEED is OFF by default (not every app has data to prepare - a static or
# no-DB app seeds nothing). Apps that need representative data set PERF_SEED_CMD.
#
# Usage:
#   pnpm test:perf          # measure + report (never fails)
#   pnpm test:perf:update   # measure + overwrite the committed baseline
#
# Env overrides:
#   PERF_WEBAPP_URL    default http://127.0.0.1:3000  (where the app serves)
#   PERF_SEED_CMD      default none - opt-in. For meaningful numbers pin a defined
#                      state, e.g. `pnpm bootstrap:test-stack` (seeded containers) or
#                      `pnpm db:init`; the data won't vary then, the machine still will
#   PERF_BUILD_CMD     default `pnpm --filter web build`
#   PERF_START_CMD     default `pnpm --filter web start` (must serve at PERF_WEBAPP_URL)
#   PERF_SKIP_BUILD=1  skip the build step (reuse a prior build)
#
# This script is the LOCAL target only. Any deployed target (dev, qa, perf, prod,
# ...) has NO prep - it measures the already-deployed site directly, bypassing this
# script; the name is just a label that picks its own baseline + history:
#   PERF_TARGET=dev  PERF_WEBAPP_URL=https://dev.your-site  pnpm test:perf:remote
#   PERF_TARGET=prod PERF_WEBAPP_URL=https://your-site      pnpm test:perf:remote

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEBAPP_URL="${PERF_WEBAPP_URL:-http://127.0.0.1:3000}"
SEED_CMD="${PERF_SEED_CMD:-}"
BUILD_CMD="${PERF_BUILD_CMD:-pnpm --filter web build}"
START_CMD="${PERF_START_CMD:-pnpm --filter web start}"
UPDATE_BASELINE=0
APP_PID=""

for arg in "$@"; do
  case "$arg" in
    --update) UPDATE_BASELINE=1 ;;
  esac
done

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
app_up() { curl -sf "$WEBAPP_URL" >/dev/null 2>&1; }

cleanup() {
  if [[ -n "$APP_PID" ]] && kill -0 "$APP_PID" 2>/dev/null; then
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

cd "$ROOT"

# 1. SEED (opt-in): only runs if PERF_SEED_CMD is set. Most apps need nothing here.
if [[ -n "$SEED_CMD" ]]; then
  step "Seeding environment ($SEED_CMD)"
  eval "$SEED_CMD"
fi

# 2. BUILD (adapt): a production build - dev-mode metrics are unusable as a baseline.
if [[ "${PERF_SKIP_BUILD:-0}" != "1" ]]; then
  step "Building app ($BUILD_CMD)"
  eval "$BUILD_CMD"
fi

# 3. START (adapt): serve the production build at PERF_WEBAPP_URL.
if app_up; then
  echo "App already responds at $WEBAPP_URL - reusing it."
else
  step "Starting app ($START_CMD)"
  eval "$START_CMD" &
  APP_PID=$!
  printf 'Waiting for app'
  for _ in $(seq 1 60); do
    if app_up; then echo " ready."; break; fi
    if ! kill -0 "$APP_PID" 2>/dev/null; then
      echo " app exited before becoming ready." >&2
      exit 1
    fi
    printf '.'
    sleep 2
  done
  if ! app_up; then echo "App did not start in time." >&2; exit 1; fi
fi

# 4. Measure with Lighthouse (standard).
step "Running Lighthouse (desktop + mobile)"
PERF_WEBAPP_URL="$WEBAPP_URL" pnpm --filter perf exec node run-perf.mjs

# 5. Report (and optionally update the baseline).
step "Comparing against baseline"
if [[ "$UPDATE_BASELINE" == "1" ]]; then
  pnpm --filter perf exec node compare.mjs --update
else
  pnpm --filter perf exec node compare.mjs
fi
