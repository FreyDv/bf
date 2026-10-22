// Post-release smoke test: the public URLs answer through CloudFront. Retries for a while because a rollout or an
// invalidation may still be settling. Only liveness endpoints are hit (no DB), so Aurora can stay paused — and only
// the edge itself: `/api/<svc>/…` would wake a sleeping service. `--deep` also wakes auth through one of the edge's
// public paths (health probes never wake a service) and passes on any answer below 500: a 404 from auth itself proves
// it started and is reachable through Service Connect.
// Usage: node infra/aws/scripts/smoke.ts [--deep]
import { has, main, sleep, summary } from './_lib.ts';
import { appOverrides } from '../lib/apps.ts';
import { config } from '../lib/config.ts';

const { main: site, admin, api } = config.publicUrls;
/** A path the edge lets through without a token and that is not a health probe, e.g. `/auth/api/auth/`. */
const wakePath = appOverrides.api?.env?.PUBLIC_PATHS?.split(',')[0]?.trim();
interface Check {
  name: string;
  url: string;
  /** Expected redirect target (status 301/302 + Location); otherwise any status < 400 passes. */
  redirectTo?: string;
  /** Highest status that still counts as healthy (default: below 400). */
  below?: number;
}
const CHECKS: Check[] = [
  { name: 'fe-main', url: `${site}/` },
  { name: 'fe-admin', url: `${admin}/` },
  { name: 'api', url: `${api}/health/live` },
  { name: 'admin. redirect', url: `https://${config.domains.admin}/`, redirectTo: `${admin}/` },
  {
    name: 'api. redirect',
    url: `https://${config.domains.api}/health/live`,
    redirectTo: `${api}/health/live`,
  },
  ...(has('deep') && wakePath
    ? [{ name: 'auth (wakes it)', url: `${api}${wakePath}smoke`, below: 500 }]
    : []),
];
const DEADLINE_MS = 3 * 60_000;

async function probe(check: Check): Promise<string | undefined> {
  try {
    const response = await fetch(check.url, {
      signal: AbortSignal.timeout(60_000),
      redirect: 'manual',
    });
    if (check.redirectTo) {
      const location = response.headers.get('location');
      return [301, 302, 308].includes(response.status) && location === check.redirectTo
        ? undefined
        : `HTTP ${response.status} → ${location ?? '(no Location)'}`;
    }
    return response.status < (check.below ?? 400) ? undefined : `HTTP ${response.status}`;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

main(async () => {
  const started = Date.now();
  const failing = new Map<string, string>();
  for (const check of CHECKS) {
    for (;;) {
      const problem = await probe(check);
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
