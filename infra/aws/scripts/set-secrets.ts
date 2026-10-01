// ONE-TIME, after the first `pnpm aws:deploy` (admin credentials): fills the secrets CloudFormation cannot generate.
//   JWT_PRIVATE_KEY / JWT_PUBLIC_KEY  RS256 pair (base64 PEM, single line) — generated here, only while still a placeholder
//                                     (--rotate-jwt forces a new pair; that logs every user out)
//   OPENAI_API_KEY                    taken from the environment:  OPENAI_API_KEY=sk-… node infra/aws/scripts/set-secrets.ts
// Containers read secrets when they start → run `pnpm aws:host-deploy` afterwards.
import { generateKeyPairSync } from 'node:crypto';

import {
  GetSecretValueCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

import { main, sdk } from './_lib.ts';
import { names, SECRET_PLACEHOLDER } from '../lib/config.ts';

import type { SecretKey } from '../lib/config.ts';

const client = new SecretsManagerClient(sdk);

async function get(key: SecretKey): Promise<string | undefined> {
  const { SecretString } = await client.send(
    new GetSecretValueCommand({ SecretId: names.secret(key) }),
  );
  return SecretString;
}

async function put(key: SecretKey, value: string) {
  await client.send(
    new PutSecretValueCommand({ SecretId: names.secret(key), SecretString: value }),
  );
  console.log(`set ${key}`);
}

const base64 = (pem: string) => Buffer.from(pem).toString('base64');

main(async () => {
  if (
    (await get('JWT_PRIVATE_KEY')) === SECRET_PLACEHOLDER ||
    process.argv.includes('--rotate-jwt')
  ) {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    await put('JWT_PRIVATE_KEY', base64(privateKey));
    await put('JWT_PUBLIC_KEY', base64(publicKey));
  } else {
    console.log('JWT keys already set (--rotate-jwt to replace)');
  }

  if (process.env.OPENAI_API_KEY) await put('OPENAI_API_KEY', process.env.OPENAI_API_KEY);
  else console.log('OPENAI_API_KEY not in the environment — skipped (ai.ask stays unavailable)');
});
