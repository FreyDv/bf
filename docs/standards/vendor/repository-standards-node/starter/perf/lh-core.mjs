/**
 * Lighthouse run primitives shared by the worker process.
 *
 * Each Lighthouse run holds large trace/artifact data that is not released
 * between runs in the same process, so runs are executed one-per-child-process
 * (see lh-worker.mjs). This module keeps the per-run logic in one place.
 */

import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";

export function buildConfig(profile) {
  if (profile === "desktop") {
    return { ...desktopConfig, settings: { ...desktopConfig.settings } };
  }
  return { extends: "lighthouse:default" };
}

export function extractMetrics(lhr) {
  const a = lhr.audits;
  const num = (id) => {
    const v = a[id]?.numericValue;
    return typeof v === "number" ? Math.round(v) : null;
  };
  const score = lhr.categories?.performance?.score;
  return {
    performance: typeof score === "number" ? Math.round(score * 100) : null,
    lcp: num("largest-contentful-paint"),
    fcp: num("first-contentful-paint"),
    si: num("speed-index"),
    tti: num("interactive"),
    tbt: num("total-blocking-time"),
    ttfb: num("server-response-time"),
    cls: a["cumulative-layout-shift"]?.numericValue ?? null,
  };
}

/** Run Lighthouse once against an already-running Chrome and return metrics. */
export async function runOnce({ url, profile, port }) {
  const config = buildConfig(profile);
  const result = await lighthouse(url, { port, output: "json", logLevel: "error" }, config);
  if (!result?.lhr) throw new Error("Lighthouse returned no result");
  return extractMetrics(result.lhr);
}
