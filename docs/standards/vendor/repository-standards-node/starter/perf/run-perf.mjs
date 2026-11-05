/**
 * Local Lighthouse runner.
 *
 * Launches one headless Chrome and, for each route, first warms the route
 * (WARMUP_HITS sequential GETs - wakes the machine, fills any caches, primes the
 * CDN edge) so the measurement reflects steady-state render performance, then
 * measures both device profiles (RUNS_PER_TARGET runs, median recorded) and
 * writes the result to perf/.results/last.json. Each individual Lighthouse run
 * happens in an isolated child process (lh-worker.mjs) because Lighthouse does
 * not release its trace/artifact memory between runs in one process.
 *
 * Assumes the app is already serving (a production build) at ORIGIN - see
 * scripts/perf-budget.sh for the local target.
 */

import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import * as ChromeLauncher from "chrome-launcher";
import {
  HISTORY_DIR,
  LAST_RESULTS_FILE,
  METRICS,
  ORIGIN,
  PROFILES,
  RESULTS_DIR,
  ROUTES,
  RUNS_PER_TARGET,
  TARGET,
} from "./config.mjs";

const execFileAsync = promisify(execFile);
const WORKER = fileURLToPath(new URL("./lh-worker.mjs", import.meta.url));

/** Best-effort short SHA of the checkout that produced this run. */
async function gitCommit() {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--short", "HEAD"]);
    return stdout.trim();
  } catch {
    return "unknown";
  }
}

/** The deploy.commit of the most recent existing snapshot for this target, or null. */
async function previousSnapshotCommit(beforeDate) {
  let names;
  try {
    names = await readdir(HISTORY_DIR);
  } catch {
    return null;
  }
  const prior = names
    .filter((n) => n.endsWith(`-${TARGET}.json`) && n.slice(0, 10) < beforeDate)
    .sort();
  const latest = prior.at(-1);
  if (!latest) return null;
  try {
    const json = JSON.parse(await readFile(new URL(`./${latest}`, HISTORY_DIR), "utf8"));
    const commit = json?.deploy?.commit;
    return commit && commit !== "unknown" ? commit : null;
  } catch {
    return null;
  }
}

/**
 * Subjects worth showing when explaining a perf delta. A cosmetic commit (a
 * footer colour, a button, a docs/test/format pass) does not move LCP or TTFB,
 * so it is noise here. Keep a commit only if its subject actually names a
 * performance lever; drop the rest.
 */
const PERF_SUBJECT_RX =
  /(perf|cache|lcp|ttfb|\btti\b|lazy|defer|prefetch|preload|fetchpriorit|n\+1|\bpool\b|\bindex\b|\bquery\b|latency|speed[- ]?index|batch|throttle|debounce|\bbound\b|progressive|standalone|bundle|tree[- ]?shak|exhaust)/i;

/**
 * What changed since the previous snapshot of this target. Runs
 * `git log <prev>..HEAD` over the paths that affect app runtime and keeps only
 * the perf-relevant subjects as raw evidence (`keyCommits`). The narrative
 * fields - `summary` (what changed and what it means) and `likelyCause` (why the
 * number moved) - are left empty here: they are an analysis written from these
 * commits, not something the runner can infer. Fill them in after the run.
 */
async function changesSincePrevious(thisCommit, beforeDate) {
  const prev = await previousSnapshotCommit(beforeDate);
  if (!prev) {
    return {
      range: "n/a",
      summary: "First recorded run for this target.",
      likelyCause: "",
      keyCommits: [],
    };
  }
  let keyCommits = [];
  try {
    // Root-relative pathspecs (`:(top)`) so the filter works no matter which
    // directory pnpm runs this from - the runner's cwd is the perf package, not
    // the repo root.
    const { stdout } = await execFileAsync("git", [
      "log",
      `${prev}..HEAD`,
      "--pretty=%h %s",
      "--",
      ":(top)apps",
      ":(top)services",
      ":(top)packages",
    ]);
    keyCommits = stdout
      .split("\n")
      .filter(Boolean)
      .filter((line) => PERF_SUBJECT_RX.test(line))
      .slice(0, 25);
  } catch {
    // No git or unrelated history - leave keyCommits empty.
  }
  return { range: `${prev}..${thisCommit}`, summary: "", likelyCause: "", keyCommits };
}

/**
 * Archive the run as a committed, dated snapshot (history/YYYY-MM-DD-<target>.json)
 * so it survives the gitignored `.results/`. Never clobbers an existing snapshot
 * for the same day - the first run of the day wins, and its `deploy.note` (which a
 * human fills in) is preserved across re-runs.
 */
async function archiveHistory(payload) {
  const date = payload.generatedAt.slice(0, 10);
  const file = new URL(`./${date}-${TARGET}.json`, HISTORY_DIR);
  try {
    await readFile(file);
    process.stdout.write(`History snapshot ${date}-${TARGET}.json already exists - left as is.\n`);
    return;
  } catch {
    // Not present yet - write it.
  }
  const commit = await gitCommit();
  const snapshot = {
    measuredAt: payload.generatedAt,
    target: TARGET,
    origin: payload.origin,
    runsPerTarget: payload.runsPerTarget,
    warmupHits: payload.warmupHits,
    deploy: { ref: "main", commit, note: "" },
    changesSincePrevious: await changesSincePrevious(commit, date),
    results: payload.results,
  };
  await mkdir(HISTORY_DIR, { recursive: true });
  await writeFile(file, `${JSON.stringify(snapshot, null, 2)}\n`);
  process.stdout.write(
    `Archived snapshot to history/${date}-${TARGET}.json (fill in deploy.note).\n`,
  );
}

function median(values) {
  const nums = values.filter((v) => typeof v === "number").sort((x, y) => x - y);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : Math.round((nums[mid - 1] + nums[mid]) / 2);
}

function medianMetrics(runs) {
  const out = {};
  for (const { key } of METRICS) {
    out[key] = median(runs.map((r) => r[key]));
  }
  return out;
}

/** Sequential GETs that warm a route before it is measured (env-tunable). */
const WARMUP_HITS = Number(process.env.PERF_WARMUP_HITS ?? 3);
const WARMUP_DELAY_MS = Number(process.env.PERF_WARMUP_DELAY_MS ?? 800);

/**
 * Warm the route before measuring so the recorded numbers reflect steady-state
 * render performance rather than a cold first hit: a few sequential GETs wake the
 * server, populate any caches the page reads, and prime the CDN edge entry.
 * Best-effort - a warmup failure never fails the run. Note this is also why these
 * numbers do NOT capture cold-start latency; that needs a separate cold probe.
 */
async function warmupRoute(route) {
  if (WARMUP_HITS <= 0) return;
  const url = `${ORIGIN}${route.path}`;
  for (let i = 0; i < WARMUP_HITS; i++) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": "perf-warmup" },
      });
      // Drain the body so the server fully renders the page, not just headers.
      await res.arrayBuffer();
    } catch {
      // Ignore - warmup is best-effort.
    }
    if (i < WARMUP_HITS - 1) {
      await new Promise((resolve) => setTimeout(resolve, WARMUP_DELAY_MS));
    }
  }
}

/** Run one isolated Lighthouse measurement via the worker process. */
async function runOne(route, profile, port) {
  const { stdout } = await execFileAsync(
    process.execPath,
    [WORKER, `${ORIGIN}${route.path}`, profile, String(port)],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(stdout);
}

async function measure(route, profile, port) {
  const runs = [];
  for (let i = 0; i < RUNS_PER_TARGET; i++) {
    runs.push(await runOne(route, profile, port));
  }
  return medianMetrics(runs);
}

async function main() {
  const chrome = await ChromeLauncher.launch({
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });

  const results = {};
  try {
    for (const route of ROUTES) {
      results[route.id] = {};
      try {
        if (WARMUP_HITS > 0) {
          process.stdout.write(`  warming ${route.label} x${WARMUP_HITS}...\n`);
          await warmupRoute(route);
        }
        for (const profile of PROFILES) {
          process.stdout.write(`  measuring ${route.label} [${profile}] x${RUNS_PER_TARGET}...\n`);
          results[route.id][profile] = await measure(route, profile, chrome.port);
        }
      } catch (err) {
        process.stderr.write(`  ! ${route.label} failed: ${err.message}\n`);
      }
    }
  } finally {
    await chrome.kill();
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    origin: ORIGIN,
    runsPerTarget: RUNS_PER_TARGET,
    warmupHits: WARMUP_HITS,
    results,
  };
  await mkdir(RESULTS_DIR, { recursive: true });
  await writeFile(LAST_RESULTS_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  process.stdout.write(`\nWrote results to ${LAST_RESULTS_FILE.pathname}\n`);

  await archiveHistory(payload);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
