// The single required check: passes only if every needed job succeeded or was skipped.
// Usage: NEEDS='${{ toJson(needs) }}' node scripts/ci/ci-ok.ts
import { main } from './_gh.ts';

main(() => {
  const needs = JSON.parse(process.env.NEEDS ?? '{}') as Record<string, { result: string }>;
  const bad = Object.entries(needs).filter(
    ([, job]) => !['success', 'skipped'].includes(job.result),
  );
  for (const [name, job] of bad) console.error(`${name}: ${job.result}`);
  if (bad.length) throw new Error('a CI stage failed or was cancelled');
  console.log(`ok: ${Object.keys(needs).join(', ')}`);
});
