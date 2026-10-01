#!/usr/bin/env node
// Generates an RS256 key pair and writes it into the apps' .env files:
//   JWT_PRIVATE_KEY (auth only) and JWT_PUBLIC_KEY (every Nest service), both base64(PEM) single-line.
// Existing values are replaced. Run after `pnpm setup:env`. Pass --print to only print the pair.
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { discoverApps } from './apps.mjs';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const pub = Buffer.from(publicKey).toString('base64');
const priv = Buffer.from(privateKey).toString('base64');

if (process.argv.includes('--print')) {
  console.log(`JWT_PUBLIC_KEY=${pub}`);
  console.log(`JWT_PRIVATE_KEY=${priv}`);
  process.exit(0);
}

const NEST_APPS = discoverApps()
  .filter((a) => a.kind === 'nest')
  .map((a) => a.name);
const FILES = ['.env', '.env.docker'];

function upsert(file, key, value) {
  if (!existsSync(file)) return false;
  const lines = readFileSync(file, 'utf8').split('\n');
  const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (idx >= 0) lines[idx] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  writeFileSync(file, lines.join('\n').replace(/\n*$/, '\n'));
  return true;
}

let touched = 0;
for (const app of NEST_APPS) {
  for (const name of FILES) {
    const file = join('apps', app, name);
    if (upsert(file, 'JWT_PUBLIC_KEY', pub)) touched += 1;
    if (app === 'auth') upsert(file, 'JWT_PRIVATE_KEY', priv);
  }
}
console.log(`gen:jwt-keys — wrote a fresh RS256 pair into ${touched} env file(s)`);
