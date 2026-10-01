// Prints the docker build args of one app as a multi-line GitHub output (`args`), for docker/build-push-action.
// Usage: node infra/aws/scripts/build-args.ts <app> >> "$GITHUB_OUTPUT"
import { apps, main, positionals } from './_lib.ts';
import { imageBuildArgs } from '../lib/images.ts';

main(async () => {
  const [name] = positionals();
  if (!name) throw new Error('usage: build-args.ts <app>');
  const [app] = apps([name]);
  const lines = Object.entries(imageBuildArgs(app!)).map(([key, value]) => `${key}=${value}`);
  console.log(['args<<EOF', ...lines, 'EOF'].join('\n'));
});
