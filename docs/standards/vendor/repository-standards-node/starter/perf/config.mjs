/**
 * Shared configuration for the performance-budget tool.
 *
 * Routes, device profiles and tracked metrics live here so that the runner and
 * the comparison report stay in sync. Edit ROUTES to match your app.
 *
 * Targets:
 *   - "local" (default): a production build served locally - the pre-push
 *     regression check. The env is yours (a local server, a prod-mode build, a
 *     test env); perf-budget.sh seeds/builds/starts it. Machine-specific numbers:
 *     a relative check, not a cross-team trend.
 *   - any other name ("dev", "qa", "perf", "staging", "prod", ...): the app
 *     already DEPLOYED to that environment. We seed and build nothing - we measure
 *     the real URL on real (stable) machines, so its committed history is a real
 *     trend. Set PERF_WEBAPP_URL to the deployed origin. Each target keeps its own
 *     baseline (baseline.<target>.json) and history so trends never mix.
 */

// The target name becomes part of a filename (baseline.<target>.json, history
// snapshots), so keep it a simple slug.
const RAW_TARGET = process.env.PERF_TARGET?.trim() || "local";
if (!/^[a-z0-9][a-z0-9-]*$/.test(RAW_TARGET)) {
  throw new Error(
    `PERF_TARGET must be a slug like local, dev, qa, perf, prod - got "${RAW_TARGET}"`,
  );
}
export const TARGET = RAW_TARGET;
const IS_LOCAL = TARGET === "local";

export const ORIGIN =
  process.env.PERF_WEBAPP_URL ?? (IS_LOCAL ? "http://127.0.0.1:3000" : null);

if (!ORIGIN) {
  throw new Error(
    `PERF_TARGET=${TARGET} measures a deployed environment - set PERF_WEBAPP_URL=<the ${TARGET} URL>`,
  );
}

/** Number of Lighthouse runs per route/profile; the median is recorded. */
export const RUNS_PER_TARGET = Number(process.env.PERF_RUNS ?? 3);

/** Device profiles measured for every route. */
export const PROFILES = ["desktop", "mobile"];

/**
 * Routes to measure. Keep these read-only and public: a deployed target hits the
 * real live site, so a mutating route would create real traffic or data.
 * If you must measure a route that needs setup (an authenticated page, a seeded
 * cart), guard it to the local target and seed it before the run - wire that into
 * run-perf.mjs before the measure loop; the default set here needs none.
 */
export const ROUTES = [
  { id: "home", label: "Home /", path: "/" },
  { id: "signin", label: "Sign in /sign-in", path: "/sign-in" },
];

/**
 * Metrics extracted from each Lighthouse run. `lowerIsBetter: false` flags the
 * one metric (the overall performance score) where a higher number is better.
 */
export const METRICS = [
  { key: "performance", label: "Perf score", unit: "", lowerIsBetter: false },
  { key: "lcp", label: "LCP", unit: "ms", lowerIsBetter: true },
  { key: "fcp", label: "FCP", unit: "ms", lowerIsBetter: true },
  { key: "si", label: "Speed Index", unit: "ms", lowerIsBetter: true },
  { key: "tti", label: "TTI", unit: "ms", lowerIsBetter: true },
  { key: "tbt", label: "TBT", unit: "ms", lowerIsBetter: true },
  { key: "ttfb", label: "TTFB", unit: "ms", lowerIsBetter: true },
  { key: "cls", label: "CLS", unit: "", lowerIsBetter: true },
];

const SUFFIX = IS_LOCAL ? "" : `.${TARGET}`;
export const RESULTS_DIR = new URL("./.results/", import.meta.url);
export const LAST_RESULTS_FILE = new URL(`./.results/last${SUFFIX}.json`, import.meta.url);
export const BASELINE_FILE = new URL(`./baseline${SUFFIX}.json`, import.meta.url);

/**
 * Committed, append-only archive - one file per run (see history/README.md). The
 * runner drops a dated snapshot here automatically so a measurement is never lost
 * to the gitignored `.results/`. File name is `YYYY-MM-DD-<target>.json`.
 */
export const HISTORY_DIR = new URL("./history/", import.meta.url);
