/**
 * Single Lighthouse run in an isolated process.
 *
 * Usage: node lh-worker.mjs <url> <profile> <port>
 * Prints the extracted metrics as one JSON line to stdout, then exits so the OS
 * reclaims the run's memory. The parent (run-perf.mjs) spawns one of these per
 * run to avoid Lighthouse's cross-run heap growth.
 */

import { runOnce } from "./lh-core.mjs";

const [, , url, profile, port] = process.argv;

runOnce({ url, profile, port: Number(port) })
  .then((metrics) => {
    process.stdout.write(JSON.stringify(metrics));
  })
  .catch((err) => {
    process.stderr.write(String(err?.stack ?? err));
    process.exit(1);
  });
