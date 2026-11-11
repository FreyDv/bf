/**
 * Compare the latest perf run against the committed baseline.
 *
 * Prints a per-route table of baseline vs current with deltas and direction
 * arrows so you can see, before pushing, whether a change sped the app up or
 * slowed it down. This is a report only: it always exits 0 and never fails a
 * pre-push check. Run with `--update` to overwrite the baseline from the latest
 * run (a deliberate, reviewable act - commit the new baseline in your PR).
 */

import { readFile, writeFile } from "node:fs/promises";
import { BASELINE_FILE, LAST_RESULTS_FILE, METRICS, PROFILES, ROUTES } from "./config.mjs";

const WARN_PCT = 5;
const ALERT_PCT = 10;

async function readJson(url) {
  try {
    return JSON.parse(await readFile(url, "utf8"));
  } catch {
    return null;
  }
}

function fmt(metric, value) {
  if (value === null || value === undefined) return "-";
  if (metric.key === "cls") return value.toFixed(3);
  return metric.unit === "ms" ? `${value}ms` : `${value}`;
}

/** Signed percentage change of current vs baseline (positive = bigger number). */
function pctChange(base, cur) {
  if (typeof base !== "number" || typeof cur !== "number" || base === 0) return null;
  return ((cur - base) / Math.abs(base)) * 100;
}

function verdict(metric, base, cur) {
  const pct = pctChange(base, cur);
  if (pct === null) return { arrow: " ", note: "" };
  if (pct === 0) return { arrow: "= same", note: "0.0%" };
  const improved = metric.lowerIsBetter ? pct < 0 : pct > 0;
  const magnitude = Math.abs(pct);
  const arrow = improved ? "^ faster" : "v slower";
  let tag = "";
  if (!improved && magnitude >= ALERT_PCT) tag = " !!";
  else if (!improved && magnitude >= WARN_PCT) tag = " !";
  const sign = pct > 0 ? "+" : "";
  return { arrow: `${arrow}${tag}`, note: `${sign}${pct.toFixed(1)}%` };
}

function printRoute(route, baseRes, curRes) {
  process.stdout.write(`\n${route.label}\n`);
  for (const profile of PROFILES) {
    const base = baseRes?.[route.id]?.[profile] ?? {};
    const cur = curRes?.[route.id]?.[profile] ?? {};
    process.stdout.write(`  [${profile}]\n`);
    for (const metric of METRICS) {
      const b = base[metric.key];
      const c = cur[metric.key];
      const { arrow, note } = verdict(metric, b, c);
      const row = [
        metric.label.padEnd(12),
        `base ${fmt(metric, b)}`.padEnd(16),
        `now ${fmt(metric, c)}`.padEnd(16),
        note.padStart(8),
        arrow,
      ].join("  ");
      process.stdout.write(`    ${row}\n`);
    }
  }
}

async function main() {
  const update = process.argv.includes("--update");
  const last = await readJson(LAST_RESULTS_FILE);

  if (!last) {
    process.stdout.write("No latest run found. Run `pnpm test:perf` first.\n");
    return;
  }

  if (update) {
    await writeFile(BASELINE_FILE, `${JSON.stringify(last, null, 2)}\n`);
    process.stdout.write(`Baseline updated from latest run (${last.generatedAt}).\n`);
    process.stdout.write("Commit the baseline file to record the accepted numbers.\n");
    return;
  }

  const baseline = await readJson(BASELINE_FILE);
  if (!baseline) {
    process.stdout.write(
      "No baseline yet. Review the numbers below, then run `pnpm test:perf:update` to record them.\n",
    );
  } else {
    process.stdout.write(
      `Baseline ${baseline.generatedAt}  vs  current ${last.generatedAt}\n` +
        `Thresholds: ! warn >=${WARN_PCT}% slower, !! alert >=${ALERT_PCT}% slower (report only).\n`,
    );
  }

  for (const route of ROUTES) {
    printRoute(route, baseline?.results, last.results);
  }
  process.stdout.write("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
