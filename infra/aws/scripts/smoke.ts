// Post-release smoke test: the public URLs answer through Caddy and TLS. Retries for a while because containers and
// certificates may still be settling. Only liveness endpoints are hit: no DB health check, Aurora can stay paused.
// Usage: node infra/aws/scripts/smoke.ts
import { main, sleep, summary } from './_lib.ts';
import { config } from '../lib/config.ts';

const { main: mainDomain, api, admin } = config.domains;
const CHECKS = [
  { name: 'fe-main', url: `https://${mainDomain}/` },
  { name: 'fe-admin', url: `https://${admin}/` },
  { name: 'api', url: `https://${api}/health/live` },
];
const DEADLINE_MS = 3 * 60_000;

async function probe(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: 'manual' });
    // a redirect (e.g. to a login page) still proves the app answers
    return response.status < 400 ? undefined : `HTTP ${response.status}`;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

main(async () => {
  const started = Date.now();
  const failing = new Map<string, string>();
  for (const check of CHECKS) {
    for (;;) {
      const problem = await probe(check.url);
      if (!problem) {
        failing.delete(check.name);
        console.log(`ok   ${check.name}  ${check.url}`);
        break;
      }
      failing.set(check.name, problem);
      if (Date.now() - started > DEADLINE_MS) break;
      console.log(`wait ${check.name}  ${check.url}  (${problem})`);
      await sleep(10_000);
    }
  }
  summary(
    [
      '### Smoke test',
      ...CHECKS.map(
        (c) =>
          `- ${failing.has(c.name) ? '❌' : '✅'} \`${c.url}\`${failing.has(c.name) ? ` — ${failing.get(c.name)}` : ''}`,
      ),
    ].join('\n'),
  );
  if (failing.size) throw new Error(`smoke test failed: ${[...failing.keys()].join(', ')}`);
});
