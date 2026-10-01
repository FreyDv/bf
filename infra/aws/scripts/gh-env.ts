// Prints KEY=VALUE lines for $GITHUB_ENV (.github/actions/aws-auth), so workflows never hardcode the region or env.
import { config } from '../lib/config.ts';

console.log(`AWS_REGION=${config.region}`);
console.log(`BF_ENV=${config.env}`);
