// Sets the step output `changed=true|false`: did anything under the given paths change since BASE?
// Usage: BASE=<sha> node scripts/ci/changed.ts <path> [path ...]
import { changedFiles, main, setOutput } from './_gh.ts';

main(() => {
  const paths = process.argv.slice(2);
  if (!paths.length) throw new Error('usage: BASE=<sha> changed.ts <path> [path ...]');
  // unknown base → be safe and report a change
  setOutput('changed', String((changedFiles(process.env.BASE, paths)?.length ?? 1) > 0));
});
